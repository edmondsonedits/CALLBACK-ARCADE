# Grand Hall poster generation notes

Status: Candidate A production-approved for Checkpoint B  
Generated: 2026-08-27  
Tool: built-in OpenAI ImageGen  
Use case: `stylized-concept`

## Candidate A — recommended

Create a textless painterly Grand Hall serving as the theatrical broadcast entrance to an absurd enchanted medieval castle. Show a vast royal hall transformed into a playful live-variety-show stage with deep navy velvet curtains, balcony silhouettes, restrained stage machinery, carved stone arches, subtle cyan magical stage light, and small gold/coral/purple ornaments at the outer edges. Use polished hand-painted game-environment concept art with tactile storybook brushwork and sophisticated comedy.

Frame it as a frontal cinematic 16:9 establishing view with architectural symmetry, 5% overscan, and an empty low-detail central stage spanning approximately x 16–84% and y 14–84% for live HTML. Keep brighter props and detail at the outer edges. Use dominant `#101A3B`, `#172451`, and `#070D25`, restrained `#46DBDC` glow, and small `#FFD84B`, `#FF6F61`, and `#9C7CFF` accents.

Exclude all words, letters, numbers, logos, labels, buttons, signs, readable banners, screens, room codes, crowns, pigeons, people, faces, characters, watermarks, interface elements, bright central torches, centered thrones, centered doors, centered chandeliers, and busy central detail.

## Candidate B — alternate

Create a textless painterly Grand Hall broadcast stage inside an absurd enchanted medieval castle with gently crooked stone arches, layered theatre balconies, velvet curtain wings, whimsical rigging silhouettes, faint magical cyan windows, and tasteful gold/coral/purple set dressing at the extreme edges. Use cinematic hand-painted storybook concept art with readable value grouping and elegant medieval comedy.

Frame it in wide 16:9 with a mostly symmetrical but slightly wonky hall, 5% overscan, and an empty central broadcast floor spanning x 16–84% and y 14–84%. Keep props outside that field and preserve a useful center crop for phones. Use dominant navy values with restrained cyan atmosphere and small warm accents.

Exclude all text, glyphs, logos, menus, controls, signs, banners, screens, crowns, pigeons, people, creatures, faces, characters, watermarks, centered objects, bright central lights, contemporary technology, and busy central detail.

## Production derivation

- Native outputs: 1672×941 PNG.
- Candidate A was centre-cropped and Lanczos-upscaled to the 2560×1440 review master.
- Desktop AVIF/WebP: 2560×1440, 1920×1080, and 1280×720.
- Phone AVIF/WebP crops: 780×1688 and 750×900.
- Candidate A was explicitly production-approved on 2026-08-27 and is served at runtime. Candidate B remains an alternate and is not served at runtime.
- Exact paths, hashes, dimensions, focal point, fallbacks, and approval state are recorded in `ASSET_MANIFEST.json`.
