'use strict';
/* ===== Game state, engine, AI, game flow ===== */
const G={runId:0,speed:1,ffwd:false,paused:false,cancelers:new Set(),players:[],stats:{},board:[],pot:0,handNo:0,level:0,sb:10,bb:20,seed:0,keyAct:null,opt:{}};

class Abort extends Error{}
async function wait(ms){const run=G.runId;await sleep(ms/spd());while(G.paused&&run===G.runId)await sleep(100);if(run!==G.runId)throw new Abort();}
function waitFor(setup){
  return new Promise((res,rej)=>{let cleanup=null,settled=false;
    const cancel=()=>{if(settled)return;settled=true;cleanup&&cleanup();rej(new Abort());};
    G.cancelers.add(cancel);
    cleanup=setup(v=>{if(settled)return;settled=true;G.cancelers.delete(cancel);cleanup&&cleanup();res(v);});});
}
function cancelAll(){for(const c of [...G.cancelers])c();G.cancelers.clear();}

const P=i=>G.players[i];
const inHandList=()=>G.players.filter(p=>!p.out&&!p.folded);
const canActList=()=>G.players.filter(p=>!p.out&&!p.folded&&!p.allIn);
const aliveList=()=>G.players.filter(p=>!p.out);
function nextAlive(i){for(let k=1;k<=NSEATS;k++){const j=(i+k)%NSEATS;if(!G.players[j].out)return j;}return i;}
function prevAlive(i){for(let k=1;k<=NSEATS;k++){const j=(i-k+NSEATS)%NSEATS;if(!G.players[j].out)return j;}return i;}
function potTotal(){return G.pot+G.players.reduce((a,p)=>a+p.bet,0);}
function seatXY(p){return p.isHuman?LAY.human:LAY.seat[p.id];}

function applySkin(){} // table colours now come from the light/dark theme
function updateIntensity(){
  const anyAllIn=inHandList().some(p=>p.allIn)&&inHandList().length>=2;
  const v=G.runout||anyAllIn?2:potTotal()>=15*G.bb?1:0;
  SND.setIntensity(v);FX.spinTarget=[1,1.6,2.4][v];
}

/* ---------------- GAME ---------------- */
async function newRun(seed){
  cancelAll();G.runId++;
  G.seed=seed==null?(Math.random()*4294967296)>>>0:seed;setSeed(G.seed);
  const roster=shuffle(ROSTER.slice()).slice(0,5);
  G.players=[{id:0,isHuman:true,name:'You',ch:YOU_CH}].concat(roster.map((ch,k)=>({id:k+1,isHuman:false,name:ch.name,ch})));
  G.players.forEach(p=>Object.assign(p,{chips:START_STACK,cards:[],cardEls:[],bet:0,total:0,folded:false,allIn:false,out:false,lastRaiseId:-1,place:0}));
  Object.assign(G,{handNo:0,level:0,dealer:-1,bbSeat:null,pot:0,board:[],boardCards:[],boardEls:[],street:0,currentBet:0,minRaise:0,raiseId:0,
    bossShown:false,ffwd:false,runout:false,humanTurn:false,paused:false,humanPlace:0,beaten:new Set(),
    stats:{hands:0,won:0,biggestPot:0,bestScore:-1,bestCards:null,bestBluff:null,knockouts:0,peak:START_STACK}});
  [G.sb,G.bb]=BLINDS[0];
  document.body.classList.remove('title');
  hideOverlays();resetTableUI();buildSeats();G.players.forEach(p=>updateSeat(p));updateHUD();updateHandBox();
  $('#log').innerHTML='';SND.setIntensity(0);FX.spinTarget=1;applySpeedVar();
  try{await runLoop();}catch(e){if(!(e instanceof Abort))console.error(e);}
}
function resetTableUI(){
  clearCards();buildBets();buildSlots();potShown=0;setPot(0,false);
  $('#banner').className='';$('#dealer-btn').style.display='none';hideActionPanel();setWaitText('');setActive(-1);
  $$('.eqtag').forEach(e=>e.remove());$('#hp-tag').className='hp-tag';$('#hb-eq').textContent='';
}
async function runLoop(){
  while(true){
    await playHand();
    if(await endOfHand()==='over')return;
  }
}

