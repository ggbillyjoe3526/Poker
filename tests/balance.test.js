'use strict';
// Short seeded simulations: the levels and the personalities must keep behaving as the game describes
// them. Who wins needs far more games to judge, so balance between personalities is checked with `npm run sim`
const test=require('node:test'),assert=require('node:assert/strict');
const {styles,levels}=require('../tools/sim.js');

test('Hard opponents finish ahead of Easy ones',async()=>{
  const L=await levels(40,'easy','hard');
  assert.ok(L.easy.place>L.hard.place+0.2,`average place: Easy ${L.easy.place.toFixed(2)}, Hard ${L.hard.place.toFixed(2)}`);
});

test("each personality plays the way its style hint says",async()=>{
  const S=await styles(40),rate=(name,a,b)=>S[name].seen[a]/S[name].seen[b];
  const plays=n=>rate(n,'vpip','hands'),raises=n=>rate(n,'pfr','hands'),bets=n=>rate(n,'aggr','chances'),folds=n=>rate(n,'folds','faced');
  for(const loose of ['John','Andrew','Michael'])for(const tight of ['David','Emma'])
    assert.ok(plays(loose)>plays(tight),`${loose} plays ${plays(loose).toFixed(2)} of hands, ${tight} ${plays(tight).toFixed(2)}`);
  assert.ok(folds('John')<folds('David')-0.15,'the calling station folds far less than the rock');
  assert.ok(raises('Andrew')>raises('John')+0.08,'the maniac raises far more than the calling station');
  assert.ok(bets('Lisa')>bets('Tom')&&bets('Andrew')>bets('Tom'),'the bluffer and the maniac bet more than the trapper');
});
