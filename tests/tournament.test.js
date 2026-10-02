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