/* ---------------- HAND ---------------- */
function positions(){
  // dead-button rule: the big blind always moves one live player forward, so nobody skips a blind
  const alive=aliveList(),hu=alive.length===2;
  let sb,bb;
  if(G.bbSeat==null){G.dealer=alive[rndInt(alive.length)].id;sb=hu?G.dealer:nextAlive(G.dealer);bb=nextAlive(sb);}
  else if(hu){bb=nextAlive(G.bbSeat);sb=nextAlive(bb);G.dealer=sb;}
  else{
    bb=nextAlive(G.bbSeat);
    const sbSeat=G.bbSeat;                      // last hand's big blind posts the small blind…
    sb=P(sbSeat).out||sbSeat===bb?-1:sbSeat;    // …or it is a dead small blind if they busted
    G.dealer=prevAlive(sbSeat);
    if(G.dealer===bb)G.dealer=prevAlive(bb);
  }
  G.bbSeat=bb;return{sb,bb,hu};
}
async function playHand(){
  G.handNo++;
  const lvl=Math.min(BLINDS.length-1,Math.floor((G.handNo-1)/HANDS_PER_LEVEL));
  [G.sb,G.bb]=BLINDS[lvl];
  const lvlUp=lvl!==G.level;G.level=lvl;
  updateHUD();
  clearCards();$$('.eqtag').forEach(e=>e.remove());
  Object.assign(G,{ffwd:false,ffwdMul:2.4,autoCF:false,runout:false,pot:0,board:[],boardEls:[],streetRaises:0,street:0});
  applySpeedVar();
  for(const p of G.players){Object.assign(p,{startChips:p.chips,cards:[],cardEls:[],bet:0,total:0,folded:p.out,allIn:false,lastRaiseId:-1,bluffing:false,shown:false,score:0});
    if(!p.out)setExpr(p,'neutral',false);updateSeat(p);setBet(p.id,0);clearTag(p);}
  setPot(0,false);updateHandBox();G.stats.hands++;
  if(lvlUp)await levelUp();
  const {sb:sbI,bb:bbI,hu}=positions();
  moveDealer(G.dealer);
  const alive=aliveList();
  G.deck=shuffle([...Array(52).keys()]);G.dp=0;
  log(`Hand #${G.handNo} · blinds ${fmt(G.sb)}/${fmt(G.bb)}`,'sys');
  setWaitText('DEALING…');
  const order=[];let i=nextAlive(G.dealer);for(let k=0;k<alive.length;k++){order.push(i);i=nextAlive(i);}
  await wait(250);
  for(let r=0;r<2;r++)for(const idx of order){const p=P(idx);p.cards.push(G.deck[G.dp++]);dealHole(p,r);await wait(80);}
  G.boardCards=G.deck.slice(G.dp,G.dp+5);G.dp+=5;
  await wait(320);
  await flipHuman();
  updateHandBox();
  G.currentBet=0;G.raiseId=1;G.minRaise=G.bb;
  if(sbI>=0)await postBlind(P(sbI),G.sb,'SB');else log('Dead small blind this hand');
  await postBlind(P(bbI),G.bb,'BB');
  G.currentBet=G.bb;
  updateIntensity();
  await bettingRound(hu?sbI:nextAlive(bbI));
  for(let st=1;st<=3;st++){
    if(inHandList().length<=1)break;
    await collectBets();
    await checkRunout();
    G.street=st;
    await dealStreet(st);
    if(!G.runout&&canActList().length>=2){
      G.currentBet=0;G.minRaise=G.bb;G.raiseId++;G.streetRaises=0;
      G.players.forEach(p=>{if(!p.folded&&!p.allIn)clearTag(p);});
      await bettingRound(nextAlive(G.dealer));
    }
  }
  await collectBets();
  await resolveHand();
}
async function checkRunout(){
  if(G.runout||inHandList().length<2||canActList().length>1)return;
  G.runout=true;updateIntensity();updateHandBox();
  setWaitText('ALL IN — RUNNING IT OUT');
  await revealHands();
  await banner('All in','No more betting — running out the board','',650);
  updateEquityTags();
}
function dealHole(p,r){
  const e=mkCard(p.cards[r],p.isHuman?'lg':'sm');placeCard(e,LAY.deck[0],LAY.deck[1],0,p.isHuman?0.87:1.68);
  const[x,y,rot]=LAY.cards[p.id][r];if(p.isHuman)e.classList.add('hum');
  moveCard(e,x,y,rot,1,380,50).then(()=>squash(e));p.cardEls[r]=e;SND.deal();
}
async function flipHuman(){for(const e of P(0).cardEls){e.classList.add('up');squash(e);SND.flip();await wait(140);}await wait(200);}
function put(p,amt){amt=Math.min(amt,p.chips);p.chips-=amt;p.bet+=amt;p.total+=amt;if(p.chips===0)p.allIn=true;return amt;}
async function postBlind(p,amt,label){
  const a=put(p,amt);showTag(p,p.allIn?'ALL IN':`${label} ${fmt(a)}`,p.allIn?'allin':'blind');
  flyChips(seatXY(p),LAY.bet[p.id],a,2,300);SND.chips(2);await wait(260);setBet(p.id,p.bet,true);updateSeat(p);setPot(potTotal());
}
async function collectBets(){
  const bettors=G.players.filter(p=>p.bet>0);if(!bettors.length)return;
  await wait(200);
  bettors.forEach(p=>{flyChips(LAY.bet[p.id],LAY.pot,p.bet,3,380);setBet(p.id,0);});
  SND.chips(5);await wait(420);
  bettors.forEach(p=>{G.pot+=p.bet;p.bet=0;});setPot(G.pot);
}
async function dealStreet(st){
  const idx=st===1?[0,1,2]:st===2?[3]:[4];
  if(G.runout){SND.drum(st===1?0.5:0.9);await wait(st===1?400:850);}
  for(const k of idx){
    const c=G.boardCards[k];G.board.push(c);
    const e=mkCard(c,'md');placeCard(e,LAY.deck[0],LAY.deck[1],0,1);G.boardEls[k]=e;
    moveCard(e,LAY.board[k][0],LAY.board[k][1],0,1,320,30);SND.deal();await wait(95);
  }
  await wait(280);
  for(const k of idx){G.boardEls[k].classList.add('up');squash(G.boardEls[k]);SND.flip();await wait(st===1?130:60);}
  if(G.runout&&st>=2){const[x,y]=LAY.board[idx[0]];FX.burst(x,y,{count:24,colors:['#fff','#ffc83d'],speed:6});FX.shake(0.4);}
  await wait(300);
  log(`${['','Flop','Turn','River'][st]}: ${G.board.map(cardStr).join(' ')}`,'sys');
  updateHandBox();if(G.runout)updateEquityTags();
  const h=P(0);if(!h.folded&&!h.out&&G.board.length===5)trackBest(h);
}
function trackBest(h){const s=evalHand(h.cards.concat(G.board));if(s>G.stats.bestScore){G.stats.bestScore=s;G.stats.bestCards=bestFive(h.cards.concat(G.board));}}

