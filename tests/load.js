'use strict';
// Loads the game's DOM-free scripts the way the browser does (classic scripts sharing one scope)
// and hands back their functions, so tests can drive the real engine without a page.
const fs=require('fs'),path=require('path');
const FILES=['util.js','data.js','engine.js','ai.js'];
const NAMES=['mulberry32','shuffle','evalHand','handCat','describe','bestFive','coreCards','equityVsRandom','multiEquity',
  'START_STACK','HANDS_PER_LEVEL','BLINDS','ROSTER','YOU_CH','STREET_CARDS',
  'inHandList','canActList','aliveList','potTotal','initTable','startHand','positions','playHand','put','turnOptions',
  'applyAction','computePots','splitPot','resolveHand','eliminate','aiDecide'];
const src=FILES.map(f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8')).join('\n;\n');
module.exports=new Function(`${src}\nreturn {${NAMES.join(',')}};`)();

const E=module.exports;
// card helpers for readable tests: c('As') → 51, cs('As Kd') → [51, 37]
const RANKS='23456789TJQKA',SUITS='shdc';
E.c=s=>SUITS.indexOf(s[1])*13+RANKS.indexOf(s[0]);
E.cs=s=>s.split(' ').map(E.c);

// a table of n AI players (personalities cycle through the roster), seeded for both streams
E.table=(n=6,seed=1)=>E.initTable({},Array.from({length:n},(_,i)=>({name:'P'+i,ch:E.ROSTER[i%E.ROSTER.length]})),
  E.mulberry32(seed),E.mulberry32(seed^0x5bd1e995));

// throws unless the AI picked something the rules allow (the engine would quietly repair it otherwise)
E.checkLegal=(o,act)=>{
  const ok=act.type==='fold'||act.type==='check'||act.type==='call'||(o.canRaise&&(act.type==='allin'||(act.type==='raise'&&act.to>=o.minTo&&act.to<=o.maxTo)));
  if(!ok)throw new Error(`illegal action ${JSON.stringify(act)} for ${JSON.stringify(o)}`);
  return act;
};

// plays a whole tournament with the AI deciding for every seat; returns a log of every action,
// checking after each hand that no chips appeared or vanished
E.playTournament=async(t,{maxHands=2000,onHand}={})=>{
  const total=t.players.reduce((a,p)=>a+p.chips,0),log=[];
  const io={decide:(p,o)=>E.checkLegal(o,E.aiDecide(t,p,o)),action:(p,ev)=>{log.push(`${t.handNo}:${p.id}:${ev.type}:${ev.amount}`);}};
  while(E.aliveList(t).length>1&&t.handNo<maxHands){
    await E.playHand(t,io);
    const now=t.players.reduce((a,p)=>a+p.chips,0);
    if(now!==total)throw new Error(`hand ${t.handNo}: chips ${now} != ${total}`);
    E.eliminate(t);onHand&&onHand(t);
  }
  return log;
};
