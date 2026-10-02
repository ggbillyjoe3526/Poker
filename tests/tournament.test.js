'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./load.js');

test('AI-only tournaments always finish, keep every chip and place each player once',async()=>{
  for(let seed=1;seed<=20;seed++){
    const t=E.table(6,seed);
    await E.playTournament(t);
    const alive=E.aliveList(t);
    assert.equal(alive.length,1,`seed ${seed} should end with one player`);
    assert.equal(alive[0].chips,6*E.START_STACK);
    const places=t.players.filter(p=>p.out).map(p=>p.place).sort();
    assert.deepEqual(places,[2,3,4,5,6],`seed ${seed} places`);
  }
});

test('a seed replays the same tournament, decision for decision',async()=>{
  const a=await E.playTournament(E.table(6,42)),b=await E.playTournament(E.table(6,42)),c=await E.playTournament(E.table(6,43));
  assert.deepEqual(a,b);
  assert.notDeepEqual(a,c);
});

test('a seed deals the same cards whatever the players decide',async()=>{
  const decks=async decide=>{
    const t=E.table(6,7),out=[];
    for(let h=0;h<5;h++){await E.playHand(t,{decide:(p,o)=>decide(t,p,o)});out.push(t.deck.join());}
    return out;
  };
  const passive=await decks(()=>({type:'call'})),ai=await decks((t,p,o)=>E.aiDecide(t,p,o));
  assert.deepEqual(passive,ai);
});

test('old seeds still deal the cards they always did',async()=>{
  // set up exactly as the browser's newRun does; these values come from the game before the engine split
  const rng=E.mulberry32(4242),roster=E.shuffle(E.ROSTER.slice(),rng).slice(0,5);
  const t=E.initTable({},[{name:'You',ch:E.YOU_CH}].concat(roster.map(ch=>({name:ch.name,ch}))),rng,E.mulberry32(4242^0x5bd1e995));
  assert.deepEqual(roster.map(ch=>ch.id),['michael','john','emma','tom','grace']);
  const decks=[];
  for(let h=0;h<3;h++){await E.playHand(t,{decide:()=>({type:'fold'})});if(h===0)assert.equal(t.dealer,2);decks.push(t.deck.slice(0,12).join());}
  assert.deepEqual(decks,['5,21,34,47,30,35,13,20,51,9,25,11','33,2,1,49,23,3,12,6,42,50,47,20','15,48,9,10,25,6,33,36,12,0,45,20']);
});