/* ---------------- BETTING ---------------- */
function needsAction(p){return !p.out&&!p.folded&&!p.allIn&&(p.lastRaiseId!==G.raiseId||p.bet<G.currentBet);}
async function bettingRound(start){
  let i=start;
  while(true){
    if(inHandList().length<=1)return;
    let found=-1;for(let k=0;k<NSEATS;k++){const j=(i+k)%NSEATS;if(needsAction(P(j))){found=j;break;}}
    if(found<0)return;
    const p=P(found);
    if(canActList().length===1&&p.bet>=G.currentBet)return;
    await takeTurn(p);
    updateIntensity();
    i=(found+1)%NSEATS;
  }
}
async function takeTurn(p){
  const toCall=Math.max(0,G.currentBet-p.bet);
  const others=canActList().filter(q=>q!==p).length;
  const canRaise=p.lastRaiseId!==G.raiseId&&p.chips>toCall&&others>0;
  const minTo=Math.min(p.bet+p.chips,G.currentBet+G.minRaise),maxTo=p.bet+p.chips;
  const o={toCall,canRaise,minTo,maxTo};
  setActive(p.id);let act;
  if(p.isHuman){
    if(G.autoCF){ // pre-selected CHECK / FOLD
      G.autoCF=false;act=toCall===0?{type:'check'}:{type:'fold'};await wait(250);
    }else{
      G.humanTurn=true;SND.turn();setWaitText('');
      if(toCall>potTotal()*0.5&&toCall>G.bb*4)setExpr(p,'think');
      try{act=await waitFor(res=>{showActionPanel(o,res);return()=>hideActionPanel();});}
      finally{G.humanTurn=false;updateWaitControls();}
    }
  }else{
    setWaitText(`${p.name} IS THINKING…`);setThinking(p,true);
    act=aiDecide(p,o);
    if(o.toCall>potTotal()*0.45&&p.lastR<1.1)setExpr(p,'sweat');else if(Math.random()<.3)setExpr(p,'think');
    await wait(450+Math.random()*650);setThinking(p,false);setWaitText('');
  }
  await applyAction(p,act,o);
  setActive(-1);
}
async function applyAction(p,act,o){
  if(act.type==='call'&&o.toCall===0)act={type:'check'};
  if(act.type==='check'&&o.toCall>0)act={type:'fold'};
  const who=p.isHuman?'You':p.name;
  switch(act.type){
    case 'fold':{
      p.folded=true;showTag(p,'FOLD','fold');SND.fold();log(`${who} fold${p.isHuman?'':'s'}`);setExpr(p,'disgust');
      if(p.isHuman){p.cardEls.forEach(e=>{e.classList.add('dim');moveCard(e,e._x,e._y+30,e._rot,0.92,300);});G.ffwd=inHandList().length>1;applySpeedVar();setWaitText('FOLDED · FAST-FORWARDING');}
      else{if(o.toCall>potTotal()*0.3)say(p,'fold',0.4);p.cardEls.forEach(e=>{moveCard(e,800,420,e._rot+90,0.6,380);e.animate([{opacity:1},{opacity:0}],{duration:380/spd(),fill:'forwards'});});}
      updateSeat(p);updateHandBox();await wait(260);break;}
    case 'check':showTag(p,'CHECK','check');SND.check();log(`${who} check${p.isHuman?'':'s'}`);if(p.expr!=='neutral')setExpr(p,'neutral');await wait(200);break;
    case 'call':{
      const a=put(p,Math.min(o.toCall,p.chips));showTag(p,p.allIn?'ALL IN':`CALL ${fmt(a)}`,p.allIn?'allin':'call');
      log(`${who} call${p.isHuman?'':'s'} ${fmt(a)}${p.allIn?' (all-in)':''}`);
      flyChips(seatXY(p),LAY.bet[p.id],a,3,340);SND.chips(3);
      if(p.allIn){setExpr(p,'allin');say(p,'allin',0.6);}else{setExpr(p,!p.isHuman&&p.lastR>1.3?'confident':'neutral');say(p,'call',0.18);}
      await wait(300);setBet(p.id,p.bet,true);break;}
    case 'raise':case 'allin':{
      const to=act.type==='allin'?p.bet+p.chips:clamp(act.to,o.minTo,o.maxTo);
      const prev=G.currentBet;put(p,to-p.bet);
      if(p.bet>G.currentBet){const inc=p.bet-G.currentBet;if(inc>=G.minRaise){G.minRaise=inc;G.raiseId++;}G.currentBet=p.bet;G.streetRaises++;}
      const label=p.allIn?'ALL IN':prev===0?`BET ${fmt(p.bet)}`:`RAISE ${fmt(p.bet)}`;
      showTag(p,label,p.allIn?'allin':'raise');
      log(`${who} ${p.allIn?'go'+(p.isHuman?'':'es')+' all in for '+fmt(p.bet):(prev===0?'bet':'raise'+(p.isHuman?'':'s')+' to')+' '+fmt(p.bet)}`);
      flyChips(seatXY(p),LAY.bet[p.id],p.bet,5,360);
      if(p.allIn){SND.allin();FX.shake(0.6);const[x,y]=LAY.bet[p.id];FX.burst(x,y,{count:30,colors:['#ffc83d','#fff','#ff1f3d'],speed:7});}else SND.raise();
      setExpr(p,p.allIn?'allin':'confident');if(p.allIn)say(p,'allin',0.75);
      await wait(340);setBet(p.id,p.bet,true);break;}
  }
  p.lastRaiseId=G.raiseId;
  updateSeat(p);setPot(potTotal());
}

