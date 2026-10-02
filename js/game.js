'use strict';
/* ===== Browser game: runs the engine (js/engine.js) on G and animates every step through IO ===== */
// G is the engine's table plus the browser's own state: speed, pause, input and the recap stats
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
function seatXY(p){return p.isHuman?LAY.human:LAY.seat[p.id];}

/* ---------------- GAME ---------------- */
async function newRun(seed){
  cancelAll();G.runId++;
  G.seed=seed==null?(Math.random()*4294967296)>>>0:seed;
  // one seed replays the whole run: its deal stream also picks the opponents
  const rng=mulberry32(G.seed),roster=shuffle(ROSTER.slice(),rng).slice(0,5);
  initTable(G,[{isHuman:true,name:'You',ch:YOU_CH}].concat(roster.map(ch=>({isHuman:false,name:ch.name,ch}))),rng,mulberry32(G.seed^0x5bd1e995));
  G.players.forEach(p=>p.cardEls=[]);
  Object.assign(G,{boardEls:[],ffwd:false,humanTurn:false,paused:false,humanPlace:0,beaten:new Set(),
    stats:{hands:0,won:0,biggestPot:0,bestScore:-1,bestCards:null,bestBluff:null,knockouts:0,peak:START_STACK}});
  document.body.classList.remove('title');
  hideOverlays();resetTableUI();buildSeats();G.players.forEach(p=>updateSeat(p));updateHUD();updateHandBox();
  $('#log').innerHTML='';applySpeedVar();
  try{await runLoop();}catch(e){if(!(e instanceof Abort))console.error(e);}
}
function resetTableUI(){
  clearCards();buildBets();buildSlots();setPot(0);
  $('#banner').className='';$('#dealer-btn').style.display='none';hideActionPanel();setWaitText('');setActive(-1);
  $$('.eqtag').forEach(e=>e.remove());$('#hp-tag').className='hp-tag';$('#hb-eq').textContent='';
}
async function runLoop(){
  while(true){
    await playHand(G,IO);
    if(await endOfHand()==='over')return;
  }
}

// the engine awaits each of these as the hand happens; they only show what it already decided
const IO={
  handStart:showHandStart,
  async button(){moveDealer(G.dealer);log(`Hand #${G.handNo} · blinds ${fmt(G.sb)}/${fmt(G.bb)}`,'sys');setWaitText('DEALING…');await wait(250);},
  async holeCard(p,r){dealHole(p,r);await wait(80);},
  async dealt(){await wait(320);await flipHuman();updateHandBox();},
  blind:showBlind,
  async deadBlind(){log('Dead small blind this hand');},
  decide:takeTurn,
  action:showAction,
  collect:showCollect,
  runout:showRunout,
  street:dealStreet,
  async newRound(){G.players.forEach(p=>{if(!p.folded&&!p.allIn)clearTag(p);});},
  async resolve(){setActive(-1);setWaitText('');$('#hb-eq').textContent='';G.handWon=0;G.humanWonPot=false;G.beaten=new Set();},
  win:showWin,
  showdown:showShowdown,
  returned:showReturned,
  pot:showWinners,
  handEnd:showHandEnd,
};

/* ---------------- HAND ---------------- */
async function showHandStart(lvlUp){
  updateHUD();
  clearCards();$$('.eqtag').forEach(e=>e.remove());
  Object.assign(G,{ffwd:false,ffwdMul:2.4,autoCF:false,boardEls:[]});
  applySpeedVar();
  for(const p of G.players){Object.assign(p,{cardEls:[],shown:false});updateSeat(p);setBet(p.id,0);clearTag(p);}
  setPot(0);updateHandBox();G.stats.hands++;
  if(lvlUp)await levelUp();
}
async function showRunout(){
  updateHandBox();
  setWaitText('ALL IN — RUNNING IT OUT');
  await revealHands();
  await banner('All in','No more betting — running out the board','',650);
  updateEquityTags();
}
function dealHole(p,r){
  const e=mkCard(p.cards[r],p.isHuman?'lg':'sm');placeCard(e,LAY.deck[0],LAY.deck[1],0,p.isHuman?0.87:1.68);
  const[x,y,rot]=LAY.cards[p.id][r];if(p.isHuman)e.classList.add('hum');
  moveCard(e,x,y,rot,1,380);p.cardEls[r]=e;SND.deal();
}
async function flipHuman(){for(const e of P(0).cardEls){e.classList.add('up');SND.flip();await wait(140);}await wait(200);}
async function showBlind(p,a,label){
  showTag(p,p.allIn?'ALL IN':`${label} ${fmt(a)}`,p.allIn?'allin':'blind');
  flyChips(seatXY(p),LAY.bet[p.id],a,2,300);SND.chips(2);await wait(260);setBet(p.id,p.bet,true);updateSeat(p);setPot(potTotal(G));
}
async function showCollect(bettors){
  await wait(200);
  bettors.forEach(p=>{flyChips(LAY.bet[p.id],LAY.pot,p.bet,3,380);setBet(p.id,0);});
  SND.chips(5);await wait(420);
  setPot(potTotal(G));
}
async function dealStreet(st){
  const idx=STREET_CARDS[st];
  if(G.runout)await wait(st===1?400:850);
  for(const k of idx){
    const e=mkCard(G.board[k],'md');placeCard(e,LAY.deck[0],LAY.deck[1],0,1);G.boardEls[k]=e;
    moveCard(e,LAY.board[k][0],LAY.board[k][1],0,1,320);SND.deal();await wait(95);
  }
  await wait(280);
  for(const k of idx){G.boardEls[k].classList.add('up');SND.flip();await wait(st===1?130:60);}
  await wait(300);
  log(`${['','Flop','Turn','River'][st]}: ${G.board.map(cardStr).join(' ')}`,'sys');
  updateHandBox();if(G.runout)updateEquityTags();
  const h=P(0);if(!h.folded&&!h.out&&G.board.length===5)trackBest(h);
}
function trackBest(h){const s=evalHand(h.cards.concat(G.board));if(s>G.stats.bestScore){G.stats.bestScore=s;G.stats.bestCards=bestFive(h.cards.concat(G.board));}}

