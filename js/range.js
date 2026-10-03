'use strict';
/* ===== Hand ranges: what each opponent probably holds, judged only from what the table has seen them
   do: their betting this hand, read in the light of their habits over the game. No DOM. A range is a weight for each of the 1,326 two-card combos. ===== */
// the 169 starting hands, strongest first (ranked offline by equity against one and three random hands)
const PREFLOP_ORDER='AA KK QQ JJ TT 99 AKs AQs 88 AJs AKo ATs KQs AQo 77 AJo KJs A9s ATo KTs KQo QJs A8s 66 KJo A7s QTs K9s A9o KTo A5s A6s QJo A4s JTs 55 A8o Q9s K8s A3s QTo K7s K9o A7o A5o J9s A2s Q8s JTo A6o K6s T9s Q9o K5s A4o K8o 44 A3o K4s J8s Q7s T8s J9o K3s Q6s K7o 98s T9o J7s A2o Q8o K6o Q5s K2s J8o T7s Q4s 33 K5o Q7o 97s K4o Q3s J6s T8o 87s Q2s J5s 98o T6s Q6o K3o J7o J4s 86s 22 96s Q5o K2o J3s T7o T5s 76s Q4o J2s 97o 87o J6o T4s 75s 85s Q3o 95s T3s 65s J5o T2s T6o Q2o 96o J4o 64s 54s 94s 84s 74s J3o 93s 86o 76o T5o 92s T4o 53s J2o 75o 95o 85o 43s 83s 65o T3o 73s 63s 82s T2o 94o 93o 54o 52s 84o 72s 62s 74o 64o 42s 92o 32s 53o 83o 63o 82o 73o 43o 52o 72o 62o 42o 32o'.split(' ');
const COMBOS=[],COMBO_IX=new Int16Array(52*52),PRE_STR=new Float64Array(1326);
(function(){
  const R='23456789TJQKA',top={};let n=0;
  for(const k of PREFLOP_ORDER){const c=k.length===2?6:k[2]==='s'?4:12;top[k]=n+c/2;n+=c;}
  for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){
    const hi=Math.max(a%13,b%13),lo=Math.min(a%13,b%13),k=R[hi]+R[lo]+(hi===lo?'':suitOf(a)===suitOf(b)?'s':'o');
    COMBO_IX[a*52+b]=COMBO_IX[b*52+a]=COMBOS.length;PRE_STR[COMBOS.length]=1-top[k]/1326;COMBOS.push([a,b]);
  }
})();
// preflop strength of two hole cards: 1 = aces, near 0 = seven-deuce
const preStrength=(a,b)=>PRE_STR[COMBO_IX[a*52+b]];

const ramp=(v,lo,hi)=>clamp((v-lo)/(hi-lo),0,1);
// keeps the hands in the top `width` share of combos, fading out (not cutting off) below it; the
// narrower the range, the less room for random hands
const topWeight=(s,width)=>{const below=1-s-width;return below<=0?1:Math.max(Math.min(0.03,width*0.1),Math.exp(-below/(0.01+width*0.25)));};

// how good every combo is on this board, 0..1: the share of other combos it beats, raised for draws
// before the river. Cached for the hand, since every opponent's range reuses it.
function boardStrength(t,board){
  if(!t.strCache||t.strCache.hand!==t.handNo)t.strCache={hand:t.handNo};
  const key=board.join();if(t.strCache[key])return t.strCache[key];
  const dead=new Uint8Array(52);board.forEach(c=>dead[c]=1);
  const sc=new Float64Array(1326),live=[];
  for(let i=0;i<1326;i++){const[a,b]=COMBOS[i];if(dead[a]||dead[b])continue;live.push(i);sc[i]=evalHand([a,b].concat(board));}
  const order=live.slice().sort((x,y)=>sc[x]-sc[y]),str=new Float64Array(1326);
  for(let j=0;j<order.length;){let k=j;while(k<order.length&&sc[order[k]]===sc[order[j]])k++;
    for(let m=j;m<k;m++)str[order[m]]=(j+k-1)/2/(order.length-1);j=k;}
  if(board.length<5)for(const i of live)str[i]=Math.max(str[i],drawStrength(COMBOS[i],board));
  return t.strCache[key]=str;
}
// a flush or straight draw the hole cards help make, as a strength floor (it plays like a decent hand)
function drawStrength(hole,board){
  const sc=[0,0,0,0];let mask=0,bmask=0;
  for(const c of board){sc[suitOf(c)]++;bmask|=1<<rankOf(c);}
  mask=bmask;for(const c of hole){sc[suitOf(c)]++;mask|=1<<rankOf(c);}
  const fd=hole.some(c=>sc[suitOf(c)]===4);
  const outs=m=>{let n=0;for(let r=0;r<13;r++)if(!((m>>r)&1)&&straightHigh(m|1<<r)>straightHigh(m))n++;return n;};
  const sd=straightHigh(mask)<0?outs(mask)-outs(bmask):0,flop=board.length===3;
  if(fd&&sd>=1)return flop?0.85:0.7;
  if(fd)return flop?0.7:0.6;
  if(sd>=2)return flop?0.62:0.52;
  if(sd===1)return flop?0.45:0.38;
  return 0;
}