/* ---------------- AI ---------------- */
function aiDecide(p,o){
  const A=p.ch.ai,bb=G.bb,st=G.street,R=Math.random;
  const nOpp=inHandList().length-1;
  const eq=equityVsRandom(p.cards,G.board,nOpp,st===0?260:320);
  const rel=eq*(nOpp+1),noise=(R()-0.5)*0.3,r=rel+noise;p.lastR=r;p.bluffing=false;
  const pot=potTotal(),toCall=o.toCall,stack=p.chips;
  const round=v=>Math.round(v/G.sb)*G.sb;
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
    if(G.currentBet<=bb){
      if(o.canRaise&&(r>raiseT||R()<A.bluff*0.08)){if(r<=raiseT)p.bluffing=true;return raiseTo(G.currentBet+bb*(1.5+R()*0.8+A.aggr*0.6));}
      if(r>playT)return toCall===0?{type:'check'}:{type:'call'};
      return check();
    }
    const cost=toCall/Math.max(stack,1);
    const callT=playT+0.12+Math.min(0.55,cost*0.9)-A.sticky*0.3;
    const threeT=raiseT+0.4+(G.streetRaises>=2?0.4:0);
    if(o.canRaise&&r>threeT&&R()<0.4+A.aggr*0.6)return raiseTo(G.currentBet*(2.6+R()*0.7));
    if(rel>2.4&&o.canRaise)return raiseTo(G.currentBet*3);
    if(r>callT)return{type:'call'};
    return{type:'fold'};
  }
  const betFrac=f=>G.currentBet+Math.round(f*(pot+toCall));
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
  if(o.canRaise&&G.streetRaises<3){
    if(r>1.75-A.aggr*0.3&&R()<0.35+A.aggr*0.5){if(r>1.9&&R()<A.trap*0.6&&st<3)return{type:'call'};return raiseTo(G.currentBet+Math.round((pot+toCall)*(0.6+R()*0.4)));}
    if(r<0.8&&nOpp===1&&st<3&&R()<A.bluff*0.12){p.bluffing=true;return raiseTo(G.currentBet*2.6);}
  }
  if(eq+noise*0.15>=need)return{type:'call'};
  return{type:'fold'};
}

