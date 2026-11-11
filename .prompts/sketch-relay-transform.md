# Sketch & Sorcery — reference transform

Provider: the existing Cloudflare Workers AI image adapter. Model: `flux-2-fast` (`@cf/black-forest-labs/flux-2-klein-4b`). One attempt with one actual uploaded PNG reference, square output; no text-only or alternate-model retry.

Transform the supplied hand-drawn sketch into a polished, playful medieval fantasy 3D illustration. The reference image is the sole source of the subject, objects, action, arrangement, and visual joke. Preserve recognizable silhouettes, number of subjects, positions, relationships, and unusual details. Interpret rough marks faithfully. Give the existing shapes charming dimensional materials, soft cinematic lighting, coherent depth, and a simple fantasy setting. Keep the full composition readable in a square frame. Do not add a different subject, invent a story, write captions, or replace the sketch with an unrelated scene. Return only the transformed image.

The original prompt and caption are deliberately excluded from this request. On any provider/storage failure, the game labels and shows the real source drawing as its fallback.