// players still to act after seat i before the flop, up to and including the big blind
function seatsToAct(t,i){let n=0;for(let j=i;j!==t.bbSeat&&n<t.players.length;n++)j=nextAlive(t,j);return n;}
// share of hands worth opening, by players left to act behind (heads-up the button opens far wider);
// with nobody behind it is the big blind raising limpers
const OPEN_WIDTH=[0.18,0.45,0.33,0.24,0.18,0.15],OPEN_HU=0.65;
const openWidth=(t,i)=>{const n=seatsToAct(t,i);return n&&aliveList(t).length===2?OPEN_HU:OPEN_WIDTH[Math.min(n,5)];};
// share of hands to move all in with when nobody has raised, by stack (in big blinds) and players
// left to act: a fit to the standard push/fold charts, so 10 BB shoves ~17% under the gun, ~62% in the small blind
// (the big blind only ever shoves over limpers); each limper makes a shove tighter, since limpers fold less
const PUSH10=[0.4,0.62,0.4,0.3,0.22,0.17];
const pushWidth=(bbs,behind,limpers=0)=>Math.min(1,PUSH10[Math.min(behind,5)]*(10/bbs)**0.78*0.75**Math.max(0,limpers-(behind?0:1)));

// roughly how the computer players themselves play (measured over AI-only games); agg is bets and raises
// per chance to bet or raise after the flop, fold is folds per bet faced after the flop
const TYPICAL={vpip:0.36,pfr:0.19,agg:0.3,fold:0.53};
// q's habits over the game so far, each pulled toward a typical player until enough is seen. A game is
// short (a player sees ~20 deep hands and ~5 bets after the flop), so the reads stay mild unless a
// habit is strong or the player is around for a long time
function tendency(q){
  const s=q.seen,est=(n,d,typ,k)=>(n+typ*k)/(d+k);
  return{vpip:est(s.vpip,s.hands,TYPICAL.vpip,40),pfr:est(s.pfr,s.hands,TYPICAL.pfr,40),
    agg:est(s.aggr,s.chances,TYPICAL.agg,15),fold:est(s.folds,s.faced,TYPICAL.fold,5)};
}

