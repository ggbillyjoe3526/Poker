'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./load.js'),{cs}=E;

// a table whose previous big blind was seat `prevBB`, so this hand's seats are fixed
function seated(stacks,prevBB){
  const t=E.table(stacks.length);
  t.players.forEach((p,i)=>p.chips=stacks[i]);t.bbSeat=prevBB;
  return t;
}
// plays one hand where each decision comes from `script` in turn; returns what each actor was offered
// (extra io hooks can be passed in to watch the hand)
async function play(t,script,io={}){
  const seen=[];
  await E.playHand(t,{...io,decide:(p,o)=>{
    seen.push({id:p.id,street:t.street,...o});
    if(!script.length)throw new Error(`script ran out when seat ${p.id} had to act`);
    return script.shift();
  }});
  assert.equal(script.length,0,'every scripted action should be used');
  return seen;
}
const total=t=>t.players.reduce((a,p)=>a+p.chips,0);
const fold={type:'fold'},check={type:'check'},call={type:'call'},allin={type:'allin'},raise=to=>({type:'raise',to});

/* ---------------- positions and blinds ---------------- */
test('first hand: the seed picks the button, then small and big blind follow it',()=>{
  const t=E.table(6,9),{sb,bb}=E.positions(t);
  assert.equal(sb,(t.dealer+1)%6);
  assert.equal(bb,(t.dealer+2)%6);
  assert.equal(E.table(6,9).rng(),E.table(6,9).rng(),'same seed, same stream');
});

test('the blinds move one seat each hand',()=>{
  const t=seated([1500,1500,1500,1500],1);
  assert.deepEqual({...E.positions(t),dealer:t.dealer},{sb:1,bb:2,hu:false,dealer:0});
  assert.deepEqual({...E.positions(t),dealer:t.dealer},{sb:2,bb:3,hu:false,dealer:1});
});

test('after a bust nobody skips the big blind: a dead small blind is used instead',()=>{
  const t=seated([1500,1500,0,1500],2);t.players[2].out=true; // seat 2 posted the big blind, then busted
  assert.deepEqual({...E.positions(t),dealer:t.dealer},{sb:-1,bb:3,hu:false,dealer:1});
  assert.deepEqual({...E.positions(t),dealer:t.dealer},{sb:3,bb:0,hu:false,dealer:1});
  assert.deepEqual({...E.positions(t),dealer:t.dealer},{sb:0,bb:1,hu:false,dealer:3});
});

test('blinds go up every HANDS_PER_LEVEL hands',()=>{
  const t=E.table(6);
  for(let i=0;i<E.HANDS_PER_LEVEL;i++)assert.equal(E.startHand(t),false);
  assert.equal(E.startHand(t),true);
  assert.deepEqual([t.sb,t.bb],[...E.BLINDS[1]]);
});

/* ---------------- betting ---------------- */
test('heads-up: the button posts the small blind and acts first before the flop, last after it',async()=>{
  const t=seated([1500,1500],0),seen=await play(t,[call,check, check,check, check,check, check,check]);
  assert.equal(t.dealer,0);
  assert.deepEqual(seen.map(s=>`${s.street}:${s.id}`),['0:0','0:1','1:1','1:0','2:1','2:0','3:1','3:0']);
  assert.equal(total(t),3000);
});

test('when everyone limps, the big blind still gets the option to raise',async()=>{
  const t=seated([1500,1500,1500],0),seen=await play(t,[call,call,check, ...Array(9).fill(check)]);
  assert.deepEqual(seen.slice(0,3).map(s=>s.id),[2,0,1]);
  assert.equal(seen[2].toCall,0);
  assert.equal(seen[2].canRaise,true);
  assert.deepEqual(seen.slice(3,6).map(s=>s.id),[0,1,2],'after the flop the seat left of the button starts');
});

test('a raise must be at least the size of the last raise',async()=>{
  const t=seated([1500,1500,1500],0),seen=await play(t,[raise(60),fold,fold]);
  assert.deepEqual([seen[0].minTo,seen[1].minTo],[40,100]);
  assert.equal(seen[1].toCall,50);
  assert.deepEqual(t.players.map(p=>p.chips),[1490,1480,1530]);
});

test('a short all-in raise does not reopen the betting for players who already acted',async()=>{
  // seat 0 posts the small blind and only has 130 chips
  const t=seated([130,1500,1500],0),seen=await play(t,[raise(100),allin,call,call, check,check, check,check, check,check]);
  const again=seen[3];
  assert.equal(again.id,2);
  assert.equal(again.toCall,30);
  assert.equal(again.canRaise,false);
  assert.equal(seen[2].canRaise,true,'the big blind had not acted on the raise yet, so it may still re-raise');
  assert.equal(total(t),3130);
});

