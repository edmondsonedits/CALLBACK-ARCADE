# Archived Game Packs

Archive date: 2026-10-13

Restore reference: pre-archive live Sites v72 source, commit `a1c825868351819257833caf70944d88b7a08306`. The previous landing, setup, and help pages are also preserved in Git history.

These game packs are unavailable for new rooms. Their existing source, content, mechanics, and serialization support stay in the repository so a reviewed restoration can reuse them without recovering deleted data.

| Pack ID | Display name | Archive date |
| --- | --- | --- |
| `bowl` | Bowl of Fools Classic | 2026-10-13 |
| `royal-war-room` | Royal War Room | 2026-10-13 |
| `birthday` | 30th Birthday | 2026-10-13 |

New room creation and shared-session launch validation reject these IDs. Public launch selectors omit them, and old birthday or setup links show an unavailable message that returns to the active menu. Existing archived rooms can continue their current game; they cannot start or replay an archived game. No archive menu or public archive launcher is provided.

To restore a pack, review its content, engine behavior, and current product fit; remove its ID from `lib/game/archived-packs.ts`; restore the appropriate discovery entries in `app/components/GrandHallMenu.tsx`, `app/components/SessionLobby.tsx`, `app/components/RoomSetupForm.tsx`, `app/components/DeveloperLauncher.tsx`, the host setup controls, and help content; restore its public route if applicable; then add launch and regression coverage. Keep the serialized game ID and existing engine support stable so already-persisted rooms remain readable.
