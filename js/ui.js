'use strict';
/* ===== DOM / presentation layer (minimal light/dark design) ===== */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function h(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
const SIZES={lg:[120,168],md:[104,146],sm:[62,87]};
const LAY={
  seat:[[800,760],[170,515],[205,218],[800,98],[1395,178],[1430,505]],
  cards:[[[738,722,-4],[862,722,4]],[[298,512,-4],[324,518,4]],[[330,216,-4],[356,222,4]],[[918,98,-4],[944,104,4]],[[1268,176,-4],[1294,182,4]],[[1300,502,-4],[1326,508,4]]],
  reveal:[null,[[292,512],[362,512]],[[322,218],[392,218]],[[625,118],[695,118]],[[1218,178],[1288,178]],[[1254,502],[1324,502]]],
  bet:[[800,580],[410,478],[460,308],[800,240],[1140,272],[1110,548]],
  dealer:[[906,602],[400,548],[405,345],[884,238],[1072,302],[1200,540]],
  board:[552,676,800,924,1048].map(x=>[x,420]),
  deck:[1180,420], pot:[800,300], human:[800,700]
};
const SIDE=['b','l','l','t','r','r'];
function spd(){return (G.speed||1)*(G.ffwd?(G.ffwdMul||2.4):1);}
function applySpeedVar(){document.documentElement.style.setProperty('--spd',String(spd()));}
const reduceMQ=matchMedia('(prefers-reduced-motion: reduce)');
const calm=()=>!!(G.opt&&G.opt.calm)||reduceMQ.matches;

/* ---------- stage fit ---------- */
function fit(){const w=innerWidth,hh=innerHeight,k=Math.min(w/1600,hh/900);$('#stage').style.transform=`translate(${(w-1600*k)/2}px,${(hh-900*k)/2}px) scale(${k})`;}
addEventListener('resize',fit);

/* ---------- preferences (display/sound conveniences only — no game progress is saved) ---------- */
const PREF_KEY='allin-poker-prefs';
function loadPrefs(){
  const d={theme:'auto',calm:false,odds:true,sfxOn:true,sfx:0.8,speed:1,diff:'normal'};
  try{const s=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');return Object.assign(d,s);}catch(e){return d;}
}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(Object.assign({},G.opt,{sfx:SND.sfxVol,sfxOn:SND.sfxOn,speed:G.speed})));}catch(e){}}
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function applyPrefs(){
  const o=G.opt;
  document.body.dataset.theme=o.theme==='auto'?(darkMQ.matches?'dark':'light'):o.theme;
  document.body.classList.toggle('calm',!!o.calm);
}
darkMQ.addEventListener&&darkMQ.addEventListener('change',()=>{if(G.opt&&G.opt.theme==='auto')applyPrefs();});

/* ---------- cards ---------- */
function cardInner(c){
  const r=c%13,s=(c/13)|0,rl=RANK_LABEL[r],su=SUITS[s];
  const center=r>=9&&r<=11?`<div class="pip face">${rl}</div>`:`<div class="pip${r===12?' ace':''}">${su}</div>`;
  return `<div class="card-inner"><div class="card-face front s${s}"><div class="cr tl"><b>${rl}</b><i>${su}</i></div>${center}<div class="cr br"><b>${rl}</b><i>${su}</i></div></div><div class="card-face back"></div></div>`;
}
function mkCard(c,size,up=false,parent){const e=h('div','card '+size+(up?' up':''));e.innerHTML=cardInner(c);e.dataset.size=size;e._x=0;e._y=0;e._rot=0;e._sc=1;(parent||$('#cards')).appendChild(e);return e;}
function placeCard(e,x,y,rot=0,sc=1){const[w,hh]=SIZES[e.dataset.size];e.style.left=(x-w/2)+'px';e.style.top=(y-hh/2)+'px';e._x=x;e._y=y;e._rot=rot;e._sc=sc;e.style.transform=`rotate(${rot}deg) scale(${sc})`;}
function moveCard(e,x,y,rot=0,sc=1,dur=360){
  const dx=e._x-x,dy=e._y-y,r0=e._rot,s0=e._sc;placeCard(e,x,y,rot,sc);
  return e.animate([{transform:`translate(${dx}px,${dy}px) rotate(${r0}deg) scale(${s0})`},{transform:`translate(0px,0px) rotate(${rot}deg) scale(${sc})`}],
    {duration:(calm()?160:dur)/spd(),easing:'cubic-bezier(.25,.8,.3,1)'}).finished.catch(()=>{});
}
function clearCards(){$('#cards').innerHTML='';$('#flyers').innerHTML='';}
function buildSlots(){const s=$('#slots');s.innerHTML='';LAY.board.forEach(([x,y])=>{const e=h('div','slot');e.style.left=(x-52)+'px';e.style.top=(y-73)+'px';s.appendChild(e);});}

