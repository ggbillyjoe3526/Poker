'use strict';
// Plays whole computer-only tournaments with no page, to tune the opponents:
//   npm run sim                   both reports below, 200 tournaments each
//   node tools/sim.js styles 500  how each personality places when everyone plays on Normal
//   node tools/sim.js levels 500  each difficulty level against the others, same personalities on both sides
//   node tools/sim.js leaks 500   how hard each level punishes a player who folds too much or calls too much
// A tournament is seeded, so the same count always gives the same numbers.
const E=require('../tests/load.js');

// one tournament: `players` are {ch, diff}; returns each player's finishing place (1 = winner)
async function tournament(players,seed){
  const t=E.initTable({},players.map(p=>({name:p.ch.name,ch:p.ch,diff:p.diff})),E.mulberry32(seed),E.mulberry32(seed^0x5bd1e995));
  const io={decide:(p,o)=>E.aiDecide(t,p,o)};
  while(E.aliveList(t).length>1&&t.handNo<3000){await E.playHand(t,io);E.eliminate(t);}
  return t.players.map(p=>p.out?p.place:1);
}

// six of the eight personalities each time, all on one level
async function styles(n,diff='normal',from=1){
  const S=Object.fromEntries(E.ROSTER.map(ch=>[ch.name,{games:0,place:0,wins:0}]));
  for(let seed=from;seed<from+n;seed++){
    const chs=E.shuffle(E.ROSTER.slice(),E.mulberry32(seed*31+7)).slice(0,6);
    (await tournament(chs.map(ch=>({ch,diff})),seed)).forEach((pl,i)=>{const s=S[chs[i].name];s.games++;s.place+=pl;if(pl===1)s.wins++;});
  }
  return S;
}

// three personalities, each seated twice: once on level a and once on level b (seats alternate by seed)
async function levels(n,a,b,from=1){
  const L={[a]:{place:0,wins:0},[b]:{place:0,wins:0}};
  for(let seed=from;seed<from+n;seed++){
    const chs=E.shuffle(E.ROSTER.slice(),E.mulberry32(seed*31+7)).slice(0,3);
    const players=Array.from({length:6},(_,i)=>({ch:chs[i>>1],diff:(i+seed)%2?b:a}));
    (await tournament(players,seed)).forEach((pl,i)=>{const s=L[players[i].diff];s.place+=pl/(3*n);if(pl===1)s.wins++;});
  }
  return L;
}

// a leaky human-like player in seat 0 against five computer players on one level: how many big blinds
// per hand it loses tells how hard that level punishes the leak. Bots: plays only good hands before the
// flop, then "folder" folds anything less than two pair to a bet, "caller" calls down with any pair
const pre=(t,p,o)=>{const s=E.preStrength(...p.cards);if(s>0.9&&o.canRaise)return{type:'raise',to:Math.min(o.maxTo,Math.max(o.minTo,t.currentBet*3))};
  if(s>0.72&&o.toCall<=p.chips*0.15)return{type:'call'};return o.toCall?{type:'fold'}:{type:'check'};};
const made=(p,t)=>E.handCat(E.evalHand(p.cards.concat(t.board)));
const betPot=(t,o)=>({type:'raise',to:Math.min(o.maxTo,t.currentBet+Math.round(E.potTotal(t)*0.6))});
const BOTS={
  folder:(t,p,o)=>t.street===0?pre(t,p,o):o.toCall===0?(made(p,t)>=2&&o.canRaise?betPot(t,o):{type:'check'}):made(p,t)>=2?{type:'call'}:{type:'fold'},
  caller:(t,p,o)=>t.street===0?pre(t,p,o):o.toCall===0?(made(p,t)>=3&&o.canRaise?betPot(t,o):{type:'check'}):made(p,t)>=1||t.street<3?{type:'call'}:{type:'fold'},
};
async function leaks(n,bot,diff,from=1){
  let net=0,hands=0;
  for(let seed=from;seed<from+n;seed++){
    const chs=E.shuffle(E.ROSTER.slice(),E.mulberry32(seed*31+7)).slice(0,5);
    const t=E.initTable({},[{name:'Bot',ch:{ai:{}},bot:true}].concat(chs.map(ch=>({name:ch.name,ch,diff}))),E.mulberry32(seed),E.mulberry32(seed^0x5bd1e995));
    const io={decide:(p,o)=>p.bot?BOTS[bot](t,p,o):E.aiDecide(t,p,o)};
    while(E.aliveList(t).length>1&&t.handNo<3000){
      const b=t.players[0],before=b.chips,live=!b.out&&E.aliveList(t).length>=4; // full-ish tables only
      await E.playHand(t,io);if(live){net+=(b.chips-before)/t.bb;hands++;}E.eliminate(t);
    }
  }
  return net/hands;
}

if(require.main===module)(async()=>{
  const what=process.argv[2]||'all',n=+process.argv[3]||200;
  if(what==='all'||what==='styles'){
    const S=await styles(n);
    console.log(`Personalities on Normal, ${n} tournaments of six (fair share: place 3.50, wins 16.7%)`);
    for(const[name,s] of Object.entries(S).sort((x,y)=>x[1].place/x[1].games-y[1].place/y[1].games))
      console.log(`  ${name.padEnd(8)} place ${(s.place/s.games).toFixed(2)}  wins ${(s.wins/s.games*100).toFixed(1).padStart(4)}%  (${s.games} games)`);
  }
  if(what==='all'||what==='levels'){
    console.log(`Difficulty levels head to head, ${n} tournaments each (average place, lower is better)`);
    for(const[a,b] of [['easy','normal'],['normal','hard'],['easy','hard']]){
      const L=await levels(n,a,b);
      console.log(`  ${a.padEnd(6)} ${L[a].place.toFixed(2)} vs ${b.padEnd(6)} ${L[b].place.toFixed(2)}   wins ${L[a].wins} to ${L[b].wins}`);
    }
  }
  if(what==='all'||what==='leaks'){
    console.log(`A leaky player against each level, ${n} tournaments each (big blinds the player wins per hand)`);
    for(const bot of Object.keys(BOTS))
      console.log(`  ${bot.padEnd(6)} `+(await Promise.all(['easy','normal','hard'].map(async d=>`${d} ${(await leaks(n,bot,d)).toFixed(2).padStart(5)}`))).join('   '));
  }
})();

module.exports={tournament,styles,levels,leaks};
