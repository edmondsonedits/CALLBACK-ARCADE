# Live paper puppets

Names and bot labels have a separate footer below a clipped character stage. Saved avatar proportions, the 29 piece IDs, profile history and Undo/Redo remain the character's permanent design. Live motion uses nested SVG joints and bounded transient coordinates.

SVGs fit their explicit avatar boxes, including the phone header. Phone controllers have separate Game and Character screens; shared lobbies also have Style. Reactions and joint controls open as separate character screens with Back. Short landscape views page reactions three at a time and joint controls two at a time. Game task pages advance through fixed Next/Back controls without manual scrolling. The task DOM stays mounted so private drafts survive navigation. Keyboard focus and viewport changes bring the entire focused control into view.

Mobile customization edits one feature or one piece adjustment at a time. All sliders use the server's accepted limits; Looks, Style, Pieces, history, resets and Done remain reachable without scrolling. Sleeves, their printed decoration and tattoos follow shoulder/elbow joints. Head accessories and chokers follow the head, while necklaces and straps follow the body. Saved garment and decoration affine transforms keep a shared pivot and consistent nesting.

The phone puppet pad controls wrists, feet, body, head, gaze and mouth; elbows and knees bend through two-bone inverse kinematics. A local spring returns pieces to rest. Preset reactions animate the same joints. Reduced motion uses stationary expressions/poses, and keyboard sliders provide an alternative to dragging.

`/api/rooms/:code/avatar-poses` and `/api/sessions/:code/avatar-poses` authenticate existing cookies. POST accepts only a bounded pose and a sequence; the server derives both the scope and the player ID. Host/display snapshots contain only public cosmetic coordinates. Latest rows expire after three seconds, reject stale sequence overwrites, and never touch gameplay versions, scores, saved profiles or match history. Phones send at most three updates per second while active; host/display polls separately. Background/unmount and pointer cancellation release the pad.

The implementation reuses the existing SVG art and local spring/IK math, without a new physics package or generated images. Research references: [Matter.js ragdoll example](https://github.com/liabru/matter-js/blob/master/examples/ragdoll.js), [Matter.js constraints](https://brm.io/matter-js/docs/classes/MouseConstraint.html), and [Motion springs](https://motion.dev/docs/react-use-spring). No external example code or assets were copied.

Verification covers emulated touch phones at 320×568, 375×667 and 390×844, portrait/landscape and a 321px-high embedded controller; all nine accepted reactions, drag/release, second-finger ownership, expiry, slow polling, offline/online recovery, reload, saved boundary values, retained drafts and separated names. Physical Android/iOS keyboards, hardware performance and real Wi-Fi remain unverified.

Schema: `db/schema.ts`, `drizzle/0009_avatar_live_poses.sql` and `server/avatar/schema.ts` declare the same sidecar table. Runtime bootstrap installs it idempotently; expired cosmetic rows are collected with normal room cleanup.