/* ---------- chips ---------- */
const DENOMS=[[1000,'#d9a520'],[500,'#7a5cc2'],[100,'#2b2d33'],[25,'#2e8b57'],[5,'#c9424a'],[1,'#e9e9ee']];
function chipList(amount,max=9){const out=[];let a=amount;for(const[v,c] of DENOMS){while(a>=v&&out.length<max){out.push(c);a-=v;}}if(!out.length)out.push(DENOMS[5][1]);return out;}
function chipHTML(list){return list.map((c,i)=>`<div class="chip" style="--c:${c};bottom:${i*4}px"></div>`).join('');}
function buildBets(){const b=$('#bets');b.innerHTML='';for(let i=0;i<6;i++){const e=h('div','bet hide');e.id='bet-'+i;e.style.left=LAY.bet[i][0]+'px';e.style.top=LAY.bet[i][1]+'px';e.innerHTML='<div class="stack"></div><div class="amt"></div>';b.appendChild(e);}}
function setBet(i,amt){const e=$('#bet-'+i);if(!e)return;if(!amt){e.classList.add('hide');return;}e.classList.remove('hide');e.querySelector('.stack').innerHTML=chipHTML(chipList(amt,6));e.querySelector('.amt').textContent=fmt(amt);}
function flyChips(from,to,amount,n=3,dur=420){
  const list=chipList(amount,calm()?1:Math.min(n,4)),layer=$('#flyers');let last=Promise.resolve();
  const dx=to[0]-from[0],dy=to[1]-from[1];
  list.forEach((c,i)=>{
    const e=h('div','flyer',`<div class="chip" style="--c:${c}"></div>`);e.style.left=(from[0]-15)+'px';e.style.top=(from[1]-15)+'px';e.style.opacity='0';layer.appendChild(e);
    const a=e.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${dx}px,${dy}px)`,opacity:1}],{duration:dur/spd(),delay:i*40/spd(),easing:'cubic-bezier(.3,.7,.3,1)'});
    last=a.finished.then(()=>e.remove(),()=>e.remove());
  });
  return last;
}
function floatText(x,y,text,cls=''){const e=h('div','float '+cls,text);e.style.left=x+'px';e.style.top=y+'px';$('#flyers').appendChild(e);
  e.animate([{transform:'translate(-50%,-30%)',opacity:0},{transform:'translate(-50%,-50%)',opacity:1,offset:.15},{transform:'translate(-50%,-50%)',opacity:1,offset:.8},{transform:'translate(-50%,-80%)',opacity:0}],{duration:1500/Math.min(spd(),2),easing:'ease-out'}).finished.then(()=>e.remove(),()=>e.remove());}
function floatSpot(p){if(p.isHuman)return[800,610];const[x,y]=LAY.bet[p.id];return[x,y-40];}

/* ---------- pot ---------- */
function setPot(v){$('#pot-amt').textContent=fmt(v);}

/* ---------- seats ---------- */
function buildSeats(){
  const wrap=$('#seats');wrap.innerHTML='';
  for(const p of G.players){ if(p.isHuman) continue;
    const[x,y]=LAY.seat[p.id];const s=h('div','seat side-'+SIDE[p.id]);s.id='seat-'+p.id;
    s.style.left=(x-85)+'px';s.style.top=(y-70)+'px';
    s.innerHTML=`<div class="pframe"><div class="portrait">${PORTRAIT.html(p.ch)}</div><div class="stamp">OUT</div><div class="thinking"><i></i><i></i><i></i></div></div><div class="atag"></div><div class="nameplate" tabindex="0" aria-describedby="tip-${p.id}"><span class="nm">${p.name}</span><span class="stk">0</span></div><div class="bubble"></div>
      <div class="tip" id="tip-${p.id}" role="tooltip"><b>${p.name}</b><span>${p.ch.style}</span><i class="tip-seen"></i></div>`;
    wrap.appendChild(s);p.el=s;
  }
  $('#hum-portrait').innerHTML=PORTRAIT.html(G.players[0].ch);
}
function updateSeat(p){
  if(p.isHuman){$('#hp-stack').textContent=p.out?'—':fmt(p.chips);return;}
  const s=p.el;if(!s)return;s.querySelector('.stk').textContent=p.out?'Out':fmt(p.chips);
  s.classList.toggle('folded',!!p.folded&&!p.out);s.classList.toggle('out',!!p.out);
  s.querySelector('.tip-seen').textContent=seenText(p.seen);
}
// what the table has seen of a player: the same counts the opponents use to adjust to each other and to you
function seenText(n){
  if(!n||n.hands<8)return 'Not enough hands seen yet to read their habits.';
  const pc=(a,b)=>Math.round(a/b*100)+'%';
  return `Over ${n.hands} hands: plays ${pc(n.vpip,n.hands)}, raises first ${pc(n.pfr,n.hands)}`+(n.faced>=5?`, folds to ${pc(n.folds,n.faced)} of bets after the flop.`:'.');
}
function setActive(id){
  $$('.seat').forEach(s=>s.classList.remove('active'));$('#human-plate').classList.remove('active');$('#human-avatar').classList.remove('active');
  $$('.card.hum').forEach(c=>c.classList.remove('active-glow'));
  if(id==null||id<0)return;
  if(id===0){$('#human-plate').classList.add('active');$('#human-avatar').classList.add('active');$$('.card.hum').forEach(c=>c.classList.add('active-glow'));}
  else G.players[id].el.classList.add('active');
}
function setThinking(p,on){if(p.el)p.el.classList.toggle('is-thinking',on);}
const TAGTXT=t=>/^(SB|BB)\b/.test(t)?t:t.charAt(0)+t.slice(1).toLowerCase();
function showTag(p,text,cls){
  text=TAGTXT(text);
  if(p.isHuman){const t=$('#hp-tag');t.className='hp-tag on '+cls;t.textContent=text;return;}
  const a=p.el.querySelector('.atag');a.className='atag on '+cls;a.textContent=text;
}
function clearTag(p){if(p.isHuman){$('#hp-tag').className='hp-tag';return;}if(p.el)p.el.querySelector('.atag').className='atag';}
let lastSay=0;
function say(p,type,prob=1,force=false){
  if(!p||p.isHuman||!p.el||!p.ch.lines[type])return;if(Math.random()>prob)return;
  const now=performance.now();if(!force&&now-lastSay<1800)return;lastSay=now;
  const b=p.el.querySelector('.bubble');b.textContent=mpick(p.ch.lines[type]);b.classList.add('on');
  clearTimeout(p._bt);p._bt=setTimeout(()=>b.classList.remove('on'),2600/Math.min(spd(),1.6));
}
function moveDealer(i){const d=$('#dealer-btn');d.style.display='block';d.style.left=(LAY.dealer[i][0]-16)+'px';d.style.top=(LAY.dealer[i][1]-16)+'px';}

/* ---------- HUD / log / hand box ---------- */
function updateHUD(){
  $('#hud-level').textContent=G.level+1;$('#hud-blinds').textContent=`${fmt(G.sb)} / ${fmt(G.bb)}`;
  const into=(G.handNo-1)%HANDS_PER_LEVEL,left=HANDS_PER_LEVEL-into-1;
  $('#hud-fill').style.width=((into+1)/HANDS_PER_LEVEL*100)+'%';
  $('#hud-next').textContent=G.level>=BLINDS.length-1?'Max level':left===0?'Blinds up next hand':`Blinds up in ${left} hand${left>1?'s':''}`;
  $('#hud-hand').textContent='Hand #'+G.handNo;$('#hud-left-count').textContent=aliveList(G).length+' left';
}
// action log: the last 3 lines show; hover it to scroll back through the last 30 (hand history)
function log(t,cls=''){const L=$('#log');const d=h('div',cls,t);L.appendChild(d);while(L.children.length>30)L.firstChild.remove();
  [...L.children].forEach((c,i)=>c.classList.toggle('dim',i<L.children.length-2));L.scrollTop=L.scrollHeight;}
function updateHandBox(){
  const p=G.players[0],nm=$('#hb-name'),eq=$('#hb-eq');
  if(!p||p.out||p.cards.length<2){nm.textContent='—';eq.textContent='';return;}
  if(p.folded){nm.textContent='Folded';eq.textContent='';return;}
  nm.textContent=G.board.length<3?preflopLabel(p.cards[0],p.cards[1]):describe(evalHand(p.cards.concat(G.board)));
  if(G.opt.odds&&!G.runout&&G.street<4){const n=inHandList(G).length-1;eq.textContent=n>0?`Win ≈ ${Math.round(equityVsRandom(p.cards,G.board,n,700)*100)}% vs ${n}`:'';}
  else eq.textContent='';
}

/* ---------- banners (simple centred notice) ---------- */
async function banner(text,sub='',cls='',hold=900){
  const b=$('#banner');b.className='show '+cls;b.querySelector('.banner-text').textContent=text;
  const sb=b.querySelector('.banner-sub');sb.textContent=sub;sb.style.display=sub?'block':'none';
  const d=200/Math.min(spd(),2);
  b.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:d,easing:'ease-out'});
  try{await wait(d+hold);}finally{
    const a=b.animate([{opacity:1},{opacity:0}],{duration:d,fill:'forwards'});
    await Promise.race([a.finished.catch(()=>{}),sleep(d+60)]);
    if(b.className.startsWith('show '+cls))b.className='';
    b.getAnimations().forEach(x=>x.cancel());
  }
}

/* ---------- action panel ---------- */
function showActionPanel(o,resolve){
  const p=G.players[0],ap=$('#action-panel');ap.classList.remove('off');ap.classList.add('on');
  const pot=potTotal(G),call=Math.min(o.toCall,p.chips);
  $('#ap-info').innerHTML=o.toCall>0?`To call <b>${fmt(call)}</b> · Pot <b>${fmt(pot)}</b> · Need <b>${Math.round(100*call/(pot+call))}%</b>`:`Pot <b>${fmt(pot)}</b> · No bet to you`;
  const bF=$('#b-fold'),bC=$('#b-call'),bR=$('#b-raise'),bA=$('#b-allin'),sl=$('#ap-slider'),amt=$('#ap-amt'),sizer=$('#ap-sizer');
  bF.classList.toggle('soft',o.toCall===0);bF.disabled=o.toCall===0;bF.title=o.toCall===0?'Nothing to call — checking is free':'';
  bC.querySelector('span').textContent=o.toCall===0?'Check':(o.toCall>=p.chips?'Call all-in':`Call ${fmt(o.toCall)}`);
  const canSize=o.canRaise&&o.minTo<o.maxTo;
  bR.classList.toggle('hide',!canSize);sizer.classList.toggle('hide',!canSize);bA.classList.toggle('hide',!o.canRaise);
  const verb=G.currentBet===0?'Bet':'Raise to';let val=o.minTo;
  const setVal=v=>{v=Math.round(v);if(v>=o.maxTo)v=o.maxTo;else{v=Math.round(v/G.sb)*G.sb;v=clamp(v,o.minTo,o.maxTo);}val=v;sl.value=v;amt.textContent=fmt(v);
    const f=o.maxTo===o.minTo?100:(v-o.minTo)/(o.maxTo-o.minTo)*100;sl.style.setProperty('--fill',f+'%');bR.querySelector('span').textContent=v>=o.maxTo?'All in':`${verb} ${fmt(v)}`;};
  if(canSize){sl.min=o.minTo;sl.max=o.maxTo;sl.step=1;setVal(o.minTo);}
  const done=act=>{if(G.paused)return;SND.click();resolve(act);};
  // folding when checking is free just checks — never throw away a free hand by accident
  bF.onclick=()=>{if(o.toCall===0){floatText(800,610,'Checked — it was free','info');done({type:'check'});}else done({type:'fold'});};
  bC.onclick=()=>done(o.toCall===0?{type:'check'}:{type:'call'});
  bR.onclick=()=>done(val>=o.maxTo?{type:'allin'}:{type:'raise',to:val});
  // all-in asks for a second click (or second A press) so a big stack is never shoved by accident
  bA.classList.remove('confirm');bA.querySelector('span').textContent='All in';
  bA.onclick=()=>{if(!bA.classList.contains('confirm')&&p.chips>G.bb*5){bA.classList.add('confirm');bA.querySelector('span').textContent='Confirm?';bA.title=`Click again to go all in for ${fmt(p.chips)}`;SND.click();return;}done({type:'allin'});};
  sl.oninput=()=>setVal(+sl.value);
  sl.onwheel=e=>{e.preventDefault();setVal(val+(e.deltaY<0?1:-1)*G.bb);};
  $$('.ap-presets button').forEach(b=>b.onclick=()=>{SND.click();const k=b.dataset.p;if(k==='min')setVal(o.minTo);else if(k==='max')setVal(o.maxTo);else setVal(G.currentBet+(+k)*(pot+o.toCall));});
  G.keyAct=k=>{if(k==='space'){if(o.toCall===0)bC.click();return;} // Space only ever checks, never calls a bet
    if(k==='f')bF.click();else if(k==='c')bC.click();else if(k==='r'&&canSize)bR.click();else if(k==='a'&&o.canRaise)bA.click();
    else if((k==='arrowup'||k==='arrowright')&&canSize)setVal(val+G.bb);else if((k==='arrowdown'||k==='arrowleft')&&canSize)setVal(val-G.bb);};
}
function hideActionPanel(){const ap=$('#action-panel');$('#ap-info').innerHTML='';ap.classList.add('off');ap.classList.remove('on');G.keyAct=null;['#b-fold','#b-call','#b-raise','#b-allin'].forEach(s=>$(s).onclick=null);updateWaitControls();}
function setWaitText(t){$('#ap-wait').textContent=t?t.charAt(0)+t.slice(1).toLowerCase():'';updateWaitControls();}
// waiting-panel helpers: pre-select CHECK/FOLD while others act, SKIP HAND after you fold
function updateWaitControls(){
  const hp=G.players&&G.players[0],pre=$('#ap-pre'),skip=$('#ap-skip');if(!pre||!hp)return;
  const inHand=!hp.out&&!hp.folded&&!hp.allIn&&hp.cards&&hp.cards.length===2&&G.street<4&&!G.humanTurn&&!G.runout;
  pre.classList.toggle('show',!!inHand);pre.classList.toggle('on',!!G.autoCF);pre.textContent=(G.autoCF?'☑':'☐')+' Check / Fold';
  skip.classList.toggle('show',!!(hp.folded&&G.ffwd&&G.street<4));
}
function showHandLabel(p,score){
  let x,y;if(p.isHuman){x=800;y=630;}else{const rv=LAY.reveal[p.id];x=(rv[0][0]+rv[1][0])/2;y=rv[0][1]+(p.id===3?62:-66);}
  const e=h('div','hlabel',shortName(score));e.style.left=x+'px';e.style.top=y+'px';$('#cards').appendChild(e);
}
// the game is paused exactly when the pause screen, help or the menu is open
function syncPause(){G.paused=['#ov-pause','#ov-help','#ov-settings'].some(s=>$(s).classList.contains('show'));}
function togglePause(force){
  const ov=$('#ov-pause'),on=force!=null?force:!ov.classList.contains('show');
  if(on&&($('#ov-help').classList.contains('show')||$('#ov-settings').classList.contains('show')||document.body.classList.contains('title')))return;
  ov.classList.toggle('show',on);syncPause();SND.click();
}

/* ---------- overlays ---------- */
function hideOverlays(){$$('.overlay').forEach(o=>o.classList.remove('show'));}
function showTitle(seed){
  const ov=$('#ov-title');
  ov.innerHTML=`<div class="t-card"><div class="t-logo">All-In Poker</div>
  <div class="t-tag">No-limit Texas Hold'em · you and 5 opponents · last one with chips wins</div>
  <button class="btn raise big" id="t-go">Start game</button>
  <div class="t-diff">Opponents: <b id="t-diff-name">${DIFF_NAME[G.opt.diff]||'Normal'}</b> <button class="linkbtn" id="t-diff">Change</button></div>
  <div class="t-hint">Keys: F fold · C check/call · R raise · A all-in · P pause · H help</div></div>`;
  ov.classList.add('show');document.body.classList.add('title');
  $('#t-diff').onclick=()=>{SND.init();SND.click();showSettings();};
  $('#t-go').onclick=()=>{SND.init();SND.click();ov.classList.remove('show');document.body.classList.remove('title');newRun(seed);};
}

/* recap */
function miniCards(cs){return `<span class="minic">${cs.map(c=>`<span class="s${suitOf(c)}">${RANK_LABEL[c%13]}${SUITS[suitOf(c)]}</span>`).join('')}</span>`;}
function showRecap(win){
  const S=G.stats,ov=$('#ov-recap'),place=win?1:G.humanPlace;
  const rows=[
    ['Hands played',`${S.hands} <small>· ${S.won} won</small>`],
    ['Biggest pot',S.biggestPot?fmt(S.biggestPot):'—'],
    ['Best hand',S.bestScore>=0?`${describe(S.bestScore)} ${miniCards(S.bestCards)}`:'—'],
    ['Best bluff',S.bestBluff?`${fmt(S.bestBluff.pot)} <small>with ${S.bestBluff.desc}</small>`:'—'],
    ['Knockouts',S.knockouts],
    ['Peak stack',fmt(S.peak)],
  ];
  const standing=G.players.slice().sort((a,b)=>(a.out?a.place:(a.isHuman&&win?1:0))-(b.out?b.place:(b.isHuman&&win?1:0)));
  ov.innerHTML=`<div class="ov-dim"></div><div class="panel recap-panel">
  <div class="rc-head"><div><div class="rc-title">${win?'You won the table':'You\'re out'}</div><div class="rc-sub">Final placing #${place} of ${G.players.length}</div></div></div>
  <div class="rc-body"><div class="rc-stats">${rows.map(r=>`<div class="rc-row"><div class="k">${r[0]}</div><div class="v">${r[1]}</div></div>`).join('')}</div>
  <div class="rc-coll"><h3>Final standings</h3><div class="rc-stand">${standing.map(p=>{const pl=p.out?p.place:(p.isHuman?place:'—');
    return `<div class="rs-row ${p.isHuman?'me':''} ${p.out?'out':''}"><div class="rs-pl">${p.out||p.isHuman?'#'+pl:'—'}</div><div class="rs-pt">${PORTRAIT.html(p.ch)}</div><div class="rs-nm">${p.name}</div><div class="rs-ch">${p.out?'Out':fmt(p.chips)}</div></div>`;}).join('')}</div></div></div>
  <div class="rc-foot"><button class="btn raise big" id="rc-new">New game</button><button class="btn call" id="rc-same">Same opponents again</button></div></div>`;
  ov.classList.add('show');
  if(win)SND.win();else SND.bust();
  $('#rc-new').onclick=()=>{SND.click();newRun();};
  $('#rc-same').onclick=()=>{SND.click();newRun(G.seed);};
}

/* help + settings */
const HELP_EX=[['Royal Flush','A-K-Q-J-10, all one suit',[25,24,23,22,21]],['Straight Flush','Five in a row, one suit',[46,45,44,43,42]],['Four of a Kind','Four cards of one rank',[10,23,36,49,3]],
  ['Full House','Three of a kind + a pair',[11,24,37,44,5]],['Flush','Any five of one suit',[38,35,32,30,26]],['Straight','Five in a row, mixed suits',[8,20,32,44,4]],
  ['Three of a Kind','Three cards of one rank',[6,19,32,50,1]],['Two Pair','Two different pairs',[9,22,28,41,12]],['Pair','Two cards of one rank',[8,21,37,43,0]],['High Card','Nothing made — highest card plays',[12,22,32,42,1]]];
function curRankRow(){const hp=G.players&&G.players[0];if(!hp||hp.out||hp.folded||!hp.cards||hp.cards.length<2||G.board.length<3)return -1;const s=evalHand(hp.cards.concat(G.board)),c=handCat(s);return c===8?(scoreDigits(s)[0]===12?0:1):9-c;}
function showHelp(){
  const ov=$('#ov-help');const cur=curRankRow();
  ov.innerHTML=`<div class="ov-dim"></div><div class="panel help-panel"><button class="close-x" id="help-x">✕</button><h2>How to play</h2>
  <div class="help-cols"><div class="help-rank">${HELP_EX.map((e,i)=>`<div class="hr ${i===cur?'cur':''}"><div class="n">${i+1}</div><div class="t"><b>${e[0]}</b><i>${e[1]}</i></div>${miniCards(e[2])}</div>`).join('')}</div>
  <div class="help-side">
   <div class="hc"><h3>The game</h3>No-limit Texas Hold'em. Everyone starts with ${fmt(START_STACK)} chips and the blinds rise every ${HANDS_PER_LEVEL} hands. Knock out all five opponents to win; lose your chips and the game ends.</div>
   <div class="hc"><h3>A hand</h3>You get 2 private cards. 5 shared cards arrive in stages: flop (3), turn (1), river (1). Your best 5 cards from all 7 win the pot — or bet so everyone else folds.</div>
   <div class="hc wide"><h3>Glossary</h3><dl><dt>Blinds</dt> forced bets posted by the two seats after the <b>D</b> button. &nbsp;<dt>Position</dt> acting later is an advantage. &nbsp;<dt>Side pot</dt> if someone is all-in for less, extra bets go in a separate pot they can't win. &nbsp;<dt>Need %</dt> how often a call must win to break even.</dl></div>
   <div class="hc wide"><h3>Opponents</h3>Each opponent has a style of their own. Point at a name (or tab to it) to see it, along with what the table has seen of their play so far. They watch you too, and adjust to how often you fold, call and raise. Set how strong they are in the menu.</div>
   <div class="hc wide"><h3>Controls</h3><kbd>F</kbd> fold &nbsp;<kbd>C</kbd> check/call &nbsp;<kbd>R</kbd> raise &nbsp;<kbd>A</kbd> all-in &nbsp;<kbd>↑↓</kbd> bet size &nbsp;<kbd>P</kbd> pause &nbsp;<kbd>H</kbd> help. Scroll on the slider to adjust bets.</div>
  </div></div></div>`;
  ov.classList.add('show');syncPause();
  const close=()=>{ov.classList.remove('show');syncPause();SND.click();};
  $('#help-x').onclick=close;ov.querySelector('.ov-dim').onclick=close;
}
const DIFF_NAME={easy:'Easy',normal:'Normal',hard:'Hard'};
const SPEEDS=[[0.75,'Relaxed'],[1,'Normal'],[1.6,'Fast'],[2.8,'Turbo']];
function seg(id,opts,cur){return `<div class="seg" id="${id}">${opts.map(([v,n])=>`<button data-v="${v}" class="${String(cur)===String(v)?'on':''}">${n}</button>`).join('')}</div>`;}
function showSettings(){
  const ov=$('#ov-settings');const o=G.opt,inGame=!document.body.classList.contains('title');
  ov.innerHTML=`<div class="ov-dim"></div><div class="panel set-panel"><button class="close-x" id="set-x">✕</button><h2>Menu</h2>
  <div class="set-list">
   <div class="set-row"><label>Opponents${inGame?'<small>Applies from the next game</small>':''}</label>${seg('set-diff',Object.entries(DIFF_NAME),o.diff||'normal')}</div>
   <div class="set-row"><label>Theme</label>${seg('set-theme',[['light','Light'],['dark','Dark'],['auto','Auto']],o.theme)}</div>
   <div class="set-row"><label>Sound effects</label><div class="set-inline">${seg('set-fx',[['1','On'],['0','Off']],SND.sfxOn?'1':'0')}<input type="range" id="set-sfx" min="0" max="100" value="${Math.round(SND.sfxVol*100)}" aria-label="Sound effects volume"></div></div>
   <div class="set-row"><label>Game speed</label>${seg('set-speed',SPEEDS,G.speed)}</div>
   <div class="set-row"><label>Show win odds</label>${seg('set-odds',[['1','On'],['0','Off']],o.odds?'1':'0')}</div>
   <div class="set-row"><label>Reduce motion</label>${seg('set-calm',[['1','On'],['0','Off']],o.calm?'1':'0')}</div>
  </div>
  <div class="set-foot"><button class="btn call" id="set-help">How to play</button>${inGame?'<button class="btn fold" id="set-new">New game</button>':''}<button class="btn raise" id="set-close">Back to table</button></div></div>`;
  ov.classList.add('show');syncPause();
  const close=()=>{ov.classList.remove('show');syncPause();SND.click();savePrefs();};
  $('#set-x').onclick=close;$('#set-close').onclick=close;ov.querySelector('.ov-dim').onclick=close;
  $('#set-sfx').oninput=e=>{SND.sfxVol=e.target.value/100;SND.apply();savePrefs();};
  $('#set-sfx').onchange=()=>SND.chips(3);
  const bind=(id,fn)=>$$(`#${id} button`).forEach(b=>b.onclick=()=>{fn(b.dataset.v);$$(`#${id} button`).forEach(x=>x.classList.toggle('on',x===b));applyPrefs();savePrefs();SND.click();});
  bind('set-diff',v=>{o.diff=v;const t=$('#t-diff-name');if(t)t.textContent=DIFF_NAME[v];});
  bind('set-theme',v=>o.theme=v);
  bind('set-fx',v=>{SND.init();SND.sfxOn=v==='1';SND.apply();});
  bind('set-speed',v=>setSpeed(+v));
  bind('set-odds',v=>{o.odds=v==='1';updateHandBox();});
  bind('set-calm',v=>o.calm=v==='1');
  $('#set-help').onclick=()=>{showHelp();ov.classList.remove('show');syncPause();savePrefs();};
  const nb=$('#set-new');
  if(nb)nb.onclick=()=>{if(!nb.classList.contains('confirm')){nb.classList.add('confirm');nb.textContent='Sure? Click again';SND.click();return;}
    ov.classList.remove('show');syncPause();savePrefs();newRun();};
}
function setSpeed(v){G.speed=v;applySpeedVar();}
