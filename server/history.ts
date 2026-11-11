import { scoreTotals } from "./engine";
import { getD1, runtimeEnv } from "./database";
import type { RoomState } from "./types";

export interface HistoryPlayer {
  id: string;
  nickname: string;
  avatar: number;
  avatarConfig?: unknown;
  avatarPreset?: string | null;
  color: string;
  bot: boolean;
  score: number;
  winner: boolean;
}

export interface HistoryMatch {
  id: string;
  gameId?: string;
  rulesVersion?: number;
  code: string;
  matchNumber: number;
  gameLength: string;
  title: string;
  playedAt: number;
  players: HistoryPlayer[];
  winnerIds: string[];
  rounds: Array<Record<string, unknown>>;
  images: Array<{
    assetId: string;
    roundId: string | null;
    kind: string;
    prompt: string | null;
  }>;
  comicTheme: string | null;
  comicFrames: RoomState["comicFrames"];
  restoration: {
    base: string | null;
    assignments: RoomState["kingRestorationAssignments"];
    winningAnswerIds: string[];
  } | null;
  awards: RoomState["awards"];
}

const matchTitle = (state: RoomState) =>
  state.arcadeGameId === "sketch-relay" ? "Sketch & Sorcery" :
  state.gameLength === "bowl-of-fools"
    ? "Bowl of Fools"
    : state.gameLength === "royal-war-room"
    ? `Royal War Room · ${state.warCampaign === "ATTACK" ? "Invasion" : "Defence"}`
    : state.gameLength === "royal-rumours"
      ? "Royal Rumours"
      : state.gameLength === "king-mystery"
        ? "The Royal Frame-Up"
        : state.gameLength === "pictures"
          ? "King Prompter"
          : state.gameLength === "comic"
            ? "Let's Make a Comic"
            : state.gameLength === "birthday"
              ? `${state.birthdayName ?? "Birthday"}'s Big 30`
              : "Legacy Standard";

