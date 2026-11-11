# Aquarium artwork provenance

The aquarium light, plants, bubbles, and the reusable cartoon shark are original vector artwork authored for this feature in `app/components/fish/FishTank.tsx` and `FishTank.module.css`. The shark has independently animated tail, yaw, cavity, upper lip, teeth, and lower jaw; arbitrary submitted artwork meets the same explicit mouth anchor used by the drawing. No external raster artwork, stock packs, generated music, AI transformation, or third-party asset license is required.

Clearly labelled practice entries alone use the original deterministic fish SVG authored in that component. Real participants always use their own accepted transparent PNG. Unwarped original PNGs are used for champion, artist, inspection, and download views.

Rendering technique: a shared WebGL1 16×6 subdivision mesh, a continuous head-to-tail deformation field, premultiplied-alpha textures and `ONE / ONE_MINUS_SRC_ALPHA` blending. Reference: [MDN WebGL blendFunc](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFunc) and [MDN texImage2D](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D). The Canvas2D fallback retains actual source images, sampling the same wave through 40 continuously sheared strips with yaw-adjusted subpixel screen-space overlap when WebGL is unavailable. Reduced motion displays the original sprite without deformation. Decorative art is code, so its incremental transfer consists only of the compiled module and styles.

Audio cues are data events consumed by the existing host audio owner. This renderer does not start an independent music loop.
