'use strict';
/* Sound effects only, synthesized with WebAudio (no music). */
const SND=(function(){
  const S={ctx:null,on:true,sfxOn:true,sfxVol:0.8};
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  let noiseBuf=null;

  S.init=function(){
    if(S.ctx){if(S.ctx.state==='suspended')S.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const c=S.ctx=new AC();
    S.sBus=c.createGain();
    const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
    S.sBus.connect(comp);comp.connect(c.destination);
    noiseBuf=c.createBuffer(1,c.sampleRate,c.sampleRate);
    const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
    S.apply();
  };
  S.apply=function(){if(S.ctx)S.sBus.gain.setTargetAtTime(S.on&&S.sfxOn?S.sfxVol:0,S.ctx.currentTime,0.05);};
  S.setIntensity=function(){}; // kept so game code can call it; there is no music

  function ok(){return S.ctx&&S.on&&S.sfxOn;}
  function env(g,t,a,peak,d){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);}
  function tone(f,t,dur,v,type='sine',a=0.003){const c=S.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;env(g,t,a,v,dur);o.connect(g);g.connect(S.sBus);o.start(t);o.stop(t+a+dur+0.05);return o;}
  function noise(t,dur,type,freq,q,v,a=0.002){
    const c=S.ctx,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    n.buffer=noiseBuf;f.type=type;f.frequency.value=freq;f.Q.value=q;env(g,t,a,v,dur);
    n.connect(f);f.connect(g);g.connect(S.sBus);n.start(t,Math.random()*0.5);n.stop(t+a+dur+0.05);return f;
  }
  S.deal=()=>{if(!ok())return;const t=S.ctx.currentTime;const f=noise(t,0.07,'bandpass',4000,1.4,0.35);f.frequency.exponentialRampToValueAtTime(1500,t+0.07);};
  S.flip=()=>{if(!ok())return;const t=S.ctx.currentTime;noise(t,0.025,'highpass',3000,0.7,0.25);tone(900,t,0.035,0.08,'triangle');};
  S.chips=(n=3)=>{if(!ok())return;const t0=S.ctx.currentTime;for(let i=0;i<n;i++){const t=t0+i*0.04+Math.random()*0.015,f=2400+Math.random()*1400;tone(f,t,0.06,0.07);noise(t,0.02,'bandpass',5000,1,0.15);}};
  S.check=()=>{if(!ok())return;const t=S.ctx.currentTime;[0,0.1].forEach(d=>{const o=tone(170,t+d,0.07,0.28);o.frequency.exponentialRampToValueAtTime(90,t+d+0.07);});};
  S.fold=()=>{if(!ok())return;const t=S.ctx.currentTime;const f=noise(t,0.22,'bandpass',1600,1.2,0.25,0.03);f.frequency.exponentialRampToValueAtTime(300,t+0.25);};
  S.whoosh=()=>{if(!ok())return;const t=S.ctx.currentTime;const f=noise(t,0.2,'bandpass',600,1.4,0.15,0.05);f.frequency.exponentialRampToValueAtTime(2500,t+0.2);};
  S.click=()=>{if(!ok())return;tone(1400,S.ctx.currentTime,0.025,0.07,'triangle');};
  S.hover=()=>{};
  S.turn=()=>{if(!ok())return;const t=S.ctx.currentTime;tone(mtof(76),t,0.3,0.1);tone(mtof(83),t+0.1,0.45,0.1);};
  S.raise=()=>{if(!ok())return;S.chips(5);};
  S.allin=()=>{if(!ok())return;S.chips(8);const t=S.ctx.currentTime;tone(mtof(64),t,0.4,0.1,'triangle');tone(mtof(71),t+0.08,0.5,0.1,'triangle');};
  S.win=()=>{if(!ok())return;const t=S.ctx.currentTime;[72,76,79,84].forEach((m,i)=>tone(mtof(m),t+i*0.07,0.4,0.09,'triangle'));};
  S.lose=()=>{if(!ok())return;const t=S.ctx.currentTime;tone(mtof(64),t,0.25,0.07,'triangle');tone(mtof(60),t+0.14,0.4,0.07,'triangle');};
  S.bust=()=>{if(!ok())return;const t=S.ctx.currentTime;[67,63,60].forEach((m,i)=>tone(mtof(m),t+i*0.18,0.35,0.08,'triangle'));};
  S.levelup=()=>{if(!ok())return;const t=S.ctx.currentTime;[72,79].forEach((m,i)=>tone(mtof(m),t+i*0.12,0.35,0.09,'triangle'));};
  S.ko=()=>{if(!ok())return;const t=S.ctx.currentTime;tone(mtof(55),t,0.4,0.12,'triangle');};
  S.hit=()=>{};S.drum=()=>{};
  return S;
})();
