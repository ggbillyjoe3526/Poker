Player avatars

By default every player is a plain shadowed silhouette drawn in code (js/portrait.js).
To use your own picture for a player instead:

1. Put a square image in this folder (PNG/JPG/WebP, ~300x300 or larger).
2. In js/data.js, add an `img` field to that player, for example:
     {id:'emma', name:'Emma', fem:true, img:'portraits/emma.png', ai:{...}},
3. Your own avatar is YOU_CH at the bottom of js/data.js — same field.

Players without an `img` keep the silhouette.