/* ---------------- SHOWDOWN / AWARDS ---------------- */
async function revealHands(){
  for(const p of inHandList()){
    if(p.isHuman||p.shown)continue;p.shown=true;
    const rv=LAY.reveal[p.id];
    p.cardEls.forEach((e,k)=>moveCard(e,rv[k][0],rv[k][1],k?4:-4,1.15,300));
    await wait(160);p.cardEls.forEach(e=>e.classList.add('up'));SND.flip();await wait(200);
  }
}
function updateEquityTags(){
  $$('.eqtag').forEach(e=>e.remove());
  const cs=inHandList();if(cs.length<2||G.board.length===5)return;
  const eqs=multiEquity(cs.map(p=>p.cards),G.board),top=Math.max(...eqs);
  cs.forEach((p,i)=>{
    let x,y;if(p.isHuman){x=800;y=622;}else{const rv=LAY.reveal[p.id];x=(rv[0][0]+rv[1][0])/2;y=rv[0][1]-(p.id===3?-72:70);}
    const e=h('div','eqtag'+(eqs[i]===top?' lead':''),`${Math.round(eqs[i]*100)}%`);e.style.left=x+'px';e.style.top=y+'px';$('#cards').appendChild(e);
  });
}
function computePots(){
  const contrib=G.players.filter(p=>p.total>0),live=inHandList();
  const levels=[...new Set(live.map(p=>p.total))].sort((a,b)=>a-b);
  const pots=[];let prev=0;
  for(const L of levels){let amt=0;for(const p of contrib)amt+=Math.max(0,Math.min(p.total,L)-prev);
    const elig=live.filter(p=>p.total>=L);if(amt>0)pots.push({amount:amt,eligible:elig});prev=L;}
  const total=contrib.reduce((a,p)=>a+p.total,0),acc=pots.reduce((a,p)=>a+p.amount,0);
  if(total>acc&&pots.length)pots[pots.length-1].amount+=total-acc;
  return pots;
}
async function payTo(p,amount,big){
  flyChips(LAY.pot,seatXY(p),amount,Math.min(10,4+Math.floor(amount/(G.bb*5))),520);SND.chips(6);
  await wait(520);p.chips+=amount;updateSeat(p,true);
  const[x,y]=floatSpot(p);floatText(x,y,'+'+fmt(amount));
  if(p.isHuman){G.handWon+=amount;G.stats.peak=Math.max(G.stats.peak,p.chips);}
  if(big)FX.burst(x,y,{count:50,colors:['#ffc83d','#fff','#ff1f3d'],speed:10,type:'star'});
}
async function resolveHand(){
  setActive(-1);G.street=4;setWaitText('');$('#hb-eq').textContent='';G.handWon=0;G.humanWonPot=false;G.beaten=new Set();
  const cs=inHandList(),potSize=G.pot;
  if(cs.length===1){
    const w=cs[0];await wait(250);
    showTag(w,'WINS','win');setExpr(w,'gloat');
    if(w.isHuman){
      const bluffDesc=G.board.length>=3?(()=>{const s=evalHand(w.cards.concat(G.board));return handCat(s)===0?describe(s):null;})():(equityVsRandom(w.cards,[],1,300)<0.47?preflopLabel(w.cards[0],w.cards[1]):null);
      if(bluffDesc&&potSize>=G.bb*4&&(!G.stats.bestBluff||potSize>G.stats.bestBluff.pot))G.stats.bestBluff={pot:potSize,desc:bluffDesc};
      log(`You take the pot of ${fmt(potSize)}`);
    }else{
      log(`${w.name} takes ${fmt(potSize)}`);
      if(w.bluffing&&Math.random()<0.55){ // show the bluff
        const rv=LAY.reveal[w.id];w.cardEls.forEach((e,k)=>{moveCard(e,rv[k][0],rv[k][1],k?4:-4,1.15,260);e.classList.add('up');});SND.flip();
        showTag(w,'BLUFF!','bluff');say(w,'bluff',1,true);await wait(900);
      }else say(w,w.bluffing?'bluff':'win',0.45);
    }
    G.pot=0;setPot(0,false);await payTo(w,potSize,w.isHuman&&potSize>=G.bb*20);
    if(w.isHuman){G.stats.won++;SND.win(potSize>=G.bb*20);G.stats.biggestPot=Math.max(G.stats.biggestPot,potSize);}
  }else{
    cs.forEach(p=>clearTag(p));
    await revealHands();
    $$('.eqtag').forEach(e=>e.remove());
    for(const p of cs){p.score=evalHand(p.cards.concat(G.board));showHandLabel(p,p.score);}
    if(cs.includes(P(0)))trackBest(P(0));
    const pots=computePots(),contested=pots.filter(q=>q.eligible.length>1).length;
    for(let k=0;k<pots.length;k++){
      const pot=pots[k];if(pot.amount<=0)continue;
      if(pot.eligible.length===1){const o=pot.eligible[0];G.pot-=pot.amount;setPot(G.pot,false);
        const[x,y]=floatSpot(o);floatText(x,y-50,`Uncalled ${fmt(pot.amount)} returned`,'info');log(`Uncalled ${fmt(pot.amount)} returned to ${o.isHuman?'you':o.name}`);
        await payTo(o,pot.amount,false);continue;}
      const best=Math.max(...pot.eligible.map(p=>p.score)),winners=pot.eligible.filter(p=>p.score===best);
      await showWinners(winners,pot,k>0?`Side pot ${k}`:(contested>1?'Main pot':''),pot.eligible);
    }
  }
  G.pot=0;setPot(0,false);
  if(G.humanWonPot)G.stats.won++;
  G.stats.peak=Math.max(G.stats.peak,P(0).chips);
  SND.setIntensity(0);FX.spinTarget=1;
  await wait(G.handWon>0||cs.length>1?1400:700);
}
async function showWinners(winners,pot,label,elig){
  const b=G.board,w0=winners[0];
  $$('#cards .card').forEach(e=>e.classList.remove('win','dim'));
  if(P(0).folded)P(0).cardEls.forEach(e=>e.classList.add('dim'));
  const core=coreCards(bestFive(w0.cards.concat(b)),w0.score);
  G.boardEls.forEach((e,i)=>{if(e)e.classList.add(core.includes(G.board[i])?'win':'dim');});
  winners.forEach(w=>{const c=coreCards(bestFive(w.cards.concat(b)),w.score);w.cardEls.forEach((e,i)=>{if(c.includes(w.cards[i]))e.classList.add('win');});});
  elig.filter(p=>!winners.includes(p)).forEach(p=>p.cardEls.forEach(e=>e.classList.add('dim')));
  const humanWins=winners.some(p=>p.isHuman),split=winners.length>1;
  const title=split?'Split pot':humanWins?'You win':`${w0.name} wins`;
  const sub=`${label?label+' · ':''}${describe(w0.score)} · ${fmt(pot.amount)}`;
  if(humanWins)elig.forEach(p=>G.beaten.add(p.id));
  log(`${split?'Split: ':''}${winners.map(w=>w.isHuman?'You':w.name).join(' & ')} win${winners.length>1||humanWins?'':'s'} ${fmt(pot.amount)} with ${describe(w0.score)}`);
  winners.forEach(w=>{setExpr(w,'gloat');say(w,'win',0.6);showTag(w,'WINNER','win');});
  elig.filter(p=>!winners.includes(p)).forEach(p=>{setExpr(p,p.allIn?'shock':'sweat');say(p,'lose',0.35);});
  const big=humanWins&&(pot.amount>=G.bb*25||elig.some(p=>p.allIn));
  if(humanWins){SND.win(big);if(big){FX.shake(1);FX.confetti();}}else if(elig.includes(P(0)))SND.lose();
  const cat=handCat(w0.score);
  if(cat>=6){FX.flash('#fff',0.5);FX.burst(800,420,{count:80,colors:['#ffc83d','#fff','#ff4fb8'],speed:13,type:'star'});}
  await banner(title,sub,(humanWins?'gold':split?'dark':'')+(winners.some(w=>w.id>=2&&w.id<=4)?' low':' high'),cat>=5?1200:850); // sits above the board so the winning cards stay visible
  const share=Math.floor(pot.amount/winners.length);let rem=pot.amount-share*winners.length;
  G.pot-=pot.amount;setPot(Math.max(0,G.pot),false);
  const ordered=winners.slice().sort((a,b)=>((a.id-G.dealer+NSEATS-1)%NSEATS)-((b.id-G.dealer+NSEATS-1)%NSEATS));
  for(const w of ordered){const amt=share+(rem>0?1:0);if(rem>0)rem--;await payTo(w,amt,w.isHuman&&big);
    if(w.isHuman)G.stats.biggestPot=Math.max(G.stats.biggestPot,pot.amount);}
  if(humanWins)G.humanWonPot=true;
  await wait(300);
}

