'use strict';
/* Minimal shadowed-silhouette avatars. Faces are never shown; women are distinguished by a
   longer, feminine hairstyle. Colours come from the theme (CSS classes .av-bg/.av-body/.av-hair/.av-rim).
   To use real artwork instead, give a character an `img` in js/data.js (see portraits/README.txt). */
const PORTRAIT=(function(){
  // short, wide neck and high shoulders so only a little neck shows between the chin and collar
  const MALE=`<path class="av-body" d="M10 104 Q12 72 50 67 Q88 72 90 104Z"/><rect class="av-body" x="41" y="57" width="18" height="14" rx="5"/>`
    +`<ellipse class="av-body" cx="50" cy="44" rx="16.5" ry="19"/>`
    +`<path class="av-hair" d="M33 44 Q31 21 50 20 Q69 21 67 44 Q64 31 50 30 Q37 31 33 44Z"/>`
    +`<path class="av-rim" d="M62 32 Q68 44 63 56" fill="none" stroke-width="1.6" stroke-linecap="round"/>`;
  // long, voluminous hair falling past the shoulders so the silhouette reads as female at a glance
  const FEMALE=`<path class="av-hair" d="M27 50 Q22 15 50 14 Q78 15 73 50 Q80 72 82 100 L18 100 Q20 72 27 50Z"/>`
    +`<path class="av-body" d="M14 104 Q16 73 50 68 Q84 73 86 104Z"/><rect class="av-body" x="43" y="58" width="14" height="12" rx="5"/>`
    +`<ellipse class="av-body" cx="50" cy="45" rx="14.5" ry="18"/>`
    +`<path class="av-hair" d="M33 44 Q34 19 52 19 Q69 21 68 40 Q58 28 44 33 Q37 36 33 44Z"/>`
    +`<path class="av-hair" d="M35 50 Q28 72 31 96 L41 94 Q37 74 40 56Z M65 50 Q72 72 69 96 L59 94 Q63 74 60 56Z"/>`
    +`<path class="av-rim" d="M61 33 Q67 45 62 57" fill="none" stroke-width="1.6" stroke-linecap="round"/>`;
  function svg(ch){return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar"><rect class="av-bg" width="100" height="100"/>${ch.fem?FEMALE:MALE}</svg>`;}
  function html(ch){return ch.img?`<img class="pimg" src="${ch.img}" alt="${ch.name||''}">`:svg(ch);}
  return {svg,html};
})();
