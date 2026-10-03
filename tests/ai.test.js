'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./load.js'),{c,cs}=E;

// the average preflop strength of a range, weighted
const avgStrength=w=>{let s=0,n=0;E.COMBOS.forEach(([a,b],i)=>{s+=w[i]*E.preStrength(a,b);n+=w[i];});return s/n;};
// a heads-up table mid-hand: seat 0 is the AI deciding, seat 1 the opponent whose actions are `acts`
function spot({hole,villain,board='',acts=[],toCall=0,pot=0,seed=1,ch=E.ROSTER[5]}){
  const t=E.table(2,seed);E.startHand(t);E.positions(t);
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
  assert.ok(four>0.8,'a four-bet is mostly big pairs and big aces');
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
  const calls=(hole,acts)=>{let n=0;for(let seed=1;seed<=30;seed++){const{t,p,o}=spot({hole,villain:'Ac Ad',board,acts,...bet,seed});
    if(E.checkLegal(o,E.aiDecide(t,p,o)).type!=='fold')n++;}return n;};
  const vsWeak=calls('9c 8c',weak),vsStrong=calls('9c 8c',strong);
  assert.ok(vsWeak>=25,`middle pair should call a player who checked twice (${vsWeak}/30)`);
  assert.ok(vsStrong<=5,`but not one who four-bet and fired every street (${vsStrong}/30)`);
  assert.ok(calls('Kh Kd',strong)>=25,'kings still call: it reads the range, it does not just fold to pressure');
});

// a six-seat table before the flop, with the AI in `seat`; seat 0 has the button, 1 and 2 the blinds.
// `acts` are what happened before the AI's turn (raises carry the total bet in `to`)
function preSpot({hole,seat,bbs=100,stacks={},acts=[],seed=1,ch=E.ROSTER[2]}){
  const t=E.table(6,seed);t.bbSeat=1;E.startHand(t);E.positions(t);
  t.players.forEach(p=>{p.chips=(stacks[p.id]||bbs)*t.bb;p.startChips=p.chips;});
  for(const[i,blind] of [[1,t.sb],[2,t.bb]]){const q=t.players[i],b=Math.min(blind,q.chips);q.chips-=b;q.bet=b;q.total=b;q.allIn=q.chips===0;}
  t.currentBet=t.bb;t.minRaise=t.bb;t.raiseId=1;
  for(const a of acts){const q=t.players[a.id];if(a.type==='fold')q.folded=true;else{const d=a.to-q.bet;q.chips-=d;q.bet=a.to;q.total+=d;q.allIn=q.chips===0;t.currentBet=Math.max(t.currentBet,a.to);}}
  t.acts=acts.map(a=>({st:0,prev:20,...a}));const p=t.players[seat];p.ch=ch;p.cards=cs(hole);
  return{t,p,o:E.turnOptions(t,p)};
}
// how often each action is chosen in a spot over 20 seeds
const decide=spot=>{const n={};for(let seed=1;seed<=20;seed++){const{t,p,o}=preSpot({...spot,seed});const a=E.checkLegal(o,E.aiDecide(t,p,o)).type;n[a]=(n[a]||0)+1;}return n;};
const folds=ids=>ids.map(id=>({id,type:'fold',to:0}));
const DAVID=E.ROSTER[5]; // the tightest personality

test('facing a 4-bet a tight player continues with big pairs and ace-king and folds the rest',()=>{
  // seat 3 opened, the AI on the button three-bet, seat 3 four-bet to 450 (100 big blinds deep)
  const acts=[{id:3,type:'raise',to:60},...folds([4,5]),{id:0,type:'raise',to:180,prev:60},...folds([1,2]),{id:3,type:'raise',to:450,prev:180}];
  for(const hole of ['Qc Qd','Kc Kd','Ac Kd']){const n=decide({hole,seat:0,acts,ch:DAVID});assert.ok((n.fold||0)<=6,`${hole}: ${JSON.stringify(n)}`);}
  for(const hole of ['Kc 9d','Ac 2d','9s 8s']){const n=decide({hole,seat:0,acts,ch:DAVID});assert.ok((n.fold||0)>=16,`${hole}: ${JSON.stringify(n)}`);}
});

test('a deep 4-bet jam gets called by queens or better but not by ace-jack or sevens',()=>{
  const acts=[{id:3,type:'raise',to:60},...folds([4,5]),{id:0,type:'raise',to:180,prev:60},...folds([1,2]),{id:3,type:'allin',to:2000,prev:180}];
  for(const hole of ['Qc Qd','Ac Ad']){const n=decide({hole,seat:0,acts,ch:DAVID});assert.ok((n.call||0)>=16,`${hole}: ${JSON.stringify(n)}`);}
  for(const hole of ['Ac Jd','7c 7d']){const n=decide({hole,seat:0,acts,ch:DAVID});assert.ok((n.fold||0)>=16,`${hole}: ${JSON.stringify(n)}`);}
});

test('a deep stack does not shove over a short all-in while deep players wait behind',()=>{
  // the button moves in for 8 big blinds; the AI in the small blind has 100, so does the big blind
  for(const hole of ['Kc 6d','Qc 9d','Kc Td']){
    const n=decide({hole,seat:1,stacks:{0:8},acts:[...folds([3,4,5]),{id:0,type:'allin',to:160}],ch:DAVID});
    assert.ok(!n.allin,`${hole}: ${JSON.stringify(n)}`);
  }
});