/* ---------------- BETWEEN HANDS ---------------- */
async function levelUp(){
  SND.levelup();
  await banner('Blinds up',`Level ${G.level+1} · ${fmt(G.sb)} / ${fmt(G.bb)}`,'',800);
}
async function endOfHand(){
  const h=P(0);
  const busted=G.players.filter(p=>!p.out&&p.chips<=0);
  const bustOpps=busted.filter(p=>!p.isHuman);
  // everyone busting this hand is ranked by the stack they started the hand with
  const dying=busted.slice().sort((a,b)=>b.startChips-a.startChips);
  const survivors=aliveList().length-dying.length;
  dying.forEach((p,i)=>p.place=survivors+1+i);
  for(const p of bustOpps)p.out=true;
  for(const p of bustOpps){
    clearTag(p);setExpr(p,'shock');updateSeat(p);say(p,'bust',1,true);SND.ko();FX.shake(0.8);
    const[x,y]=LAY.seat[p.id];FX.burst(x,y,{count:60,colors:['#ff1f3d','#fff','#000'],speed:11});
    if(G.beaten.has(p.id))G.stats.knockouts++;
    log(`${p.name} is eliminated! (#${p.place})`,'sys');
    await banner(`${p.name} is out`,`Finishes #${p.place}`,'',900);
    setExpr(p,'disgust');
  }
  if(h.chips<=0&&!h.out){
    h.out=true;G.humanPlace=h.place||aliveList().length+1;updateSeat(h);SND.bust();setExpr(h,'shock');
    aliveList().forEach(p=>setExpr(p,'gloat'));
    await banner("You're out",`You finish #${G.humanPlace} of ${G.players.length}`,'',1300);
    showRecap(false);return 'over';
  }
  if(aliveList().length===1){
    await banner('You won!','The whole table is yours','gold',1500);
    showRecap(true);return 'over';
  }
}

