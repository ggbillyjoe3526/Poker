'use strict';
/* ===== Tournament engine: table state, blinds, betting rules, pots and eliminations. No DOM.
   A table `t` is a plain object (in the browser it is G). playHand drives one hand and reports each
   step through `io` hooks, awaiting every one so the browser can animate in between. Only
   io.decide(p,o) is required; tests and simulations leave the rest out. ===== */
const STREET_CARDS=[null,[0,1,2],[3],[4]]; // board indices dealt on the flop, turn and river

const inHandList=t=>t.players.filter(p=>!p.out&&!p.folded);
const canActList=t=>t.players.filter(p=>!p.out&&!p.folded&&!p.allIn);
const aliveList=t=>t.players.filter(p=>!p.out);
function nextAlive(t,i){const n=t.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(!t.players[j].out)return j;}return i;}
function prevAlive(t,i){const n=t.players.length;for(let k=1;k<=n;k++){const j=(i-k+n)%n;if(!t.players[j].out)return j;}return i;}
function potTotal(t){return t.pot+t.players.reduce((a,p)=>a+p.bet,0);}

// rng deals the cards, aiRng drives opponent decisions: keeping them apart means a seed always deals
// the same cards, whatever anyone does
function initTable(t,players,rng,aiRng){
  players.forEach((p,i)=>Object.assign(p,{id:i,chips:START_STACK,cards:[],bet:0,total:0,folded:false,allIn:false,out:false,lastRaiseId:-1,place:0}));
  Object.assign(t,{players,rng,aiRng,handNo:0,level:0,dealer:-1,bbSeat:null,pot:0,board:[],boardCards:[],street:0,
    currentBet:0,minRaise:0,raiseId:0,streetRaises:0,runout:false,acts:[]});
  [t.sb,t.bb]=BLINDS[0];
  return t;
}

/* ---------------- HAND ---------------- */
function startHand(t){
  t.handNo++;
  const lvl=Math.min(BLINDS.length-1,Math.floor((t.handNo-1)/HANDS_PER_LEVEL)),lvlUp=lvl!==t.level;
  t.level=lvl;[t.sb,t.bb]=BLINDS[lvl];
  Object.assign(t,{pot:0,board:[],boardCards:[],street:0,streetRaises:0,runout:false,acts:[]});
  for(const p of t.players)Object.assign(p,{startChips:p.chips,cards:[],bet:0,total:0,folded:p.out,allIn:false,lastRaiseId:-1,bluffing:false,score:0});
  return lvlUp;
}
function positions(t){
  // dead-button rule: the big blind always moves one live player forward, so nobody skips a blind
  const alive=aliveList(t),hu=alive.length===2;
  let sb,bb;
  if(t.bbSeat==null){t.dealer=alive[Math.floor(t.rng()*alive.length)].id;sb=hu?t.dealer:nextAlive(t,t.dealer);bb=nextAlive(t,sb);}
  else if(hu){bb=nextAlive(t,t.bbSeat);sb=nextAlive(t,bb);t.dealer=sb;}
  else{
    bb=nextAlive(t,t.bbSeat);
    const sbSeat=t.bbSeat;                              // last hand's big blind posts the small blind…
    sb=t.players[sbSeat].out||sbSeat===bb?-1:sbSeat;    // …or it is a dead small blind if they busted
    t.dealer=prevAlive(t,sbSeat);
    if(t.dealer===bb)t.dealer=prevAlive(t,bb);
  }
  t.bbSeat=bb;return{sb,bb,hu};
}
async function playHand(t,io){
  const lvlUp=startHand(t);
  await io.handStart?.(lvlUp);
  const {sb,bb,hu}=positions(t);
  t.deck=shuffle([...Array(52).keys()],t.rng);t.dp=0;
  await io.button?.();
  const order=[];let i=nextAlive(t,t.dealer);for(let k=aliveList(t).length;k>0;k--){order.push(i);i=nextAlive(t,i);}
  for(let r=0;r<2;r++)for(const idx of order){const p=t.players[idx];p.cards.push(t.deck[t.dp++]);await io.holeCard?.(p,r);}
  t.boardCards=t.deck.slice(t.dp,t.dp+5);t.dp+=5;
  await io.dealt?.();
  t.currentBet=0;t.raiseId=1;t.minRaise=t.bb;
  if(sb>=0)await postBlind(t,t.players[sb],t.sb,'SB',io);else await io.deadBlind?.();
  await postBlind(t,t.players[bb],t.bb,'BB',io);
  t.currentBet=t.bb;
  await bettingRound(t,hu?sb:nextAlive(t,bb),io);
  for(let st=1;st<=3;st++){
    if(inHandList(t).length<=1)break;
    await collectBets(t,io);
    if(!t.runout&&inHandList(t).length>=2&&canActList(t).length<=1){t.runout=true;await io.runout?.();}
    t.street=st;
    const cards=STREET_CARDS[st].map(k=>t.boardCards[k]);
    await io.deal?.(st,cards);        // the cards are on their way but not yet part of the board…
    t.board.push(...cards);
    await io.street?.(st);            // …and now they are
    if(!t.runout&&canActList(t).length>=2){
      t.currentBet=0;t.minRaise=t.bb;t.raiseId++;t.streetRaises=0;
      await io.newRound?.();
      await bettingRound(t,nextAlive(t,t.dealer),io);
    }
  }
  await collectBets(t,io);
  await resolveHand(t,io);
}
function put(p,amt){amt=Math.min(amt,p.chips);p.chips-=amt;p.bet+=amt;p.total+=amt;if(p.chips===0)p.allIn=true;return amt;}
async function postBlind(t,p,amt,label,io){const a=put(p,amt);await io.blind?.(p,a,label);}
async function collectBets(t,io){
  const bettors=t.players.filter(p=>p.bet>0);if(!bettors.length)return;
  await io.collect?.(bettors);
  bettors.forEach(p=>{t.pot+=p.bet;p.bet=0;});
}