// what player q probably holds, from their actions this hand as recorded in t.acts, read in the light
// of their habits: a player who raises every hand has a wide raising range
function readRange(t,q){
  const T=tendency(q),loose=clamp(T.vpip/TYPICAL.vpip,0.6,2.5),raisy=clamp(T.pfr/TYPICAL.pfr,0.6,3),wild=clamp(T.agg/TYPICAL.agg,0.5,2.5);
  // before the flop the narrowest thing q showed sets the range (a 4-bet already implies the open)
  let width=1,trap=0,raises=0,limps=0;const gone=new Set(); // players who folded before q acted
  for(const a of t.acts){
    if(a.st>0)break;
    if(a.id!==q.id&&!raises&&a.type==='call')limps++;
    if(a.type==='fold')gone.add(a.id);
    const aggr=a.to>a.prev,k=Math.min(raises,2);
    if(a.id===q.id&&a.type!=='check'){
      // the more raises before it, the stronger a raise or a call shows
      // a short stack's jam is wide (push/fold); a deep stack moving in first is as strong as a 3-bet
      const stackBB=Math.min(q.startChips,Math.max(...t.players.filter(x=>x!==q&&!x.out&&!gone.has(x.id)).map(x=>x.startChips)))/t.bb; // effective
      const allin=a.type==='allin'&&aggr,jam=allin&&stackBB<=20;
      const w=aggr?Math.max(raises?(k>1?0.04:0.09):allin?0.09:openWidth(t,q.id),jam?(raises?Math.min(1,2.5/stackBB):pushWidth(stackBB,seatsToAct(t,q.id),limps)):0)
        :[0.45,0.25,0.1][k];
      const seen=jam?w:Math.min(1,w*(aggr?raisy:loose)); // a short stack's jam follows the chart, not habits
      if(seen<width){width=seen;trap=aggr?0:[0.08,0.04,0][k];} // a call leaves out some strong hands that would have raised
    }
    if(aggr)raises++;
  }
  const w=new Float64Array(1326),post=new Float64Array(1326).fill(1);
  for(let i=0;i<1326;i++){const s=PRE_STR[i];w[i]=topWeight(s,width)*(1-s<trap?0.5:1);}
  // after the flop each action reweights by how good the hand is on the board it saw
  for(const a of t.acts){
    if(a.st===0||a.id!==q.id)continue;
    const aggr=a.to>a.prev,str=boardStrength(t,t.board.slice(0,a.st+2));
    for(let i=0;i<1326;i++){
      const s=str[i];
      if(a.type==='check')post[i]*=1-0.5*ramp(s,0.75,1);                          // strong hands usually bet
      else if(aggr){ // a raise shows more than a bet, and a habitual bettor's bets show less
        const f=a.prev>0?0.1+0.9*ramp(s,0.6,0.95)**1.5:0.15+0.85*ramp(s,0.45,0.9)**1.5;
        post[i]*=f+(1-f)*clamp((wild-1)*0.3,0,0.45);
      }
      else post[i]*=(0.1+0.9*ramp(s,0.25,0.65))*(1-0.3*ramp(s,0.9,1));             // calls: middling hands and draws
    }
  }
  // however much they have bet, some of it can still be a bluff (more of it for an aggressive player)
  const floor=0.04*wild*wild;
  for(let i=0;i<1326;i++)w[i]*=Math.max(post[i],floor);
  return w;
}

// p's chance of winning against opponents whose hands are drawn from their ranges (Monte Carlo)
function rangeEquity(hole,board,ranges,iters,rng){
  if(!ranges.length)return 1;
  const dead=new Uint8Array(52);hole.concat(board).forEach(c=>dead[c]=1);
  // per opponent: the combos still possible and their cumulative weights, for weighted draws
  const pools=ranges.map(w=>{
    const ix=[],cum=[];let tot=0;
    for(let i=0;i<1326;i++){const[a,b]=COMBOS[i];if(dead[a]||dead[b])continue;const x=w?w[i]:1;if(x>0){tot+=x;ix.push(i);cum.push(tot);}}
    if(!tot)for(let i=0;i<1326;i++){const[a,b]=COMBOS[i];if(!dead[a]&&!dead[b]){ix.push(i);cum.push(++tot);}}
    return{ix,cum,tot};
  });
  const pick=({ix,cum,tot})=>{const r=rng()*tot;let lo=0,hi=cum.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cum[m]>r)hi=m;else lo=m+1;}return COMBOS[ix[lo]];};
  const need=5-board.length,used=new Uint8Array(52),deck=[],opp=[];let win=0;
  for(let it=0;it<iters;it++){
    used.set(dead);opp.length=0;
    for(const pool of pools){
      let h=null;
      for(let k=0;k<12&&!h;k++){const c=pick(pool);if(!used[c[0]]&&!used[c[1]])h=c;}
      if(!h){const free=[];for(let c=0;c<52;c++)if(!used[c])free.push(c);const i=Math.floor(rng()*free.length);let j=Math.floor(rng()*(free.length-1));if(j>=i)j++;h=[free[i],free[j]];}
      used[h[0]]=used[h[1]]=1;opp.push(h);
    }
    deck.length=0;for(let c=0;c<52;c++)if(!used[c])deck.push(c);
    const run=board.slice();
    for(let i=0;i<need;i++){const j=i+Math.floor(rng()*(deck.length-i));const x=deck[i];deck[i]=deck[j];deck[j]=x;run.push(deck[i]);}
    const ms=evalHand(hole.concat(run));let ties=0,lose=false;
    for(const h of opp){const os=evalHand(h.concat(run));if(os>ms){lose=true;break;}if(os===ms)ties++;}
    if(!lose)win+=1/(ties+1);
  }
  return win/iters;
}