test("a short stack's jam reads much wider than a deep stack's 3-bet",()=>{
  const t=E.table(3);E.startHand(t);
  const q=t.players[1],acts=[{id:0,st:0,type:'raise',to:60,prev:20},{id:1,st:0,type:'allin',to:200,prev:60}];
  q.startChips=200;t.acts=acts;const jam=avgStrength(E.readRange(t,q));
  q.startChips=4000;t.acts=[acts[0],{id:1,st:0,type:'raise',to:180,prev:60}];const threeBet=avgStrength(E.readRange(t,q));
  assert.ok(jam<threeBet-0.03,`10 BB jam ${jam} vs 3-bet ${threeBet}`);
});

test('opponents whose ranges overlap are still dealt distinct cards',()=>{
  // two aces-only ranges but the AI holds an ace: only one of them can really have aces
  const aa=new Float64Array(1326);E.COMBOS.forEach(([a,b],i)=>{if(a%13===12&&b%13===12)aa[i]=1;});
  const eq=E.rangeEquity(cs('As Kd'),[],[aa,aa],2000,E.mulberry32(5));
  assert.ok(eq>0.03&&eq<0.15,`got ${eq}`);
  assert.equal(eq,E.rangeEquity(cs('As Kd'),[],[aa,aa],2000,E.mulberry32(5)),'and the same seed gives the same answer');
});

/* ---------------- position and short stacks ---------------- */
test('push/fold widths grow as the stack shrinks and as fewer players are left to act',()=>{
  assert.ok(E.pushWidth(5,5)>E.pushWidth(10,5)&&E.pushWidth(10,5)>E.pushWidth(15,5));
  assert.ok(E.pushWidth(10,1)>E.pushWidth(10,2)&&E.pushWidth(10,2)>E.pushWidth(10,5));
  assert.equal(E.pushWidth(3,1),1,'the small blind shoves any two cards with 3 big blinds');
});

test('the same hand opens from the button but folds under the gun',()=>{
  const at=(seat,before)=>decide({hole:'Kd 9c',seat,acts:folds(before)});
  const utg=at(3,[]),btn=at(0,[3,4,5]);
  assert.ok((utg.fold||0)>=16,`UTG: ${JSON.stringify(utg)}`);
  assert.ok((btn.raise||0)+(btn.allin||0)>=16,`button: ${JSON.stringify(btn)}`);
});

test('with 8 big blinds the AI shoves or folds, wider from the button than under the gun',()=>{
  const at=(seat,before)=>decide({hole:'Qd 8c',seat,bbs:8,acts:folds(before)});
  const utg=at(3,[]),btn=at(0,[3,4,5]);
  assert.deepEqual(Object.keys(utg).concat(Object.keys(btn)).filter(k=>k!=='fold'&&k!=='allin'),[]);
  assert.ok((utg.fold||0)>=16&&(btn.allin||0)>=16,`UTG ${JSON.stringify(utg)}, button ${JSON.stringify(btn)}`);
});

test('a shove from a short stack is called wider than a shove from a deep one',()=>{
  // seat 3 (under the gun) moves all in; the big blind holds ace-nine
  const calls=bbs=>decide({hole:'Ah 9c',seat:2,bbs,acts:[{id:3,type:'allin',to:bbs*20},...folds([4,5,0,1])]}).call||0;
  assert.ok(calls(6)>=16,`6 BB shove: ${calls(6)}/20 calls`);
  assert.ok(calls(40)<=4,`40 BB shove: ${calls(40)}/20 calls`);
});

test('an open reads wider from the button than from under the gun',()=>{
  const t=E.table(6);t.bbSeat=1;E.startHand(t);E.positions(t);
  const read=id=>{t.acts=[{id,st:0,type:'raise',to:60,prev:20}];return avgStrength(E.readRange(t,t.players[id]));};
  assert.ok(read(3)>read(0)+0.05,`under the gun ${read(3)}, button ${read(0)}`);
});

test('in a limped pot the big blind raise is read as a real range, so limpers fight back with good hands',()=>{
  // seat 3 limps, the small blind completes, the big blind raises to 110
  const acts=[{id:3,type:'call',to:20},...folds([4,5,0]),{id:1,type:'call',to:20},{id:2,type:'raise',to:110}];
  for(const hole of ['Qc Qd','Ac Kd','Tc Td']){const n=decide({hole,seat:3,acts,ch:DAVID});assert.ok((n.fold||0)<=4,`${hole}: ${JSON.stringify(n)}`);}
});

test('a short big blind facing limpers does not shove rubbish',()=>{
  const acts=[{id:3,type:'call',to:20},{id:4,type:'call',to:20},...folds([5,0,1])];
  for(const hole of ['7c 2d','9c 4d']){const n=decide({hole,seat:2,bbs:9,acts});assert.ok(!n.allin,`${hole}: ${JSON.stringify(n)}`);}
  assert.ok((decide({hole:'Ac Kd',seat:2,bbs:9,acts}).allin||0)>=16,'but shoves ace-king');
});

test('when only an all-in big blind is left to call, the small blind calls',()=>{
  const n=decide({hole:'Ac Ad',seat:1,stacks:{2:0.75},acts:folds([3,4,5,0])});
  assert.deepEqual(n,{call:20});
});
