'use strict';
/* Minimal build: no background shader, particles, confetti, shake or flashes.
   These stubs keep the game code simple — every effect call is a quiet no-op. */
const FX={calm:false,spinTarget:1,
  isCalm(){return FX.calm||matchMedia('(prefers-reduced-motion: reduce)').matches;},
  setSkin(){},setMode(){},burst(){},ring(){},confetti(){},shake(){},flash(){},clear(){}};
