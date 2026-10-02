import { RoomTransport, post, sessionKey } from "./transport.js";
import { GAME_CONTROLS, neutralInput } from "./game-adapters.js";
const $ = (id) => document.getElementById(id);
let transport,
  room,
  enabled = false,
  intent = neutralInput(),
  activePointers = new Map(),
  stickPointer = null,
  wake;
const savedCode = new URLSearchParams(location.search).get("code");
if (savedCode) $("code").value = savedCode.toUpperCase();
function send() {
  if (enabled) transport?.input({ ...intent });
}
function neutral() {
  activePointers.clear();
  stickPointer = null;
  intent = neutralInput();
  $("knob").style.transform = "translate(0,0)";
  if (enabled) transport?.cancel();
}
function status(next) {
  room = next;
  const was = enabled;
  enabled = transport.ready && room.hostConnected && room.phase === "running";
  if (was && !enabled) {
    neutral();
  }
  for (const b of $("controls").querySelectorAll("button:not(#awake)"))
    b.disabled = !enabled;
  $("stick").classList.toggle("disabled", !enabled);
  $("phase").textContent = !room.hostConnected
    ? "Waiting for the shared screen to reconnect"
    : {
        waiting: "Waiting for the host to start",
        running: "Look at the shared screen — you are playing!",
        paused: "Paused by the host",
        ended: "Room ended",
      }[room.phase];
}
function hold(button, field, value) {
  const update = () => {
    if (field === "moveX" || field === "moveY")
      intent[field] =
        [...activePointers.values()].filter((x) => x.field === field).at(-1)
          ?.value || 0;
    else
      intent[field] = [...activePointers.values()].some(
        (x) => x.field === field,
      );
    send();
  };
  button.onpointerdown = (e) => {
    if (!enabled) return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { field, value });
    update();
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, (e) => {
      if (event !== "pointerup" && activePointers.has(e.pointerId)) {
        neutral();
        return;
      }
      activePointers.delete(e.pointerId);
      update();
    });
  button.onkeydown = (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && enabled) {
      e.preventDefault();
      activePointers.set(`key:${field}`, { field, value });
      update();
    }
  };
  button.onkeyup = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      activePointers.delete(`key:${field}`);
      update();
    }
  };
  button.onblur = () => {
    if (activePointers.has(`key:${field}`)) neutral();
  };
}
function controls(id) {
  const config = GAME_CONTROLS[id];
  $("title").textContent = config.title;
  $("hint").textContent = config.hint;
  $("stick").hidden = !config.axis;
  $("directions").replaceChildren();
  if (config.axis) {
    for (const [label, field, value] of [
      ["←", "moveX", -1],
      ["→", "moveX", 1],
      ...(config.axis === "stick"
        ? [
            ["↑", "moveY", -1],
            ["↓", "moveY", 1],
          ]
        : []),
    ]) {
      const b = document.createElement("button");
      b.textContent = label;
      b.setAttribute(
        "aria-label",
        `Move ${label === "←" ? "left" : label === "→" ? "right" : label === "↑" ? "up" : "down"}`,
      );
      hold(b, field, value);
      $("directions").append(b);
    }
  }
  $("actions").replaceChildren(
    ...config.actions.map((label, index) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.action = String(index);
      if (id === "royal-scratch-match") {
        b.onclick = () => {
          if (enabled) transport.input({ ...neutralInput(), lane: index });
        };
      } else
        hold(
          b,
          id === "royal-ballistix" && index === 2
            ? "run"
            : ["primaryAction", "secondaryAction", "tertiaryAction"][index],
          true,
        );
      return b;
    }),
  );
  const stick = $("stick");
  function move(e) {
    if (e.pointerId !== stickPointer || !enabled) return;
    const rect = stick.getBoundingClientRect(),
      radius = rect.width * 0.35;
    let x = (e.clientX - rect.left - rect.width / 2) / radius,
      y = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    if (length < 0.12) {
      x = 0;
      y = 0;
    }
    intent.moveX = x;
    intent.moveY = config.axis === "slide" ? 0 : y;
    $("knob").style.transform =
      `translate(${x * radius}px,${intent.moveY * radius}px)`;
    send();
  }
  stick.onpointerdown = (e) => {
    if (!enabled || stickPointer !== null) return;
    e.preventDefault();
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    move(e);
  };
  stick.onpointermove = move;
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    stick.addEventListener(event, (e) => {
      if (e.pointerId !== stickPointer) return;
      if (event !== "pointerup") {
        neutral();
        return;
      }
      stickPointer = null;
      intent.moveX = 0;
      intent.moveY = 0;
      $("knob").style.transform = "translate(0,0)";
      send();
    });
}
$("join-form").onsubmit = async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  $("join-button").disabled = true;
  try {
    const code = $("code").value.trim().toUpperCase(),
      name = $("name").value.trim();
    const prior = sessionStorage.getItem(sessionKey("controller", code));
    const saved = prior && JSON.parse(prior);
    const info = await post(`/api/rooms/${encodeURIComponent(code)}/join`, {
      name,
      ...(saved ? { token: saved.seatToken } : {}),
    });
    sessionStorage.setItem(
      sessionKey("controller", code),
      JSON.stringify(info),
    );
    history.replaceState(null, "", `/join.html?code=${code}`);
    controls(info.gameId);
    $("identity").textContent = `${name} · Player ${info.seat + 1}`;
    $("join-form").hidden = true;
    $("controls").hidden = false;
    transport?.close();
    transport = new RoomTransport({
      code,
      token: info.seatToken,
      role: "controller",
      onStatus: (value) => {
        $("connection").textContent = value;
        if (!transport?.ready) {
          enabled = false;
          neutral();
          if (room) status(room);
        }
      },
      onMessage: (msg) => {
        if (msg.type === "welcome" || msg.type === "room") {
          neutral();
          status(msg.room);
        } else if (msg.type === "error") $("error").textContent = msg.error;
        else if (msg.type === "snapshot") {
          $("summary").textContent = msg.data?.phase
            ? `Game: ${msg.data.phase}`
            : "";
        }
      },
    });
  } catch (e) {
    $("error").textContent = e.message;
  } finally {
    $("join-button").disabled = false;
  }
};
if (savedCode) {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(
        sessionKey("controller", savedCode.toUpperCase()),
      ) || "null",
    );
    if (saved?.seatToken) {
      $("name").value =
        saved.room?.slots.find((s) => s.seat === saved.seat)?.name || "Player";
      $("join-form").requestSubmit();
    }
  } catch {}
}
setInterval(() => {
  if (enabled && !document.hidden) send();
}, 50);
addEventListener("blur", neutral);
document.addEventListener("visibilitychange", () => {
  neutral();
  if (document.hidden) wake?.release();
});
$("awake").onclick = async () => {
  try {
    wake = await navigator.wakeLock.request("screen");
    $("awake").textContent = "Screen awake";
    wake.addEventListener("release", () => {
      $("awake").textContent = "Keep screen awake";
    });
  } catch {
    $("error").textContent =
      "Screen wake is unavailable. Keep this tab visible while playing.";
  }
};
