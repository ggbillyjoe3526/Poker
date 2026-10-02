'use strict';
/* ===== RNG: seeded streams for anything that must replay, Math.random for cosmetics ===== */
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const mpick=a=>a[Math.floor(Math.random()*a.length)];
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('en-US');

/* ===== Cards ===== */
// card = 0..51 ; rank = c%13 (0 = deuce .. 12 = ace) ; suit = c/13|0 (0♠ 1♥ 2♦ 3♣)
const RANK_LABEL=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_NAME=['Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Jack','Queen','King','Ace'];
const RANK_PLURAL=['Twos','Threes','Fours','Fives','Sixes','Sevens','Eights','Nines','Tens','Jacks','Queens','Kings','Aces'];
const SUITS=['♠','♥','♦','♣'];
const HAND_NAMES=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
const rankOf=c=>c%13, suitOf=c=>(c/13)|0;
const cardStr=c=>RANK_LABEL[c%13]+SUITS[(c/13)|0];

/* ===== Hand evaluation (5–7 cards) → comparable integer ===== */
const B5=371293; // 13^5
function straightHigh(m){for(let h=12;h>=4;h--){const b=0x1F<<(h-4);if((m&b)===b)return h;}return((m&0x100F)===0x100F)?3:-1;}
function mk(cat,a,b,c,d,e){return cat*B5+((((a||0)*13+(b||0))*13+(c||0))*13+(d||0))*13+(e||0);}
const _rc=new Array(13);
function evalHand(cards){
  const rc=_rc; rc.fill(0);
  const sc=[0,0,0,0], sm=[0,0,0,0]; let mask=0;
  for(let i=0;i<cards.length;i++){const c=cards[i],r=c%13,s=(c/13)|0;rc[r]++;sc[s]++;sm[s]|=1<<r;mask|=1<<r;}
  let fs=-1; for(let s=0;s<4;s++) if(sc[s]>=5) fs=s;
  if(fs>=0){const h=straightHigh(sm[fs]); if(h>=0) return mk(8,h);}
  let quad=-1; const trips=[],pairs=[],singles=[];
  for(let r=12;r>=0;r--){const n=rc[r]; if(n===4)quad=r; else if(n===3)trips.push(r); else if(n===2)pairs.push(r); else if(n===1)singles.push(r);}
  if(quad>=0){let k=-1;for(let r=12;r>=0;r--) if(r!==quad&&rc[r]>0){k=r;break;} return mk(7,quad,k);}
  if(trips.length&&(trips.length>1||pairs.length)){const p=Math.max(trips.length>1?trips[1]:-1,pairs.length?pairs[0]:-1);return mk(6,trips[0],p);}
  if(fs>=0){const rs=[];for(let r=12;r>=0&&rs.length<5;r--) if((sm[fs]>>r)&1) rs.push(r); return mk(5,rs[0],rs[1],rs[2],rs[3],rs[4]);}
  const sh=straightHigh(mask); if(sh>=0) return mk(4,sh);
  if(trips.length) return mk(3,trips[0],singles[0],singles[1]);
  if(pairs.length>=2){const k=Math.max(pairs.length>2?pairs[2]:-1,singles.length?singles[0]:-1);return mk(2,pairs[0],pairs[1],k);}
  if(pairs.length===1) return mk(1,pairs[0],singles[0],singles[1],singles[2]);
  return mk(0,singles[0],singles[1],singles[2],singles[3],singles[4]);
}
const handCat=s=>Math.floor(s/B5);
function scoreDigits(s){const d=[];let x=s%B5;for(let i=0;i<5;i++){d.unshift(x%13);x=Math.floor(x/13);}return d;}
function describe(s){
  const c=handCat(s),d=scoreDigits(s);
  switch(c){
    case 8: return d[0]===12?'Royal Flush':`Straight Flush, ${RANK_NAME[d[0]]}-high`;
    case 7: return `Four ${RANK_PLURAL[d[0]]}`;
    case 6: return `Full House, ${RANK_PLURAL[d[0]]} over ${RANK_PLURAL[d[1]]}`;
    case 5: return `Flush, ${RANK_NAME[d[0]]}-high`;
    case 4: return `Straight, ${RANK_NAME[d[0]]}-high`;
    case 3: return `Three ${RANK_PLURAL[d[0]]}`;
    case 2: return `Two Pair, ${RANK_PLURAL[d[0]]} & ${RANK_PLURAL[d[1]]}`;
    case 1: return `Pair of ${RANK_PLURAL[d[0]]}`;
    default: return `${RANK_NAME[d[0]]}-High`;
  }
}
function shortName(s){const c=handCat(s);if(c===8&&scoreDigits(s)[0]===12)return'Royal Flush';return HAND_NAMES[c];}
function bestFive(cards){
  if(cards.length<=5) return cards.slice();
  let best=-1,bc=null;const n=cards.length,cur=[];
  (function rec(st){if(cur.length===5){const s=evalHand(cur);if(s>best){best=s;bc=cur.slice();}return;}for(let i=st;i<=n-(5-cur.length);i++){cur.push(cards[i]);rec(i+1);cur.pop();}})(0);
  return bc;
}
// the cards that "make" the hand (for highlighting)
function coreCards(five,score){
  const c=handCat(score);
  if(c===4||c===5||c===6||c===8) return five.slice();
  if(c===0){let b=five[0];for(const x of five) if(x%13>b%13) b=x; return [b];}
  const cnt={};for(const x of five) cnt[x%13]=(cnt[x%13]||0)+1;
  return five.filter(x=>cnt[x%13]>=2);
}
function preflopLabel(a,b){
  const ra=a%13,rb=b%13; if(ra===rb) return `Pocket ${RANK_PLURAL[ra]}`;
  const hi=Math.max(ra,rb),lo=Math.min(ra,rb);
  return `${RANK_LABEL[hi]}-${RANK_LABEL[lo]} ${suitOf(a)===suitOf(b)?'suited':'offsuit'}`;
}

