# Vendored dependency

`three.module.js` is Three.js release/tag **r180 / 0.180.0**, vendored so the imported game can run without fetching its JavaScript engine dependency from jsDelivr.

Upstream: https://github.com/mrdoob/three.js/tree/r180
License: MIT (see `LICENSE-three.txt`).

Both `three.module.js` and its required `three.core.js` dependency are included from the same r180 release. Core source: https://raw.githubusercontent.com/mrdoob/three.js/r180/build/three.core.js .

The original chat source used `https://cdn.jsdelivr.net/npm/three@0.180.0/+esm`; `source/index.html` changes only that import to `./vendor/three.module.js`.
