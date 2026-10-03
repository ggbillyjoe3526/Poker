'use strict';
/* ===== Opponent AI: picks an action for player p at table t. No DOM; all randomness comes from
   t.aiRng so a seeded table replays the same decisions. ===== */
function aiDecide(t,p,o){
  const A=p.ch.ai,bb=t.bb,st=t.street,R=t.aiRng;
  const pot=potTotal(t),toCall=o.toCall,stack=p.chips;
  const round=v=>Math.round(v/t.sb)*t.sb;
  const raiseTo=v=>{v=Math.max(round(v),o.minTo);if(v>=o.maxTo*0.8)return{type:'allin'};return{type:'raise',to:Math.min(v,o.maxTo)};};
  const check=()=>toCall===0?{type:'check'}:{type:'fold'};
  const stackBB=(stack+p.bet)/bb;p.bluffing=false;
  if(stackBB<=2){ // tiny stack: any two cards will do — get it in
    if(toCall===0&&!o.canRaise)return{type:'check'};
    return o.canRaise?{type:'allin'}:{type:'call'};
  }
  if(st===0&&t.acts.some(a=>a.st===0&&a.to>a.prev))return facingRaise(t,p,o,A,R,raiseTo);
  // equity against what each opponent's betting says they hold, not against random cards
  const opps=inHandList(t).filter(q=>q!==p),nOpp=opps.length;
  const eq=rangeEquity(p.cards,t.board,opps.map(q=>readRange(t,q)),st===0?260:300,R);
  const rel=eq*(nOpp+1),noise=(R()-0.5)*0.3,r=rel+noise;
  if(stackBB<=11){ // short stack: push / fold
    const pushT=1.2-A.loose*0.5-A.aggr*0.15+(nOpp>2?0.15:0);
    if(r>pushT)return o.canRaise?{type:'allin'}:{type:'call'};
    if(toCall===0)return{type:'check'};
    const po=toCall/(pot+toCall);
    return eq>po+0.03-A.sticky*0.06?{type:'call'}:{type:'fold'};
  }
  if(st===0){ // nobody has raised yet
    const playT=1.3-A.loose*0.9,raiseT=1.8-A.aggr*0.5-A.loose*0.3;
    if(o.canRaise&&(r>raiseT||R()<A.bluff*0.08)){if(r<=raiseT)p.bluffing=true;return raiseTo(t.currentBet+bb*(1.5+R()*0.8+A.aggr*0.6));}
    if(r>playT)return toCall===0?{type:'check'}:{type:'call'};
    return check();
  }
  const betFrac=f=>t.currentBet+Math.round(f*(pot+toCall));
  if(toCall===0){
    if(o.canRaise){
      if(r>1.45-A.aggr*0.3){if(r>1.9&&R()<A.trap&&st<3)return{type:'check'};return raiseTo(betFrac(0.42+A.aggr*0.4+R()*0.25));}
      if(r<0.9&&nOpp<=2&&R()<A.bluff*0.45){p.bluffing=true;return raiseTo(betFrac(0.5+R()*0.45));}
      if(R()<A.aggr*0.1)return raiseTo(betFrac(0.35));
    }
    return{type:'check'};
  }
  const po=toCall/(pot+toCall);
  let need=po-A.loose*0.1-A.sticky*0.14;
  if(toCall>pot*0.6)need+=0.05;
  if(toCall>=stack)need+=0.06-A.sticky*0.05;
  if(o.canRaise&&t.streetRaises<3){
    if(r>1.75-A.aggr*0.3&&R()<0.35+A.aggr*0.5){if(r>1.9&&R()<A.trap*0.6&&st<3)return{type:'call'};return raiseTo(t.currentBet+Math.round((pot+toCall)*(0.6+R()*0.4)));}
    if(r<0.8&&nOpp===1&&st<3&&R()<A.bluff*0.12){p.bluffing=true;return raiseTo(t.currentBet*2.6);}
  }
  if(eq+noise*0.15>=need)return{type:'call'};
  return{type:'fold'};
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
    // what p really risks, and the pot if the biggest stack already in calls it
    const v=inPot.reduce((a,q)=>stackOf(q)>stackOf(a)?q:a),cap=Math.min(stackOf(p),stackOf(v));
    const risk=cap-p.bet,final=pot+risk+Math.max(0,cap-v.bet);
    const need=(toCall>=p.chips?toCall/(pot+toCall):risk/final-(raises===1?0.05+A.aggr*0.05:0))+waiting*0.02-A.sticky*0.05;
    return eq>=need?(o.canRaise?{type:'allin'}:{type:'call'}):{type:'fold'};
  }
  // calling with chips behind: weaker hands win less than their equity once the betting continues
  const spr=(p.chips-toCall)/(pot+toCall);
  const need=toCall/(pot+toCall)+waiting*0.03+(oop?0.03:0)+(raises>=2?0.08:0.02)*Math.min(1,spr/3)-A.sticky*0.06-A.loose*0.04;
  if(o.canRaise&&raises<4&&eq*(n+1)>1.3-A.aggr*0.15)return raiseTo(t.currentBet*(raises>=2?2.3:oop?3.4:3)+(R()-0.5)*bb);
  if(o.canRaise&&raises===1&&!oop&&top>0.08&&top<0.3&&R()<A.bluff*0.2){p.bluffing=true;return raiseTo(t.currentBet*3);}
  return eq>=need?{type:'call'}:{type:'fold'};
}