/* ===== Equity (Monte Carlo) ===== */
function equityVsRandom(hole,board,nOpp,iters,rng=Math.random){
  if(nOpp<=0) return 1;
  const used=new Set(hole.concat(board)); const deck=[];
  for(let c=0;c<52;c++) if(!used.has(c)) deck.push(c);
  const need=5-board.length, k=need+2*nOpp; let win=0;
  const my=hole.concat(board), op=new Array(7);
  for(let it=0;it<iters;it++){
    for(let i=0;i<k;i++){const j=i+Math.floor(rng()*(deck.length-i));const t=deck[i];deck[i]=deck[j];deck[j]=t;}
    const full=my.slice(); for(let i=0;i<need;i++) full.push(deck[i]);
    const ms=evalHand(full);
    let ties=0,lose=false;
    for(let o=0;o<nOpp;o++){
      op.length=0; op.push(deck[need+2*o],deck[need+2*o+1]);
      for(let i=0;i<board.length;i++) op.push(board[i]);
      for(let i=0;i<need;i++) op.push(deck[i]);
      const os=evalHand(op); if(os>ms){lose=true;break;} if(os===ms) ties++;
    }
    if(!lose) win+=1/(ties+1);
  }
  return win/iters;
}
// equity for several known hands (all-in runouts). exact when ≤2 cards to come
function multiEquity(hands,board){
  const used=new Set(board); hands.forEach(h=>h.forEach(c=>used.add(c)));
  const deck=[]; for(let c=0;c<52;c++) if(!used.has(c)) deck.push(c);
  const need=5-board.length, eq=hands.map(()=>0); let total=0;
  const score=(extra)=>{
    const b=board.concat(extra); let best=-1,w=[];
    hands.forEach((h,i)=>{const s=evalHand(h.concat(b));if(s>best){best=s;w=[i];}else if(s===best)w.push(i);});
    w.forEach(i=>eq[i]+=1/w.length); total++;
  };
  if(need===0) score([]);
  else if(need===1) for(const a of deck) score([a]);
  else if(need===2) for(let i=0;i<deck.length;i++) for(let j=i+1;j<deck.length;j++) score([deck[i],deck[j]]);
  else for(let it=0;it<1500;it++){
    for(let i=0;i<need;i++){const j=i+Math.floor(Math.random()*(deck.length-i));const t=deck[i];deck[i]=deck[j];deck[j]=t;}
    score(deck.slice(0,need));
  }
  return eq.map(v=>v/total);
}