test('every street after the flop opens with a minimum bet of one big blind',async()=>{
  const t=seated([1500,1500,1500],0),seen=await play(t,[raise(100),call,call, ...Array(9).fill(check)]);
  const flop=seen[3];
  assert.deepEqual([flop.street,flop.id,flop.toCall,flop.minTo],[1,0,0,20]);
});

test('nobody can raise when everyone else is all in, and the board then runs out once',async()=>{
  // the button and the small blind are all in for 100 each; the big blind can only call or fold
  let runouts=0;
  const t=seated([100,1500,100],0),seen=await play(t,[allin,allin,call],{runout:()=>{runouts++;}});
  assert.deepEqual([seen[2].id,seen[2].toCall,seen[2].canRaise],[1,80,false]);
  assert.equal(runouts,1);
  assert.equal(t.board.length,5);
  assert.equal(total(t),1700);
});

test('when everyone folds, the big blind wins the blinds',async()=>{
  const t=seated([1500,1500,1500],0);
  await play(t,[fold,fold]);
  assert.deepEqual(t.players.map(p=>p.chips),[1490,1510,1500]);
});

test('a raise the player may not make is treated as a call',()=>{
  const t=seated([1500,1500],0);E.startHand(t);
  const p=t.players[0],ev=E.applyAction(t,p,raise(400),{toCall:50,canRaise:false,minTo:150,maxTo:1500});
  assert.deepEqual({...ev},{type:'call',amount:50,prev:0});
});

/* ---------------- pots ---------------- */
function potTable(totals,folded=[]){
  const t=E.table(totals.length);E.startHand(t);
  t.players.forEach((p,i)=>{p.total=totals[i];p.chips-=totals[i];p.folded=folded.includes(i);});
  t.pot=totals.reduce((a,b)=>a+b,0);
  return t;
}
const potsOf=t=>E.computePots(t).map(q=>({amount:q.amount,eligible:q.eligible.map(p=>p.id)}));

test('side pots: a short all-in can only win what each player matched',()=>{
  // seat 3 put in 50 and folded; seat 0 is all-in for 100
  assert.deepEqual(potsOf(potTable([100,300,300,50],[3])),[{amount:350,eligible:[0,1,2]},{amount:400,eligible:[1,2]}]);
});

test('an uncalled bet is a pot only its bettor can win',()=>{
  assert.deepEqual(potsOf(potTable([500,300])),[{amount:600,eligible:[0,1]},{amount:200,eligible:[0]}]);
});

test('showdown pays the main pot and the side pot to different players',async()=>{
  const t=potTable([100,300,300]);t.dealer=0;
  t.board=cs('2c 7d 9h Js 3s');
  [t.players[0].cards,t.players[1].cards,t.players[2].cards]=[cs('As Ah'),cs('Ks Kh'),cs('Qs Qh')];
  const before=t.players.map(p=>p.chips);
  await E.resolveHand(t,{});
  assert.deepEqual(t.players.map((p,i)=>p.chips-before[i]),[300,400,0]);
  assert.equal(t.pot,0);
});

test('a split pot gives the odd chip to the winner closest left of the button',()=>{
  const t=E.table(4);t.dealer=2;
  const pays=E.splitPot(t,25,[t.players[1],t.players[3]]).map(([w,a])=>[w.id,a]);
  assert.deepEqual(pays,[[3,13],[1,12]]);
  // the button itself is last in line for the odd chip
  t.dealer=1;
  assert.deepEqual(E.splitPot(t,25,[t.players[1],t.players[2]]).map(([w,a])=>[w.id,a]),[[2,13],[1,12]]);
});

test('when the board plays, everyone still in splits the pot',async()=>{
  const t=potTable([200,200,200],[2]);t.dealer=0;
  t.board=cs('As Ks Qs Js Ts');
  [t.players[0].cards,t.players[1].cards]=[cs('2c 3d'),cs('4h 5c')];
  const before=t.players.map(p=>p.chips);
  await E.resolveHand(t,{});
  assert.deepEqual(t.players.map((p,i)=>p.chips-before[i]),[300,300,0]);
});

/* ---------------- eliminations ---------------- */
test('players busting in the same hand are placed by the stack they started it with',()=>{
  const t=E.table(4);E.startHand(t);
  t.players[1].startChips=200;t.players[2].startChips=500; // the later seat started with more
  t.players[1].chips=0;t.players[2].chips=0;
  const out=E.eliminate(t);
  assert.deepEqual(out.map(p=>[p.id,p.place]),[[2,3],[1,4]]);
  assert.ok(out.every(p=>p.out));
  assert.equal(E.aliveList(t).length,2);
});
