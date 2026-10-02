'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./load.js'),{c,cs}=E;
const score=s=>E.evalHand(cs(s));

test('every category beats the one below it',()=>{
  const ladder=[
    ['As Ks Qs Js Ts 2d 3c','Royal Flush'],
    ['9h 8h 7h 6h 5h Ad Kc','Straight Flush, Nine-high'],
    ['7s 7h 7d 7c Kd 2c 3h','Four Sevens'],
    ['Ks Kh Kd 5c 5d 2h 3s','Full House, Kings over Fives'],
    ['Ad 9d 7d 4d 2d Ks Qh','Flush, Ace-high'],
    ['9s 8h 7d 6c 5s Ad Kc','Straight, Nine-high'],
    ['Qs Qh Qd 9c 5s 3d 2h','Three Queens'],
    ['Js Jh 4d 4c As 8d 2h','Two Pair, Jacks & Fours'],
    ['Ts Th Ad 8c 5s 3d 2h','Pair of Tens'],
    ['As Qh 9d 7c 5s 3d 2h','Ace-High'],
  ];
  let prev=Infinity;
  ladder.forEach(([hand,name],i)=>{
    const s=score(hand);
    assert.equal(E.handCat(s),Math.min(8,9-i),hand); // a royal flush is the top straight flush
    assert.equal(E.describe(s),name);
    assert.ok(s<prev,`${hand} should rank below the hand above it`);prev=s;
  });
});

test('the wheel is a five-high straight and loses to a six-high one',()=>{
  const wheel=score('As 2h 3d 4c 5s Kd 9h'),six=score('2h 3d 4c 5s 6h Kd 9h');
  assert.equal(E.describe(wheel),'Straight, Five-high');
  assert.ok(six>wheel);
  assert.equal(E.describe(score('Ah 2h 3h 4h 5h Kd 9c')),'Straight Flush, Five-high');
});

test('a flush beats a straight on the same board',()=>{
  assert.equal(E.describe(score('9h 8h 7d 6h 5c 2h Kh')),'Flush, King-high');
});

test('two sets of trips make the best full house',()=>{
  assert.equal(E.describe(score('5s 5h 5d Ks Kh Kd 2c')),'Full House, Kings over Fives');
});

test('kickers decide pairs, two pair and quads',()=>{
  assert.ok(score('As Ah Kd 9c 7s 3d 2h')>score('As Ah Qd 9c 7s 3d 2h'));
  // with three pairs, the third pair's rank can be the kicker
  assert.ok(score('Ks Kh Qd Qc Js Jd 2h')>score('Ks Kh Qd Qc Ts 9d 2h'));
  assert.equal(score('Ks Kh Qd Qc Js Jd 2h'),score('Ks Kh Qd Qc Js 9d 2h'));
  assert.ok(score('7s 7h 7d 7c Ad 2c 3h')>score('7s 7h 7d 7c Kd Qc Jh'));
});

test('identical five-card hands tie whatever the unused cards are',()=>{
  assert.equal(score('As Ks Qd Jc 9s 3d 2h'),score('Ah Kh Qs Jd 9c 4d 2s'));
});

test('bestFive and coreCards pick out the cards that make the hand',()=>{
  const seven=cs('Ks Kh 4d 4c As 8d 2h'),five=E.bestFive(seven);
  assert.equal(five.length,5);
  assert.equal(E.evalHand(five),E.evalHand(seven));
  assert.deepEqual([...E.coreCards(five,E.evalHand(five))].sort((a,b)=>a-b),cs('Ks Kh 4d 4c').sort((a,b)=>a-b));
});

test('equity: seeded runs repeat exactly, and the river is exact',()=>{
  const a=E.equityVsRandom(cs('As Ad'),[],1,2000,E.mulberry32(5)),b=E.equityVsRandom(cs('As Ad'),[],1,2000,E.mulberry32(5));
  assert.equal(a,b);
  assert.ok(a>0.8&&a<0.9,`pocket aces vs one hand should win about 85%, got ${a}`);
  const eq=E.multiEquity([cs('As Ad'),cs('Ks Kd')],cs('2c 7h 9s Jd 3h'));
  assert.deepEqual([...eq],[1,0]);
});
