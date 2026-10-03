'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./load.js'),{c,cs}=E;

// the average preflop strength of a range, weighted
const avgStrength=w=>{let s=0,n=0;E.COMBOS.forEach(([a,b],i)=>{s+=w[i]*E.preStrength(a,b);n+=w[i];});return s/n;};
// a heads-up table mid-hand: seat 0 is the AI deciding, seat 1 the opponent whose actions are `acts`
function spot({hole,villain,board='',acts=[],toCall=0,pot=0,seed=1,ch=E.ROSTER[5]}){
  const t=E.table(2,seed);E.startHand(t);
  const[p,q]=t.players;p.ch=ch;
  p.cards=cs(hole);q.cards=cs(villain);t.board=board?cs(board):[];t.street=[0,0,0,1,2,3][t.board.length];
  t.acts=acts;t.pot=pot;q.bet=toCall;t.currentBet=toCall;
  return{t,p,o:{toCall,canRaise:true,minTo:toCall*2||t.bb,maxTo:p.chips}};
}

test('preflop strength ranks aces first and seven-deuce offsuit near the bottom',()=>{
  const s=h=>E.preStrength(...cs(h));
  assert.ok(s('As Ah')>s('Ks Kh'));
  assert.ok(s('As Ks')>s('Ad Kc'),'suited beats offsuit');
  assert.ok(s('Ad Kc')>s('7s 7h'));
  assert.ok(s('7c 2d')<0.06);
  assert.ok(s('As Ah')>0.99);
});

test('each preflop raise narrows the range to stronger hands',()=>{
  const t=E.table(3);E.startHand(t);
  const q=t.players[0],r=()=>avgStrength(E.readRange(t,q));
  const all=r();
  t.acts=[{id:0,st:0,type:'call',to:20,prev:20}];const limp=r();
  t.acts=[{id:0,st:0,type:'raise',to:60,prev:20}];const open=r();
  t.acts=[{id:0,st:0,type:'raise',to:60,prev:20},{id:1,st:0,type:'raise',to:180,prev:60},{id:0,st:0,type:'raise',to:450,prev:180}];const four=r();
  assert.ok(all<limp&&limp<open&&open<four,`${all} < ${limp} < ${open} < ${four}`);
  assert.ok(four>0.95,'a four-bet is mostly big pairs and big aces');
});

test('a range that only holds aces leaves kings about 18% to win',()=>{
  const aa=new Float64Array(1326);E.COMBOS.forEach(([a,b],i)=>{if(a%13===12&&b%13===12)aa[i]=1;});
  const eq=E.rangeEquity(cs('Ks Kh'),[],[aa],4000,E.mulberry32(3));
  assert.ok(Math.abs(eq-0.18)<0.025,`got ${eq}`);
  // and a range with no possible hands falls back to random cards rather than failing
  const none=E.rangeEquity(cs('Ks Kh'),[],[new Float64Array(1326)],2000,E.mulberry32(3));
  assert.ok(Math.abs(none-0.82)<0.03,`got ${none}`);
});

test('betting into a board makes strong hands more likely than checking',()=>{
  const t=E.table(2);E.startHand(t);t.board=cs('Kd 7c 2h');t.street=1;
  const q=t.players[1],str=E.boardStrength(t,t.board);
  const avg=w=>{let s=0,n=0;for(let i=0;i<1326;i++){s+=w[i]*str[i];n+=w[i];}return s/n;};
  t.acts=[{id:1,st:1,type:'check',to:0,prev:0}];const checked=avg(E.readRange(t,q));
  t.acts=[{id:1,st:1,type:'raise',to:40,prev:0}];const bet=avg(E.readRange(t,q));
  t.acts=[{id:0,st:1,type:'raise',to:40,prev:0},{id:1,st:1,type:'raise',to:120,prev:40}];const raised=avg(E.readRange(t,q));
  assert.ok(checked<bet&&bet<raised,`${checked} < ${bet} < ${raised}`);
});

test('flush and straight draws count as decent hands before the river',()=>{
  const t=E.table(2);E.startHand(t);
  const flop=cs('Kh 7h 2c'),str=E.boardStrength(t,flop),at=h=>str[E.COMBOS.findIndex(([a,b])=>a===Math.min(...cs(h))&&b===Math.max(...cs(h)))];
  assert.ok(at('Ah 4h')>=0.7,'nut flush draw');
  assert.ok(at('9s 3d')<0.3,'nothing');
  const river=E.boardStrength(t,cs('Kh 7h 2c 9d 4s'));
  assert.ok(river[E.COMBOS.findIndex(([a,b])=>a===c('5h')&&b===c('6h'))]<0.4,'a missed draw is worth nothing on the river');
});

test('the AI calls a river bet less often when the bettor has shown strength all hand',()=>{
  const board='Qs 8d 3c 5h 2s',bet={toCall:400,pot:800};
  const weak=[{id:1,st:0,type:'call',to:20,prev:20},{id:1,st:1,type:'check',to:0,prev:0},{id:1,st:2,type:'check',to:0,prev:0},{id:1,st:3,type:'raise',to:400,prev:0}];
  const strong=[{id:1,st:0,type:'raise',to:60,prev:20},{id:0,st:0,type:'raise',to:180,prev:60},{id:1,st:0,type:'raise',to:450,prev:180},
    {id:1,st:1,type:'raise',to:300,prev:0},{id:1,st:2,type:'raise',to:600,prev:0},{id:1,st:3,type:'raise',to:400,prev:0}];
  const calls=acts=>{let n=0;for(let seed=1;seed<=30;seed++){const{t,p,o}=spot({hole:'Qh Jd',villain:'Ac Ad',board,acts,...bet,seed});
    if(E.checkLegal(o,E.aiDecide(t,p,o)).type!=='fold')n++;}return n;};
  const vsWeak=calls(weak),vsStrong=calls(strong);
  assert.ok(vsWeak>=25,`top pair should call a player who checked twice (${vsWeak}/30)`);
  assert.ok(vsStrong<=8,`but not one who four-bet and fired every street (${vsStrong}/30)`);
});
