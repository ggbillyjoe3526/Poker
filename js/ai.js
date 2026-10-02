'use strict';
/* ===== Opponent AI: picks an action for player p at table t. No DOM; all randomness comes from
   t.aiRng so a seeded table replays the same decisions. ===== */
function aiDecide(t,p,o){
  const A=p.ch.ai,bb=t.bb,st=t.street,R=t.aiRng;
  const nOpp=inHandList(t).length-1;
  const eq=equityVsRandom(p.cards,t.board,nOpp,st===0?260:320,R);
  const rel=eq*(nOpp+1),noise=(R()-0.5)*0.3,r=rel+noise;p.bluffing=false;
  const pot=potTotal(t),toCall=o.toCall,stack=p.chips;
  const round=v=>Math.round(v/t.sb)*t.sb;
  const raiseTo=v=>{v=Math.max(round(v),o.minTo);if(v>=o.maxTo*0.8)return{type:'allin'};return{type:'raise',to:Math.min(v,o.maxTo)};};
  const check=()=>toCall===0?{type:'check'}:{type:'fold'};
  const stackBB=(stack+p.bet)/bb;
  if(stackBB<=2){ // tiny stack: any two cards will do — get it in
    if(toCall===0&&!o.canRaise)return{type:'check'};
    return o.canRaise?{type:'allin'}:{type:'call'};
  }
  if(stackBB<=11){ // short stack: push / fold
    const pushT=1.2-A.loose*0.5-A.aggr*0.15+(nOpp>2?0.15:0);
    if(r>pushT)return o.canRaise?{type:'allin'}:{type:'call'};
    if(toCall===0)return{type:'check'};
    const po=toCall/(pot+toCall);
    return eq>po+0.03-A.sticky*0.06?{type:'call'}:{type:'fold'};
  }
  if(st===0){
    const playT=1.3-A.loose*0.9,raiseT=1.8-A.aggr*0.5-A.loose*0.3;
    if(t.currentBet<=bb){
      if(o.canRaise&&(r>raiseT||R()<A.bluff*0.08)){if(r<=raiseT)p.bluffing=true;return raiseTo(t.currentBet+bb*(1.5+R()*0.8+A.aggr*0.6));}
      if(r>playT)return toCall===0?{type:'check'}:{type:'call'};
      return check();
    }
    const cost=toCall/Math.max(stack,1);
    const callT=playT+0.12+Math.min(0.55,cost*0.9)-A.sticky*0.3;
    const threeT=raiseT+0.4+(t.streetRaises>=2?0.4:0);
    if(o.canRaise&&r>threeT&&R()<0.4+A.aggr*0.6)return raiseTo(t.currentBet*(2.6+R()*0.7));
    if(rel>2.4&&o.canRaise)return raiseTo(t.currentBet*3);
    if(r>callT)return{type:'call'};
    return{type:'fold'};
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