/* ---------------- BETTING ---------------- */
function needsAction(t,p){return !p.out&&!p.folded&&!p.allIn&&(p.lastRaiseId!==t.raiseId||p.bet<t.currentBet);}
// what player p may do now; o.canRaise is false once p has acted since the last full raise
function turnOptions(t,p){
  const toCall=Math.max(0,t.currentBet-p.bet),others=canActList(t).filter(q=>q!==p).length;
  return {toCall,canRaise:p.lastRaiseId!==t.raiseId&&p.chips>toCall&&others>0,minTo:Math.min(p.bet+p.chips,t.currentBet+t.minRaise),maxTo:p.bet+p.chips};
}
async function bettingRound(t,start,io){
  const n=t.players.length;let i=start;
  while(true){
    if(inHandList(t).length<=1)return;
    let found=-1;for(let k=0;k<n;k++){const j=(i+k)%n;if(needsAction(t,t.players[j])){found=j;break;}}
    if(found<0)return;
    const p=t.players[found];
    if(canActList(t).length===1&&p.bet>=t.currentBet)return;
    const o=turnOptions(t,p),ev=applyAction(t,p,await io.decide(p,o),o);
    await io.action?.(p,ev,o);
    i=(found+1)%n;
  }
}
// applies p's chosen action and returns what actually happened: {type, amount put in, prev = the bet faced}
function applyAction(t,p,act,o){
  let type=act.type;
  if((type==='raise'||type==='allin')&&!o.canRaise)type='call';
  if(type==='call'&&o.toCall===0)type='check';
  if(type==='check'&&o.toCall>0)type='fold';
  const ev={type,amount:0,prev:t.currentBet};
  if(type==='fold')p.folded=true;
  else if(type==='call')ev.amount=put(p,o.toCall);
  else if(type==='raise'||type==='allin'){
    const to=type==='allin'?p.bet+p.chips:clamp(act.to,o.minTo,o.maxTo);
    ev.amount=put(p,to-p.bet);
    // only a full raise reopens the betting; a short all-in just raises the price to call
    if(p.bet>t.currentBet){const inc=p.bet-t.currentBet;if(inc>=t.minRaise){t.minRaise=inc;t.raiseId++;}t.currentBet=p.bet;t.streetRaises++;}
  }
  p.lastRaiseId=t.raiseId;
  t.acts.push({id:p.id,st:t.street,type,to:p.bet,prev:ev.prev}); // the hand's public action history
  return ev;
}

/* ---------------- SHOWDOWN / AWARDS ---------------- */
// main pot first, then side pots; a pot only one player can win is an uncalled bet to hand back
function computePots(t){
  const contrib=t.players.filter(p=>p.total>0),live=inHandList(t);
  const levels=[...new Set(live.map(p=>p.total))].sort((a,b)=>a-b);
  const pots=[];let prev=0;
  for(const L of levels){let amt=0;for(const p of contrib)amt+=Math.max(0,Math.min(p.total,L)-prev);
    const elig=live.filter(p=>p.total>=L);if(amt>0)pots.push({amount:amt,eligible:elig});prev=L;}
  const total=contrib.reduce((a,p)=>a+p.total,0),acc=pots.reduce((a,p)=>a+p.amount,0);
  if(total>acc&&pots.length)pots[pots.length-1].amount+=total-acc;
  return pots;
}
// splits a pot between tied winners; odd chips go to the winners closest to the left of the button
function splitPot(t,amount,winners){
  const n=t.players.length,share=Math.floor(amount/winners.length);let rem=amount-share*winners.length;
  return winners.slice().sort((a,b)=>((a.id-t.dealer+n-1)%n)-((b.id-t.dealer+n-1)%n)).map(w=>[w,share+(rem-->0?1:0)]);
}
async function resolveHand(t,io){
  t.street=4;
  const cs=inHandList(t);
  await io.resolve?.(cs);
  if(cs.length===1){const w=cs[0],amt=t.pot;t.pot=0;w.chips+=amt;await io.win?.(w,amt);}
  else{
    for(const p of cs)p.score=evalHand(p.cards.concat(t.board));
    await io.showdown?.(cs);
    const pots=computePots(t),contested=pots.filter(q=>q.eligible.length>1).length;
    for(let k=0;k<pots.length;k++){
      const pot=pots[k];if(pot.amount<=0)continue;
      t.pot-=pot.amount;
      if(pot.eligible.length===1){const o=pot.eligible[0];o.chips+=pot.amount;await io.returned?.(o,pot.amount);continue;}
      const best=Math.max(...pot.eligible.map(p=>p.score)),winners=pot.eligible.filter(p=>p.score===best);
      const pays=splitPot(t,pot.amount,winners);for(const[w,a] of pays)w.chips+=a;
      await io.pot?.(pot,winners,pays,k,contested);
    }
  }
  t.pot=0;
  await io.handEnd?.(cs);
}

/* ---------------- BETWEEN HANDS ---------------- */
// knocks out everyone left with no chips and returns them; players busting in the same hand are
// placed by the stack they started that hand with
function eliminate(t){
  const busted=t.players.filter(p=>!p.out&&p.chips<=0).sort((a,b)=>b.startChips-a.startChips);
  const survivors=aliveList(t).length-busted.length;
  busted.forEach((p,i)=>{p.place=survivors+1+i;p.out=true;});
  return busted;
}
