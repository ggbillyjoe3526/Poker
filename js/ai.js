'use strict';
/* ===== Opponent AI: picks an action for player p at table t. No DOM; all randomness comes from
   t.aiRng so a seeded table replays the same decisions. ===== */
function aiDecide(t,p,o){
  const A=p.ch.ai,bb=t.bb,st=t.street,R=t.aiRng;
  const pot=potTotal(t),toCall=o.toCall,stack=p.chips;
  const round=v=>Math.round(v/t.sb)*t.sb;
  const raiseTo=v=>{v=Math.max(round(v),o.minTo);if(v>=o.maxTo*0.8)return{type:'allin'};return{type:'raise',to:Math.min(v,o.maxTo)};};
  const stackBB=(stack+p.bet)/bb;p.bluffing=false;
  if(stackBB<=2){ // tiny stack: any two cards will do — get it in
    if(toCall===0&&!o.canRaise)return{type:'check'};
    return o.canRaise?{type:'allin'}:{type:'call'};
  }
  if(st===0)return t.acts.some(a=>a.st===0&&a.to>a.prev)?facingRaise(t,p,o,A,R,raiseTo):unopened(t,p,o,A,R,raiseTo);
  // equity against what each opponent's betting says they hold, not against random cards
  const opps=inHandList(t).filter(q=>q!==p),nOpp=opps.length;
  const eq=rangeEquity(p.cards,t.board,opps.map(q=>readRange(t,q)),300,R);
  const rel=eq*(nOpp+1),noise=(R()-0.5)*0.3,r=rel+noise;
  const ip=!opps.some(q=>!q.allIn&&actsAfter(t,p,q)); // in position: nobody who can still bet acts after p
  if(stackBB<=11){ // short stack after the flop: all in or out
    const pushT=1.2-A.loose*0.5-A.aggr*0.15+(nOpp>2?0.15:0);
    if(r>pushT)return o.canRaise?{type:'allin'}:{type:'call'};
    if(toCall===0)return{type:'check'};
    const po=toCall/(pot+toCall);
    return eq>po+0.03-A.sticky*0.06?{type:'call'}:{type:'fold'};
  }
  const betFrac=f=>t.currentBet+Math.round(f*(pot+toCall));
  if(toCall===0){
    if(o.canRaise){
      if(r>1.45-A.aggr*0.3-(ip?0.1:0)){if(r>1.9&&R()<A.trap&&st<3)return{type:'check'};return raiseTo(betFrac(0.42+A.aggr*0.4+R()*0.25));}
      if(r<0.9&&nOpp<=2&&R()<A.bluff*(ip?0.55:0.35)){p.bluffing=true;return raiseTo(betFrac(0.5+R()*0.45));}
      if(R()<A.aggr*0.1)return raiseTo(betFrac(0.35));
    }
    return{type:'check'};
  }
  const po=toCall/(pot+toCall);
  let need=po-A.loose*0.1-A.sticky*0.14+(ip?0:0.02);
  if(toCall>pot*0.6)need+=0.05;
  if(toCall>=stack)need+=0.06-A.sticky*0.05;
  if(o.canRaise&&t.streetRaises<3){
    if(r>1.75-A.aggr*0.3&&R()<0.35+A.aggr*0.5){if(r>1.9&&R()<A.trap*0.6&&st<3)return{type:'call'};return raiseTo(t.currentBet+Math.round((pot+toCall)*(0.6+R()*0.4)));}
    if(r<0.8&&nOpp===1&&st<3&&R()<A.bluff*0.12){p.bluffing=true;return raiseTo(t.currentBet*2.6);}
  }
  if(eq+noise*0.15>=need)return{type:'call'};
  return{type:'fold'};
}

// does q act after p on this street? (after the flop the seat left of the button acts first)
function actsAfter(t,p,q){const n=t.players.length,d=x=>(x-t.dealer-1+n)%n;return d(q.id)>d(p.id);}

