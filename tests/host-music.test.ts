import assert from "node:assert/strict";
import test from "node:test";
import {
  isHostMusicPhaseMessage,
  isCurrentMusicPlayAttempt,
  isHostMusicRoute,
  canPlayHostMusic,
  musicFadeProgress,
  MENU_SOUNDTRACK_TRACKS,
  SOUNDTRACK_TRACKS,
  SOUNDTRACK_VOLUME,
  soundtrackForHostMusicGame,
} from "../lib/game/soundtrack";
import { additionalEffectRoles, buildMusicPlaylist, sequentialMusicFadeLevels, latestMusicTarget, approvedAudioForRole, countdownEffectRoleForSecond, effectRoleForPresentation, phaseMusicContext } from "../lib/game/audio-policy";
import type { ApprovedAudioClip } from "../lib/game/audio-library";
import {
  applyCanonicalMenuMusicPreferences,
  menuMusicPreferencesFromHostSettings,
} from "../lib/game/hostAudioPreferences";

test("host music defaults to a quiet title playlist with legacy tracks retained", () => {
  assert.equal(SOUNDTRACK_VOLUME, 0.2);
  assert.deepEqual(MENU_SOUNDTRACK_TRACKS, [
    "/media/music/medieval-01.mp3",
    "/media/music/medieval-02.mp3",
  ]);
});

test("music is limited to host, mirror, menu, and Arcade browsing routes", () => {
  for (const path of ["/", "/host/new", "/mirror", "/session/ABCD/host", "/session/ABCD/mirror", "/display/ABCD", "/arcade", "/arcade/online/new"]) {
    assert.equal(isHostMusicRoute(path), true, path);
  }
  for (const path of ["/play", "/play/ABCD", "/session/ABCD/play", "/arcade/online/join", "/arcade/online/join/ABCD", "/arcade/games/demo"]) {
    assert.equal(isHostMusicRoute(path), false, path);
  }
});

test("embedded frames and phone landing pages never play host music", () => {
  assert.equal(canPlayHostMusic("/session/ABCD/host", true, false), false);
  assert.equal(canPlayHostMusic("/", false, true), false);
  assert.equal(canPlayHostMusic("/host/new", false, true), false);
  assert.equal(canPlayHostMusic("/session/ABCD/host", false, true), true);
  assert.equal(canPlayHostMusic("/session/ABCD/mirror", false, false), true);
});

test("phase messages require a supported game ID and phase", () => {
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "menu" }), true);
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "game", gameId: "standard" }), true);
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "game", gameId: "sumo" }), true);
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "game" }), false);
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "game", gameId: "made-up" }), false);
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "game", gameId: "__proto__" }), false);
  assert.equal(isHostMusicPhaseMessage({ type: "other", phase: "menu" }), false);
});

test("music fade progress clamps early and delayed animation frames", () => {
  assert.equal(musicFadeProgress(984, 1000, 1200), 0);
  assert.equal(musicFadeProgress(1600, 1000, 1200), 0.5);
  assert.equal(musicFadeProgress(5000, 1000, 1200), 1);
});

test("sequential music envelopes never make incoming and outgoing decks positive together", () => {
  for (const stage of ["fade-out", "fade-in"] as const) {
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      const levels = sequentialMusicFadeLevels(stage, progress, 0.2);
      assert.ok(levels.incoming === 0 || levels.outgoing === 0);
      assert.ok(levels.incoming >= 0 && levels.incoming <= 0.2);
      assert.ok(levels.outgoing >= 0 && levels.outgoing <= 0.2);
    }
  }
  assert.deepEqual(sequentialMusicFadeLevels("fade-out", 0.5, 0.2), { incoming: 0, outgoing: 0.1 });
  assert.deepEqual(sequentialMusicFadeLevels("fade-in", 0.5, 0.2), { incoming: 0.1, outgoing: 0 });
});

const approvedFixture: ApprovedAudioClip[] = [
  { id: "menu-a", src: "/approved/menu-a.mp3", title: "Menu A", category: "music", role: "menu", durationSeconds: 45, gain: 0.5 },
  { id: "think-a", src: "/approved/think-a.mp3", title: "Think A", category: "music", role: "thinking", durationSeconds: 40, gain: 0.45 },
  { id: "think-b", src: "/approved/think-b.mp3", title: "Think B", category: "music", role: "thinking", durationSeconds: 42, gain: 0.45 },
  { id: "game-a", src: "/approved/game-a.mp3", title: "Game A", category: "music", role: "game", durationSeconds: 44, gain: 0.5 },
  { id: "game-b", src: "/approved/game-b.mp3", title: "Game B", category: "music", role: "game", durationSeconds: 46, gain: 0.5 },
  { id: "join-a", src: "/approved/join-a.mp3", title: "Join A", category: "effect", role: "join", durationSeconds: 1, gain: 0.5 },
  { id: "timer-a", src: "/approved/timer-a.mp3", title: "Timer A", category: "effect", role: "timer", durationSeconds: 0.2, gain: 0.3 },
];