export async function archiveCompletedMatch(state: RoomState): Promise<void> {
  // Independent projection retries even when the older generic archive already exists.
  // Archive/storage failure must never prevent the completed game being saved.
  try { const { archiveSketchShowcase } = await import("./sketch-showcase"); await archiveSketchShowcase(state); } catch { /* Retry on the next completed write or artist preference visit. */ }
  const database = getD1();
  const id = `${state.id}-match-${state.matchNumber}`;
  const exists = await database
    .prepare("SELECT 1 AS found FROM history_matches WHERE id = ?")
    .bind(id)
    .first<{ found: number }>();
  if (exists) return;
  const [roundRows, answerRows, voteRows, jobRows] = await Promise.all([
    database
      .prepare(
        "SELECT id, round_index, kind, state_json, started_at, completed_at FROM match_rounds WHERE room_id = ? AND match_number = ? ORDER BY round_index",
      )
      .bind(state.id, state.matchNumber)
      .all<Record<string, unknown>>(),
    database
      .prepare(
        "SELECT a.id, a.round_id, a.player_id, a.text, a.submitted_at FROM answers a JOIN match_rounds r ON r.id=a.round_id AND r.room_id=a.room_id WHERE a.room_id = ? AND r.match_number = ? AND a.hidden = 0 ORDER BY a.submitted_at",
      )
      .bind(state.id, state.matchNumber)
      .all<Record<string, unknown>>(),
    database
      .prepare(
        "SELECT v.round_id, v.voter_id, v.answer_id, v.rank, v.weight, v.audience FROM votes v JOIN match_rounds r ON r.id=v.round_id AND r.room_id=v.room_id WHERE v.room_id = ? AND r.match_number = ? ORDER BY v.round_id, v.voter_id, v.rank",
      )
      .bind(state.id, state.matchNumber)
      .all<Record<string, unknown>>(),
    database
      .prepare(
        "SELECT id, round_id, kind, status, prompt_json, object_key, content_type, byte_size FROM jobs WHERE room_id = ? AND (round_id IN (SELECT id FROM match_rounds WHERE room_id = ? AND match_number = ?) OR id IN (?, ?) OR (? IS NOT NULL AND json_valid(prompt_json) AND json_extract(prompt_json,'$.matchId') = ?)) ORDER BY created_at",
      )
      .bind(state.id, state.id, state.matchNumber, state.anchorImage?.jobId ?? null, state.finalImage?.jobId ?? null, state.sketchRelay?.matchId ?? null, state.sketchRelay?.matchId ?? null)
      .all<{
        id: string;
        round_id: string | null;
        kind: string;
        status: string;
        prompt_json: string;
        object_key: string | null;
        content_type: string | null;
        byte_size: number | null;
      }>(),
  ]);
  const totals = state.gameLength === "bowl-of-fools"
    ? Object.fromEntries(state.participants.filter((player) => player.role === "player").map((player) => [player.id, state.foolTeamScores[state.foolTeams[player.id] ?? "BELLS"]]))
    : scoreTotals(state);
  const high = Math.max(0, ...Object.values(totals));
  const winnerIds = Object.entries(totals)
    .filter(([, score]) => score === high)
    .map(([playerId]) => playerId);
  const players: HistoryPlayer[] = state.participants
    .filter((player) => player.role === "player" && !player.removedAt)
    .map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      avatarConfig: player.avatarConfig,
      avatarPreset: player.avatarPreset,
      color: player.color,
      bot: Boolean(player.bot),
      score: totals[player.id] ?? 0,
      winner: winnerIds.includes(player.id),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.nickname.localeCompare(right.nickname),
    );
  const answersByRound = new Map<string, Array<Record<string, unknown>>>();
  for (const answer of answerRows.results)
    answersByRound.set(String(answer.round_id), [
      ...(answersByRound.get(String(answer.round_id)) ?? []),
      answer,
    ]);
  const votesByRound = new Map<string, Array<Record<string, unknown>>>();
  for (const vote of voteRows.results)
    votesByRound.set(String(vote.round_id), [
      ...(votesByRound.get(String(vote.round_id)) ?? []),
      vote,
    ]);
  const rounds = roundRows.results.map((row) => {
    const parsed = JSON.parse(String(row.state_json || "{}")) as Record<
      string,
      unknown
    >;
    return {
      id: row.id,
      index: row.round_index,
      kind: row.kind,
      label: parsed.label,
      prompt: parsed.prompt,
      instruction: parsed.instruction,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      answers: answersByRound.get(String(row.id)) ?? [],
      votes: votesByRound.get(String(row.id)) ?? [],
      results: parsed.results ?? null,
    };
  });
  const images: HistoryMatch["images"] = [];
  const storage = runtimeEnv().MEDIA;
  const mediaStatements: D1PreparedStatement[] = [];
  for (const job of jobRows.results.filter((item) => {
    if (item.status !== "READY" || !item.object_key) return false;
    if (state.arcadeGameId !== "sketch-relay") return true;
    // The room can contain earlier matches and a later fish bonus. This archive is the main match.
    if (!["SKETCH_UPLOAD", "SKETCH_TRANSFORM"].includes(item.kind)) return false;
    try { return (JSON.parse(item.prompt_json) as { matchId?: string }).matchId === state.sketchRelay?.matchId; } catch { return false; }
  })) {
    if (!storage || !["image/png", "image/jpeg", "image/webp"].includes(job.content_type ?? "")) continue;
    const extension = job.content_type === "image/png" ? "png" : job.content_type === "image/jpeg" ? "jpg" : "webp";
    const objectKey = `history/${id}/${job.id}.${extension}`;
    const source = await storage.get(job.object_key!);
    if (!source || job.byte_size !== null && source.size !== job.byte_size) continue;
    await storage.put(objectKey, source.body, {
      httpMetadata: { contentType: job.content_type! },
      customMetadata: { matchId: id, assetId: job.id },
    });
    const copied = await storage.head(objectKey);
    if (!copied || copied.size !== source.size) continue;
    let prompt: string | null = null;
    try {
      const payload = JSON.parse(job.prompt_json) as {
        prompt?: string;
        userPrompt?: string;
        visualBrief?: string;
      };
      prompt =
        payload.userPrompt ?? payload.visualBrief ?? payload.prompt ?? null;
    } catch {
      prompt = null;
    }
    images.push({
      assetId: job.id,
      roundId: job.round_id,
      kind: job.kind,
      prompt,
    });
    mediaStatements.push(
      database
        .prepare(
          "INSERT OR IGNORE INTO history_media(match_id, asset_id, object_key, content_type, byte_size) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          id,
          job.id,
          objectKey,
          job.content_type ?? "image/webp",
          job.byte_size,
        ),
    );
  }
  const finalResults = state.currentRound?.results as {
    winningAnswerIds?: string[];
    finalWinningAnswerIds?: string[];
  } | null;
  const archive: HistoryMatch = {
    id,
    ...(state.arcadeGameId ? { gameId: state.arcadeGameId, ...(state.sketchRelay?.showdown ? { rulesVersion: state.sketchRelay.showdown.version } : {}) } : {}),
    code: state.code,
    matchNumber: state.matchNumber,
    gameLength: state.gameLength,
    title: matchTitle(state),
    playedAt: state.updatedAt,
    players,
    winnerIds,
    rounds,
    images,
    comicTheme: state.comicTheme,
    comicFrames: state.comicFrames,
    restoration:
      state.gameLength === "pictures"
        ? {
            base: state.kingRestorationBase,
            assignments: state.kingRestorationAssignments,
            winningAnswerIds:
              finalResults?.finalWinningAnswerIds ??
              finalResults?.winningAnswerIds ??
              [],
          }
        : null,
    awards: state.awards,
  };
  const winnerNames = players
    .filter((player) => player.winner)
    .map((player) => player.nickname)
    .join(", ");
  await database.batch([
    database
      .prepare(
        "INSERT OR IGNORE INTO history_matches(id, room_id, match_number, room_code, game_length, title, player_count, winner_names, played_at, archive_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        state.id,
        state.matchNumber,
        state.code,
        state.gameLength,
        archive.title,
        players.length,
        winnerNames,
        archive.playedAt,
        JSON.stringify(archive),
      ),
    ...mediaStatements,
  ]);
}

