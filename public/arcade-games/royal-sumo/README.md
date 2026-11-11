# Royal Sumo source

Active: `index.html` (v1.3.0 plus the CALLBACK camera and phone-room adapters).

Rebuild: `node build-callback.mjs`.

The supplied editable source is in `project/`; `original/royal_sumo_crownfall_v1.3.0.html` is the untouched uploaded HTML. `callback-camera.js` is the separate repository presentation adapter. No game physics or input code was changed during import.

`online/host.js` is appended by the builder. `online/controller.html` and `controller.js` are served separately. `online/config.json` optionally selects an HTTPS relay; an empty relay uses the game origin. Online play requires the room server, while the standalone game remains self-contained.