/* ---------------- BETTING ---------------- */
async function takeTurn(p,o){
  setActive(p.id);
  if(p.isHuman){
    if(G.autoCF){ // pre-selected CHECK / FOLD
      G.autoCF=false;await wait(250);return o.toCall===0?{type:'check'}:{type:'fold'};
    }
    G.humanTurn=true;SND.turn();setWaitText('');
    try{return await waitFor(res=>{showActionPanel(o,res);return()=>hideActionPanel();});}
    finally{G.humanTurn=false;updateWaitControls();}
  }
  setWaitText(`${p.name} IS THINKING…`);setThinking(p,true);
  const act=aiDecide(G,p,o);
  await wait(450+Math.random()*650);setThinking(p,false);setWaitText('');
  return act;
}
async function showAction(p,ev,o){
  const who=p.isHuman?'You':p.name;
  switch(ev.type){
    case 'fold':{
      showTag(p,'FOLD','fold');SND.fold();log(`${who} fold${p.isHuman?'':'s'}`);
      if(p.isHuman){p.cardEls.forEach(e=>{e.classList.add('dim');moveCard(e,e._x,e._y+30,e._rot,0.92,300);});G.ffwd=inHandList(G).length>1;applySpeedVar();setWaitText('FOLDED · FAST-FORWARDING');}
      else{if(o.toCall>potTotal(G)*0.3)say(p,'fold',0.4);p.cardEls.forEach(e=>{moveCard(e,800,420,e._rot+90,0.6,380);e.animate([{opacity:1},{opacity:0}],{duration:380/spd(),fill:'forwards'});});}
      updateSeat(p);updateHandBox();await wait(260);break;}
    case 'check':showTag(p,'CHECK','check');SND.check();log(`${who} check${p.isHuman?'':'s'}`);await wait(200);break;
    case 'call':{
      const a=ev.amount;showTag(p,p.allIn?'ALL IN':`CALL ${fmt(a)}`,p.allIn?'allin':'call');
      log(`${who} call${p.isHuman?'':'s'} ${fmt(a)}${p.allIn?' (all-in)':''}`);
      flyChips(seatXY(p),LAY.bet[p.id],a,3,340);SND.chips(3);
      if(p.allIn)say(p,'allin',0.6);else say(p,'call',0.18);
      await wait(300);setBet(p.id,p.bet,true);break;}
    case 'raise':case 'allin':{
      const label=p.allIn?'ALL IN':ev.prev===0?`BET ${fmt(p.bet)}`:`RAISE ${fmt(p.bet)}`;
      showTag(p,label,p.allIn?'allin':'raise');
      log(`${who} ${p.allIn?'go'+(p.isHuman?'':'es')+' all in for '+fmt(p.bet):(ev.prev===0?'bet':'raise'+(p.isHuman?'':'s')+' to')+' '+fmt(p.bet)}`);
      flyChips(seatXY(p),LAY.bet[p.id],p.bet,5,360);
      if(p.allIn){SND.allin();say(p,'allin',0.75);}else SND.raise();
      await wait(340);setBet(p.id,p.bet,true);break;}
  }
  updateSeat(p);setPot(potTotal(G));
  setActive(-1);
}

