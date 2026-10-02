# Royal Twisted — Spiral Keep

Royal Twisted is a 2–10 contestant reaction/survival game around the Spiral Keep. The active imported build is v0.5.0.

## Gameplay
Contestants automatically advance around the tower while hazards approach. Jump low cyan rods, duck high coral rods, and survive the round; the seventh hit eliminates a contestant. Unassigned slots are AI-controlled.

## Controls
- Touch: **JUMP** and **DUCK**
- Keyboard: Space / Up / W = Jump; Shift / Down / S = Duck
- Remote hooks: `window.RoyalTwisted.registerRemotePlayer()`, `input()`, `jump()`, `duck()`
- Contestants: 2–10

## Source
- Active: `source/index.html`
- Preserved upload: `source/original/royal_twisted_spiral_keep_v0.5_original_camera_knockback.html`
- Older reference: `source/archive/royal_twisted_spiral_keep_v0.4_ten_players.html`

The v0.5 build loads Three.js 0.180.0 from jsDelivr, so it needs network access for that dependency.

## Multiplayer
The source exposes local/gamepad/CALLBACK remote control hooks, but the repository does not yet provide authenticated room-code transport, authoritative seat credentials, reconnect, rate limiting, or verified production multiplayer.

## Tuning
Gameplay constants live in the inline JavaScript `TUNING` object in `source/index.html`.