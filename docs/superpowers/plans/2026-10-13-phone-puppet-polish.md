# Phone puppet polish implementation plan

**Goal:** Fit phone controls into distinct viewport-sized sections and attach clothing to the animated skeleton.

**Architecture:** Keep D1 cosmetic transport and authoritative gameplay unchanged. Game content stays mounted while secondary character screens are open, preserving drafts; inactive puppet input stops. Mobile customization exposes one field at a time.

- [x] Add failing mobile section/layout coverage, including nine actual accepted animations and reconnect.
- [x] Split puppet dragging, reactions and keyboard adjustments into separate screens; paginate keyboard controls.
- [x] Add Game/Character navigation to native and shared lobby phones, preserving game inputs.
- [x] Fit character customization into viewport pages with reachable Back/Done controls.
- [x] Attach clothing and accessories to the appropriate joints, preserving saved piece transforms.
- [ ] Verify compact portrait/landscape, touch ownership, animation delivery, reconnect and name separation; run release checks and publish exact source.

Review: background/cancel clears gestures; reduced motion remains usable; hidden sections cannot receive input; slow polling cannot overlap; native and shared room cookies remain distinct.