/* ---------------- SHOWDOWN / AWARDS ---------------- */
async function revealHands(){
  for(const p of inHandList(G)){
    if(p.isHuman||p.shown)continue;p.shown=true;
    const rv=LAY.reveal[p.id];
    p.cardEls.forEach((e,k)=>moveCard(e,rv[k][0],rv[k][1],k?4:-4,1.15,300));
    await wait(160);p.cardEls.forEach(e=>e.classList.add('up'));SND.flip();await wait(200);
  }
}
function updateEquityTags(){
  $$('.eqtag').forEach(e=>e.remove());
  const cs=inHandList(G);if(cs.length<2||G.board.length===5)return;
  const eqs=multiEquity(cs.map(p=>p.cards),G.board),top=Math.max(...eqs);
  cs.forEach((p,i)=>{
    let x,y;if(p.isHuman){x=800;y=622;}else{const rv=LAY.reveal[p.id];x=(rv[0][0]+rv[1][0])/2;y=rv[0][1]-(p.id===3?-72:70);}
    const e=h('div','eqtag'+(eqs[i]===top?' lead':''),`${Math.round(eqs[i]*100)}%`);e.style.left=x+'px';e.style.top=y+'px';$('#cards').appendChild(e);
  });
}
// the engine has already paid p; this flies the chips over and then shows the new stack
async function payTo(p,amount){
  flyChips(LAY.pot,seatXY(p),amount,Math.min(10,4+Math.floor(amount/(G.bb*5))),520);SND.chips(6);
  await wait(520);updateSeat(p,true);
  const[x,y]=floatSpot(p);floatText(x,y,'+'+fmt(amount));
  if(p.isHuman){G.handWon+=amount;G.stats.peak=Math.max(G.stats.peak,p.chips);}
}
async function showWin(w,potSize){
  await wait(250);
  showTag(w,'WINS','win');
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
  setPot(0);await payTo(w,potSize);
  if(w.isHuman){G.stats.won++;SND.win();G.stats.biggestPot=Math.max(G.stats.biggestPot,potSize);}
}
async function showShowdown(cs){
  cs.forEach(p=>clearTag(p));
  await revealHands();
  $$('.eqtag').forEach(e=>e.remove());
  for(const p of cs)showHandLabel(p,p.score);
  if(cs.includes(P(0)))trackBest(P(0));
}
async function showReturned(o,amount){
  setPot(G.pot);
  const[x,y]=floatSpot(o);floatText(x,y-50,`Uncalled ${fmt(amount)} returned`,'info');log(`Uncalled ${fmt(amount)} returned to ${o.isHuman?'you':o.name}`);
  await payTo(o,amount);
}
async function showWinners(pot,winners,pays,k,contested){
  const b=G.board,w0=winners[0],elig=pot.eligible,label=k>0?`Side pot ${k}`:(contested>1?'Main pot':'');
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
  winners.forEach(w=>{say(w,'win',0.6);showTag(w,'WINNER','win');});
  elig.filter(p=>!winners.includes(p)).forEach(p=>say(p,'lose',0.35));
  if(humanWins)SND.win();else if(elig.includes(P(0)))SND.lose();
  await banner(title,sub,humanWins?'gold':'',handCat(w0.score)>=5?1200:850);
  setPot(Math.max(0,G.pot));
  for(const[w,amt] of pays){await payTo(w,amt);
    if(w.isHuman)G.stats.biggestPot=Math.max(G.stats.biggestPot,pot.amount);}
  if(humanWins)G.humanWonPot=true;
  await wait(300);
}
async function showHandEnd(cs){
  setPot(0);
  if(G.humanWonPot)G.stats.won++;
  G.stats.peak=Math.max(G.stats.peak,P(0).chips);
  await wait(G.handWon>0||cs.length>1?1400:700);
}

/* ---------------- BETWEEN HANDS ---------------- */
async function levelUp(){
  SND.levelup();
  await banner('Blinds up',`Level ${G.level+1} · ${fmt(G.sb)} / ${fmt(G.bb)}`,'',800);
}
async function endOfHand(){
  const h=P(0),busted=eliminate(G);
  for(const p of busted){
    if(p.isHuman)continue;
    clearTag(p);updateSeat(p);say(p,'bust',1,true);SND.ko();
    if(G.beaten.has(p.id))G.stats.knockouts++;
    log(`${p.name} is eliminated! (#${p.place})`,'sys');
    await banner(`${p.name} is out`,`Finishes #${p.place}`,'',900);
  }
  if(busted.includes(h)){
    G.humanPlace=h.place;updateSeat(h);SND.bust();
    await banner("You're out",`You finish #${G.humanPlace} of ${G.players.length}`,'',1300);
    showRecap(false);return 'over';
  }
  if(aliveList(G).length===1){
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