// before the flop with nobody raised yet: a hand chart by position, push or fold when short
function unopened(t,p,o,A,R,raiseTo){
  const bb=t.bb,toCall=o.toCall,top=1-preStrength(...p.cards),behind=seatsToAct(t,p.id);
  // effective stack: no one can win or lose more than the biggest other stack still in the hand
  const eff=Math.min(p.chips+p.bet,Math.max(...inHandList(t).filter(q=>q!==p).map(q=>q.chips+q.bet)))/bb;
  const style=(1+A.loose*0.8)*(0.9+R()*0.2); // looser players play more hands, and no two spots are identical
  const limpers=t.acts.filter(a=>a.st===0&&a.type==='call').length,fold=toCall===0?{type:'check'}:{type:'fold'};
  if(!o.canRaise)return toCall?{type:'call'}:{type:'check'}; // only an all-in big blind to call: always worth it
  if(eff<=10+A.aggr*4)return top<pushWidth(eff,behind,limpers)*style?{type:'allin'}:fold;
  if(toCall===0){ // the big blind after limps
    if(top<0.12*(1+A.aggr)*style)return raiseTo(bb*(3.5+limpers));
    return{type:'check'};
  }
  const width=openWidth(t,p.id)*style,open=()=>raiseTo(bb*(2.2+R()*0.6+limpers));
  if(top<width)return top<0.05||R()<0.35+A.aggr*0.7?open():{type:'call'}; // a passive player sometimes limps instead
  if(behind<=2&&R()<A.bluff*0.15){p.bluffing=true;return open();} // a steal from late position
  if(limpers&&top<width*1.5)return{type:'call'}; // join the limpers with a playable hand
  return fold;
}

// before the flop, facing a raise: is the price right against the ranges of the players who put money in?
function facingRaise(t,p,o,A,R,raiseTo){
  const bb=t.bb,toCall=o.toCall,pot=potTotal(t),top=1-preStrength(...p.cards);
  const inPot=inHandList(t).filter(q=>q!==p&&t.acts.some(a=>a.st===0&&a.id===q.id));
  const eq=rangeEquity(p.cards,[],inPot.map(q=>readRange(t,q)),260,R),n=inPot.length;
  const others=inHandList(t).filter(q=>q!==p),waiting=others.filter(q=>!inPot.includes(q)&&!q.allIn).length; // could still wake up
  const raises=t.acts.filter(a=>a.st===0&&a.to>a.prev).length,behind=seatsToAct(t,p.id);
  const oop=p.id===t.bbSeat||(p.id!==t.dealer&&behind===1); // the blinds act first after the flop
  // effective stack: the most p can win or lose against anyone still in the hand, waiting players included
  const stackOf=q=>q.chips+q.bet,eff=Math.min(stackOf(p),Math.max(...others.map(stackOf)))/bb;
  if(toCall>=p.chips||eff<=20){ // too short to raise and fold: all in or out
    // what p really risks, and the pot p can win if the biggest stack already in calls: nobody's chips
    // above p's stack count, since those go back (before the flop every chip is still in front of a player)
    const v=inPot.reduce((a,q)=>stackOf(q)>stackOf(a)?q:a),cap=Math.min(stackOf(p),stackOf(v));
    const final=t.players.reduce((a,q)=>a+(q===p||q===v?cap:Math.min(q.bet,cap)),0);
    const need=(cap-p.bet)/final-(toCall<p.chips&&raises===1?0.05+A.aggr*0.05:0)+waiting*0.02-A.sticky*0.05;
    return eq>=need?(o.canRaise?{type:'allin'}:{type:'call'}):{type:'fold'};
  }
  // calling with chips behind: weaker hands win less than their equity once the betting continues
  const spr=(p.chips-toCall)/(pot+toCall);
  const need=toCall/(pot+toCall)+waiting*0.03+(oop?0.03:0)+(raises>=2?0.08:0.02)*Math.min(1,spr/3)-A.sticky*0.06-A.loose*0.04;
  if(o.canRaise&&raises<4&&eq*(n+1)>1.3-A.aggr*0.15)return raiseTo(t.currentBet*(raises>=2?2.3:oop?3.4:3)+(R()-0.5)*bb);
  if(o.canRaise&&raises===1&&!oop&&top>0.08&&top<0.3&&R()<A.bluff*0.2){p.bluffing=true;return raiseTo(t.currentBet*3);}
  return eq>=need?{type:'call'}:{type:'fold'};
}