/* ---------------- INPUT / BOOT ---------------- */
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k===' '||k.startsWith('arrow'))e.preventDefault();
  if(e.repeat&&!k.startsWith('arrow'))return; // a held key never acts twice (e.g. can't skip the all-in confirm)
  const open=s=>$(s).classList.contains('show');
  if(k==='h'){if(open('#ov-settings'))return;if(open('#ov-help')){$('#ov-help').classList.remove('show');syncPause();}else showHelp();return;}
  if(k==='p'){togglePause();return;}
  if(k==='escape'){['#ov-help','#ov-settings','#ov-pause'].forEach(s=>$(s).classList.remove('show'));syncPause();savePrefs();return;}
  if(G.keyAct&&!G.paused)G.keyAct(k===' '?'space':k);
});
function boot(){
  G.opt=loadPrefs();SND.sfxVol=G.opt.sfx;SND.sfxOn=G.opt.sfxOn!==false;applyPrefs();
  fit();buildSlots();buildBets();
  $('#ov-pause').onclick=()=>togglePause(false);
  $('#ap-pre').onclick=()=>{G.autoCF=!G.autoCF;SND.click();updateWaitControls();};
  $('#ap-skip').onclick=()=>{G.ffwdMul=10;applySpeedVar();SND.click();$('#ap-skip').classList.remove('show');};
  $('#h-settings').onclick=()=>{SND.init();SND.click();showSettings();};
  setSpeed(SPEEDS.some(s=>s[0]===G.opt.speed)?G.opt.speed:1);
  showTitle((Math.random()*4294967296)>>>0);
}
boot();
