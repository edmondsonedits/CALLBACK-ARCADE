export const GAME_CONTROLS = {
  "royal-ballistix": {
    title: "Royal Ballistix",
    axis: "slide",
    actions: ["Magnet", "Pulse", "Run"],
    hint: "Slide to guard your gate. Hold Magnet, then release to fire.",
  },
  "royal-roller-ruckus": {
    title: "Royal Roller Ruckus",
    axis: "stick",
    actions: [],
    hint: "Roll and steer. Carry momentum through the bends.",
  },
  "royal-sumo": {
    title: "Royal Sumo",
    axis: "stick",
    actions: ["Bash", "Dash"],
    hint: "Hold Bash to charge, release to shove. Dash into space.",
  },
  "royal-twisted": {
    title: "Royal Twisted",
    axis: null,
    actions: ["Jump", "Duck"],
    hint: "Jump cyan rods. Hold Duck for coral rods.",
  },
  "royal-scratch-match": {
    title: "Royal Scratch Match",
    axis: null,
    actions: ["A", "B", "X", "Y"],
    hint: "Watch the DJ, then tap when your notes reach the rings.",
  },
  "space-bash": {
    title: "Space Bash",
    axis: "stick",
    actions: ["Grab / Throw", "Kick", "Jump"],
    hint: "Move, grab a crate, then throw. Stay off broken tiles.",
  },
};
export const neutralInput = () => ({
  moveX: 0,
  moveY: 0,
  primaryAction: false,
  secondaryAction: false,
  tertiaryAction: false,
  run: false,
});
export function createAdapter(id, w) {
  const api =
    id === "royal-ballistix"
      ? w.RoyalBallistix
      : id === "royal-roller-ruckus"
        ? w.CallbackInput
        : id === "royal-sumo"
          ? w.RoyalSumo
          : id === "royal-twisted"
            ? w.RoyalTwisted
            : id === "royal-scratch-match"
              ? w.ScratchMatchAPI
              : w.SpaceBash;
  if (!api || !GAME_CONTROLS[id]) throw Error("Game input hooks are not ready");
  const prior = new Map(),
    names = new Map(),
    charge = new Map();
  const configure = () => {
    if (id === "royal-sumo") api.multiplayer.setFighterCount(10);
    else if (id === "royal-scratch-match")
      api.configure({ playerCount: 10, humanPlayers: [0] });
    else if (id === "space-bash") api.setPlayers(10);
    else api.setPlayerCount(10);
  };
  const start = () => {
    if (id === "royal-scratch-match") {
      api.start();
      for (const [seat, name] of names) claim(seat, name);
    }
  };
  const claim = (seat, name) => {
    names.set(seat, name);
    if (id === "royal-ballistix") api.setPlayerInput(seat, neutralInput());
    else if (id === "royal-roller-ruckus")
      api.push(seat, { ...neutralInput(), name });
    else if (id === "royal-twisted") api.registerRemotePlayer(seat, name);
    else if (id === "royal-sumo") {
      api.multiplayer.setHumanSlot(seat, true);
      api.multiplayer.setPlayerName(seat, name);
    } else if (id === "royal-scratch-match" || id === "space-bash")
      api.setHumanSlot(seat, true, name);
  };
  const release = (seat) => {
    names.delete(seat);
    prior.delete(seat);
    charge.delete(seat);
    if (id === "royal-ballistix") api.releasePlayer(seat);
    else if (id === "royal-roller-ruckus") api.disconnect(seat);
    else if (id === "royal-twisted") api.releaseRemotePlayer(seat);
    else if (id === "royal-sumo") {
      api.multiplayer.submitInput(seat, { moveX: 0, moveY: 0 });
      api.multiplayer.setHumanSlot(seat, false);
    } else api.setHumanSlot(seat, false);
  };
  const input = (seat, p, sequence) => {
    const old = prior.get(seat) || neutralInput();
    if (id === "royal-ballistix") api.setPlayerInput(seat, { ...p, sequence });
    else if (id === "royal-roller-ruckus")
      api.push(seat, { ...p, sequence, name: names.get(seat) });
    else if (id === "royal-twisted") {
      if (p.primaryAction && !old.primaryAction) api.input(seat, "jump", true);
      api.input(seat, "duck", !!p.secondaryAction);
    } else if (id === "royal-sumo") {
      if (p.primaryAction && !old.primaryAction)
        charge.set(seat, performance.now());
      const fire = !p.primaryAction && old.primaryAction;
      api.multiplayer.submitInput(seat, {
        moveX: p.moveX || 0,
        moveY: p.moveY || 0,
        bashPressed: fire,
        bashCharge: fire
          ? Math.min(
              1,
              Math.max(
                0.12,
                (performance.now() - (charge.get(seat) || performance.now())) /
                  900,
              ),
            )
          : 0.12,
        dashPressed: !!p.secondaryAction && !old.secondaryAction,
        sequence,
      });
    } else if (id === "royal-scratch-match") {
      if (Number.isInteger(p.lane)) api.press(seat, p.lane);
    } else api.submitInput(seat, p);
    prior.set(seat, { ...p });
  };
  const neutralize = (seat, sequence) => {
    prior.delete(seat);
    charge.delete(seat);
    if (id === "royal-ballistix") api.cancelPlayerInput(seat);
    else if (id === "royal-roller-ruckus") api.neutralize(seat);
    else input(seat, neutralInput(), sequence);
  };
  const pause = (value) => {
    if (value) {
      for (const seat of names.keys()) neutralize(seat);
    }
    api.setPaused?.(value);
  };
  const getState = () =>
    id === "royal-roller-ruckus"
      ? { controllers: api.getControllers(), playerCount: api.getPlayerCount() }
      : api.getState();
  return {
    configure,
    claim,
    release,
    input,
    neutralize,
    pause,
    getState,
    start,
  };
}