export async function listHistoryMatches(filters: {
  mode?: string;
  query?: string;
  limit?: number;
  offset?: number;
}) {
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (
    filters.mode &&
    [
      "royal-war-room",
      "bowl-of-fools",
      "royal-rumours",
      "king-mystery",
      "pictures",
      "comic",
      "birthday",
      "standard",
    ].includes(filters.mode)
  ) {
    clauses.push("game_length = ?");
    bindings.push(filters.mode);
  }
  if (filters.query) {
    clauses.push(
      "(title LIKE ? OR winner_names LIKE ? OR archive_json LIKE ?)",
    );
    const term = `%${filters.query.slice(0, 60)}%`;
    bindings.push(term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(50, Math.max(1, filters.limit ?? 24));
  const offset = Math.max(0, filters.offset ?? 0);
  const rows = await getD1()
    .prepare(
      `SELECT id, room_code, match_number, game_length, title, player_count, winner_names, played_at FROM history_matches ${where} ORDER BY played_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, limit, offset)
    .all<Record<string, unknown>>();
  return rows.results;
}

export async function getHistoryMatch(
  id: string,
): Promise<HistoryMatch | null> {
  const row = await getD1()
    .prepare("SELECT archive_json FROM history_matches WHERE id = ?")
    .bind(id)
    .first<{ archive_json: string }>();
  return row ? (JSON.parse(row.archive_json) as HistoryMatch) : null;
}
