import { RoomTransport, post, sessionKey } from "./transport.js";
import { createAdapter, GAME_CONTROLS } from "./game-adapters.js";
const $ = (id) => document.getElementById(id),
  frame = $("game");
let transport,
  room,
  adapter,
  previousPhase,
  welcomeSeen = false,
  recoveryRequired = false,
  connected = new Map();
function reconcile() {
  if (!adapter || !room) return;
  for (const seat of connected.keys())
    if (!room.slots.some((s) => s.seat === seat && s.connected)) {
      adapter.release(seat);
      connected.delete(seat);
    }
  for (const slot of room.slots)
    if (slot.seat > 0 && slot.connected && !connected.has(slot.seat)) {
      adapter.claim(slot.seat, slot.name);
      connected.set(slot.seat, slot.name);
    }
  adapter.pause(
    room.phase !== "running" || !transport?.ready || !room.hostConnected,
  );
}
function loadGame() {
  adapter = null;
  connected.clear();
  frame.hidden = false;
  frame.src = `/games/${room.gameId}/source/index.html`;
}
function update(next) {
  room = next;
  $("phase").textContent = {
    waiting: "Ready when you are",
    running: "Game in progress",
    paused: "Paused — ready to resume",
    ended: "Room ended",
  }[room.phase];
  $("roster").replaceChildren(
    ...room.slots.map((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.seat === 0 ? "Shared screen" : s.name} · ${s.connected ? "Connected" : s.bot ? "Bot" : "Offline"}`;
      return li;
    }),
  );
  for (const action of ["start", "pause", "resume", "restart"])
    $(action).disabled =
      !adapter ||
      !transport?.ready ||
      (action === "resume" && recoveryRequired) ||
      (action === "start"
        ? room.phase !== "waiting"
        : action === "pause"
          ? room.phase !== "running"
          : action === "resume"
            ? room.phase !== "paused"
            : room.phase === "ended");
  if (
    previousPhase &&
    previousPhase !== "waiting" &&
    room.phase === "waiting"
  ) {
    recoveryRequired = false;
    $("error").textContent = "";
    loadGame();
  }
  if (previousPhase === "waiting" && room.phase === "running") adapter?.start();
  previousPhase = room.phase;
  reconcile();
}
frame.addEventListener("load", () => {
  try {
    adapter = createAdapter(room.gameId, frame.contentWindow);
    adapter.configure();
    if (room.phase === "running") adapter.start();
    reconcile();
    update(room);
    $("notice").hidden = true;
  } catch (e) {
    $("error").textContent = e.message;
  }
});
for (const action of ["start", "pause", "resume", "restart"])
  $(action).onclick = () => transport?.send({ type: action });
try {
  const params = new URLSearchParams(location.search);
  let code = params.get("room")?.toUpperCase(),
    saved = code && sessionStorage.getItem(sessionKey("host", code));
  let info = saved && JSON.parse(saved);
  if (!info) {
    if (code)
      throw Error(
        "This browser does not hold the host seat. Open the controller link, or create a new room from the arcade.",
      );
    const gameId = params.get("game");
    if (!GAME_CONTROLS[gameId])
      throw Error("Choose a game from the arcade first.");
    info = await post("/api/rooms", { gameId });
    code = info.code;
    sessionStorage.setItem(sessionKey("host", code), JSON.stringify(info));
    history.replaceState(null, "", `/host.html?room=${code}`);
  }
  const link = new URL(`/join.html?code=${code}`, location.href).href;
  $("code").textContent = code;
  $("join").href = link;
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      $("copy").textContent = "Link copied";
    } catch {
      $("error").textContent = "Copy the phone controller link above.";
    }
  };
  if (window.qrcode) {
    const qr = window.qrcode(0, "M");
    qr.addData(link);
    qr.make();
    $("qr").innerHTML = qr.createSvgTag({ cellSize: 3 });
    $("qr").setAttribute("aria-label", `Scan to join room ${code}`);
  }
  $("title").textContent = GAME_CONTROLS[info.gameId].title;
  room = { gameId: info.gameId, slots: [], phase: "waiting" };
  loadGame();
  transport = new RoomTransport({
    code,
    token: info.hostToken,
    role: "host",
    onStatus: (status) => {
      $("connection").textContent = status;
      if (!transport?.ready) {
        adapter?.pause(true);
        for (const action of ["start", "pause", "resume", "restart"])
          $(action).disabled = true;
      }
    },
    onMessage: (msg) => {
      if (msg.type === "welcome" || msg.type === "room") {
        update(msg.room);
        if (msg.type === "welcome") {
          if (msg.room.phase === "paused") {
            recoveryRequired = true;
            $("resume").disabled = true;
            $("error").textContent =
              "Shared screen reconnected. Choose New round to restart safely.";
          }
          if (welcomeSeen) loadGame();
          welcomeSeen = true;
        }
      } else if (msg.type === "input" && adapter) {
        if (msg.neutral) adapter.neutralize(msg.seat, msg.sequence);
        else adapter.input(msg.seat, msg.payload, msg.sequence);
      } else if (msg.type === "error") $("error").textContent = msg.error;
    },
  });
  setInterval(() => {
    if (
      adapter &&
      transport.ready &&
      ["running", "paused"].includes(room.phase)
    ) {
      try {
        const data = adapter.getState();
        if (JSON.stringify(data).length < 24000)
          transport.send({ type: "snapshot", data });
      } catch {
        $("error").textContent = "Game state unavailable. Start a new round.";
      }
    }
  }, 1000);
} catch (e) {
  $("notice").textContent = e.message;
  $("error").textContent = e.message;
}
