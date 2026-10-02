'use strict';
const START_STACK=1500, HANDS_PER_LEVEL=6, NSEATS=6;
const BLINDS=[[10,20],[15,30],[25,50],[40,80],[60,120],[100,200],[150,300],[250,500],[400,800],[600,1200],[1000,2000],[1500,3000],[2500,5000],[4000,8000]];

// Short, neutral table talk shared by every opponent.
const LINES={
  win:['Nice.','I\'ll take that.','Good hand.'],
  fold:['Not this time.','I\'m out.','Too rich for me.'],
  bluff:['Had nothing.','Worth a try.'],
  allin:['All in.','Let\'s see it.'],
  bust:['Good game, everyone.','That\'s me done.'],
  lose:['Nice hand.','Well played.'],
  call:['I\'ll call.','Call.'],
};

// Opponent pool: 5 are picked each game. `ai` sets how each one plays.
// Add `img:'portraits/name.png'` to use artwork instead of the silhouette.
const ROSTER=[
  {id:'emma',   name:'Emma',   fem:true, ai:{loose:-0.12,aggr:0.78,bluff:0.2, trap:0.15,sticky:0}},
  {id:'lisa',   name:'Lisa',   fem:true, ai:{loose:0.1,  aggr:0.62,bluff:0.72,trap:0.1, sticky:0.1}},
  {id:'grace',  name:'Grace',  fem:true, ai:{loose:0,    aggr:0.58,bluff:0.26,trap:0.2, sticky:0.1}},
  {id:'john',   name:'John',             ai:{loose:0.32, aggr:0.12,bluff:0.05,trap:0.05,sticky:0.55}},
  {id:'andrew', name:'Andrew',           ai:{loose:0.45, aggr:0.95,bluff:0.55,trap:0,   sticky:0.2}},
  {id:'david',  name:'David',            ai:{loose:-0.26,aggr:0.35,bluff:0.03,trap:0.1, sticky:-0.1}},
  {id:'michael',name:'Michael',          ai:{loose:0.25, aggr:0.82,bluff:0.36,trap:0.05,sticky:0.1}},
  {id:'tom',    name:'Tom',              ai:{loose:0.05, aggr:0.4, bluff:0.15,trap:0.62,sticky:0.2}},
].map(c=>Object.assign(c,{lines:LINES}));

// the player's own avatar (bottom of the table)
const YOU_CH={id:'you',name:'You',lines:LINES};