test("context playlists rotate approved variants with legacy music and approved role tracks", () => {
  const menu = buildMusicPlaylist("menu", "standard", approvedFixture);
  const thinking = buildMusicPlaylist("thinking", "standard", approvedFixture);
  assert.ok(menu.includes("/approved/menu-a.mp3"));
  assert.ok(menu.includes("/media/music/medieval-01.mp3"));
  assert.ok(menu.includes("/media/music/medieval-02.mp3"));
  assert.deepEqual(thinking.slice(0, 4), ["/approved/think-a.mp3", "/media/music/medieval-05.mp3", "/approved/think-b.mp3", "/media/music/medieval-01.mp3"]);
  const game = buildMusicPlaylist("game", "standard", approvedFixture);
  assert.deepEqual(game.slice(0, 4), ["/approved/game-a.mp3", "/media/music/medieval-05.mp3", "/approved/game-b.mp3", "/media/music/medieval-01.mp3"]);
  for (const legacy of SOUNDTRACK_TRACKS) assert.ok(buildMusicPlaylist("game", "standard", approvedFixture).includes(legacy));
});

test("every approved music context is supported and effect roles map only to semantic presentation events", () => {
  for (const context of ["menu", "thinking", "voting", "game", "results"] as const) {
    assert.ok(buildMusicPlaylist(context, "standard", approvedFixture).length > 0);
  }
  assert.equal(approvedAudioForRole("join", approvedFixture)[0]?.id, "join-a");
  assert.equal(approvedAudioForRole("timer", approvedFixture)[0]?.id, "timer-a");
  assert.equal(effectRoleForPresentation("player.joined"), "join");
  assert.equal(effectRoleForPresentation("winner.revealed"), "winner");
  assert.equal(effectRoleForPresentation("phase.entered"), undefined);
  assert.deepEqual(additionalEffectRoles("winner.revealed", "standard", "FINAL_RESULTS", "FINAL_VOTING"), ["pigeon"]);
  assert.deepEqual(additionalEffectRoles("answer.revealed", "comic", "REVEAL", "VOTING"), ["comic"]);
  assert.deepEqual(additionalEffectRoles("phase.entered", "standard", "REVEAL", "FINAL_VOTING"), ["all-votes"]);
  assert.deepEqual(additionalEffectRoles("phase.entered", "standard", "REVEAL", "ANSWERING"), []);
  assert.equal(countdownEffectRoleForSecond(5), "timer");
  assert.equal(countdownEffectRoleForSecond(2), "timer");
  assert.equal(countdownEffectRoleForSecond(4), "timer");
  assert.equal(countdownEffectRoleForSecond(0), undefined);
  assert.equal(phaseMusicContext("ANSWERING"), "thinking");
  assert.equal(phaseMusicContext("FINAL_VOTING"), "voting");
  assert.equal(phaseMusicContext("FINAL_RESULTS"), "results");
  assert.equal(phaseMusicContext("ROUND_RESULTS"), "results");
  assert.equal(phaseMusicContext("ARCADE_RESULTS"), "results");
  assert.equal(phaseMusicContext("IMAGE_REVEAL"), "game");
  assert.equal(phaseMusicContext("REVEAL"), "game");
  assert.equal(phaseMusicContext("ROUND_INTRO"), "thinking");
  assert.equal(phaseMusicContext("LOBBY"), "menu");
});

test("rapid phase changes retain only the most recent queued music target", () => {
  assert.equal(latestMusicTarget("thinking", "results"), "results");
  assert.equal(latestMusicTarget("thinking", null), "thinking");
  assert.equal(isCurrentMusicPlayAttempt(8, 8), true);
  assert.equal(isCurrentMusicPlayAttempt(7, 8), false);
});

test("unknown online game IDs fall back to an available Arcade soundtrack", () => {
  assert.equal(soundtrackForHostMusicGame("royal-sumo"), "/media/music/medieval-03.mp3");
  assert.equal(soundtrackForHostMusicGame("standard"), "/media/music/medieval-05.mp3");
});

test("online game IDs are accepted and use the Arcade fallback soundtrack", () => {
  assert.equal(isHostMusicPhaseMessage({ type: "host-music-phase", phase: "game", gameId: "sumo" }), true);
  assert.equal(soundtrackForHostMusicGame("royal-sumo"), "/media/music/medieval-03.mp3");
});

test("stale media play attempts cannot mutate the current deck", () => {
  assert.equal(isCurrentMusicPlayAttempt(3, 3), true);
  assert.equal(isCurrentMusicPlayAttempt(2, 3), false);
});

test("canonical menu music overrides stale host mute settings while preserving SFX preferences", () => {
  const result = applyCanonicalMenuMusicPreferences({
    muted: true,
    music: false,
    musicVolume: 0.45,
    effects: false,
    narrator: true,
    voiceURI: "preferred-voice",
  }, { soundEnabled: true, volume: 0.2 });

  assert.deepEqual(result, {
    muted: false,
    music: true,
    musicVolume: 0.2,
    effects: false,
    narrator: true,
    voiceURI: "preferred-voice",
  });
});

test("explicit host mute and volume changes normalize into canonical menu preferences", () => {
  assert.deepEqual(menuMusicPreferencesFromHostSettings({ muted: true, music: true, musicVolume: 0.45 }), {
    soundEnabled: false,
    volume: 0.45,
  });
  assert.deepEqual(menuMusicPreferencesFromHostSettings({ muted: false, music: true, musicVolume: 1.4 }), {
    soundEnabled: true,
    volume: 1,
  });
});
