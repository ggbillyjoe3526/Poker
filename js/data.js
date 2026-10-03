'use strict';
const START_STACK=1500, HANDS_PER_LEVEL=6;
const BLINDS=[[10,20],[15,30],[25,50],[40,80],[60,120],[100,200],[150,300],[250,500],[400,800],[600,1200],[1000,2000],[1500,3000],[2500,5000],[4000,8000]];

// Table talk every opponent can fall back on; each one also has a voice of their own below.
const LINES={
  win:['Nice.','I\'ll take that.','Good hand.'],
  fold:['Not this time.','I\'m out.','Too rich for me.'],
  bluff:['Had nothing.','Worth a try.'],
  allin:['All in.','Let\'s see it.'],
  bust:['Good game, everyone.','That\'s me done.'],
  lose:['Nice hand.','Well played.'],
  call:['I\'ll call.','Call.'],
};

// Opponent pool: 5 are picked each game. `ai` sets how each one plays, `style` is the hint shown on
// their seat, and `say` holds their own lines (any type left out uses LINES).
// Add `img:'portraits/name.png'` to use artwork instead of the silhouette.
const ROSTER=[
  {id:'emma',   name:'Emma',   fem:true, ai:{loose:-0.12,aggr:0.78,bluff:0.2, trap:0.15,sticky:0},
    style:'Tight and aggressive: plays few hands, and bets them hard',
    say:{win:['As planned.','Thank you.'],fold:['Not worth it.'],allin:['I\'m all in.'],call:['Fine, call.'],lose:['Well played.']}},
  {id:'lisa',   name:'Lisa',   fem:true, ai:{loose:0.1,  aggr:0.62,bluff:0.72,trap:0.1, sticky:0.1},
    style:'A fearless bluffer: a big bet from her proves nothing',
    say:{win:['Did I have it? Who knows.','Thanks for folding!'],bluff:['Couldn\'t resist.','Shh. Don\'t tell anyone.'],allin:['Feeling lucky.'],lose:['Worth a shot.']}},
  {id:'grace',  name:'Grace',  fem:true, ai:{loose:0,    aggr:0.58,bluff:0.26,trap:0.2, sticky:0.1},
    style:'Solid and balanced: hard to read, few mistakes',
    say:{win:['That works.','Good pot.'],fold:['I\'ll pass.'],lose:['Good hand.','Nicely played.'],call:['I\'ll see it.']}},
  {id:'john',   name:'John',             ai:{loose:0.32, aggr:0.12,bluff:0.05,trap:0.05,sticky:0.55},
    style:'A calling station: sees every flop, hates to fold, rarely bluffs',
    say:{call:['I\'ll call. I always call.','Let\'s see another card.','Can\'t fold this.'],win:['Told you I had something.','Glad I called!'],fold:['Fine, I\'ll let it go.'],lose:['Should\'ve folded.']}},
  {id:'andrew', name:'Andrew',           ai:{loose:0.45, aggr:0.95,bluff:0.55,trap:0,   sticky:0.2},
    style:'Wild and hyper-aggressive: raises constantly, with anything',
    say:{win:['Too easy.','Pressure works.'],allin:['All of it!','Let\'s gamble!'],bluff:['Nothing! Ha!'],bust:['Worth it. Every chip.'],fold:['Just this once.']}},
  {id:'david',  name:'David',            ai:{loose:-0.26,aggr:0.35,bluff:0.03,trap:0.1, sticky:-0.1},
    style:'A rock: waits for big hands, and folds when pushed',
    say:{fold:['I\'ll wait for a better spot.','Not with this.','Patience.'],win:['Worth the wait.'],allin:['I\'ve got it this time.'],lose:['Unlucky.']}},
  {id:'michael',name:'Michael',          ai:{loose:0.25, aggr:0.82,bluff:0.36,trap:0.05,sticky:0.1},
    style:'Loose and pushy: plays lots of hands and keeps betting',
    say:{win:['Keep them coming.','Mine again.'],call:['Sure, why not.'],allin:['Let\'s settle this.'],lose:['Next one\'s mine.']}},
  {id:'tom',    name:'Tom',              ai:{loose:0.05, aggr:0.4, bluff:0.15,trap:0.62,sticky:0.2},
    style:'A trapper: checks his big hands and lets you bet into him',
    say:{win:['Thanks for betting.','Gotcha.'],call:['Hmm. I\'ll just call.'],fold:['Too strong for me.'],lose:['Oh well.']}},
].map(c=>Object.assign(c,{lines:Object.assign({},LINES,c.say)}));

// the player's own avatar (bottom of the table)
const YOU_CH={id:'you',name:'You',lines:LINES};
