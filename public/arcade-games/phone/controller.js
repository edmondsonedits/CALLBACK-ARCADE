/* Phone-only controls: no TV simulation, credentials, or hidden opponent state. */
(function () {
  'use strict';
  const noop = () => {};
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  const games = {
    'royal-sumo': { title: 'Royal Sumo', stick: true, buttons: [{ label: 'Bash', mask: 1, key: 'Space' }, { label: 'Dash', mask: 2, key: 'KeyX' }], hint: 'Move with the stick. Hold Bash to charge; release to strike. Dash breaks away.' },
    'royal-ballistix': { title: 'Royal Ballistix', stick: true, buttons: [{ label: 'Magnet', mask: 1, key: 'Space' }, { label: 'Pulse', mask: 2, key: 'KeyX' }], hint: 'Slide left / right. Hold Magnet to catch; release to send. Pulse fires once per press.' },
    'royal-scratch-match': { title: 'Royal Scratch Match', buttons: [{ label: 'A', mask: 1, key: 'KeyA', color: '#ff5db1' }, { label: 'B', mask: 2, key: 'KeyS', color: '#ffd34f' }, { label: 'X', mask: 4, key: 'KeyD', color: '#42d8ff' }, { label: 'Y', mask: 8, key: 'KeyF', color: '#ff7b57' }], hint: 'Watch the TV and tap the matching rune. Keys A / S / D / F also work.' },
    'royal-roller-ruckus': { title: 'Royal Roller Ruckus', stick: true, radar: true, buttons: [{ label: 'Recover', mask: 1, key: 'KeyR' }], hint: 'Steer your dot around the track: right is right, down is down. Recover after a fall.' },
    'royal-twisted': { title: 'Royal Twisted', buttons: [{ label: 'Jump', mask: 1, key: 'Space' }, { label: 'Duck', mask: 2, key: 'KeyX' }], hint: 'Jump low rods. Hold Duck under high rods. Watch your next-rod cue.' },
    'space-bash': { title: 'Space Bash', stick: true, buttons: [{ label: 'Grab / Throw', mask: 1, key: 'KeyE' }, { label: 'Kick', mask: 2, key: 'KeyF' }, { label: 'Jump', mask: 4, key: 'Space' }], hint: 'Move and face with the stick. Grab cargo, then throw it. Kick and Jump create space.' },
    'blind-crown': { title: 'Blind Crown', board: true, buttons: [], hint: 'Your plan is private. Choose Place or Aim, touch your board, then Lock. Sliders also work.' },
  };

  async function post(code, action, body) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 2500);
    try {
      const response = await fetch('/api/arcade-phone/' + code + '/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Connection failed'), { code: data.error?.code, status: response.status });
      return data;
    } finally { clearTimeout(timer); }
  }

  class Session {
    constructor({ code, request, now = Date.now, onChange = noop }) {
      this.code = code; this.request = request || ((action, body) => post(code, action, body)); this.now = now; this.onChange = onChange;
      this.queue = []; this.seq = 0; this.x = 0; this.y = 0; this.buttons = 0; this.sources = new Map(); this.snapshot = null;
      this.inflight = false; this.pollFlight = null; this.closed = false; this.suspended = false; this.offline = false;
      this.lastPoll = 0; this.lastSend = 0; this.failures = 0; this.pollFailures = 0; this.nextSendAt = 0; this.delayMs = null; this.error = '';
      this.plan = { x: .5, y: .5, a: 0, locked: false }; this.lastPlanSeq = 0; this.editing = false; this.planPhase = ''; this.planRound = null;
    }
    get enabled() {
      const s = this.snapshot, p = s?.privateState;
      return !!s && !this.closed && !this.suspended && !this.offline && this.now() - this.lastPoll <= 8000 && s.hostAlive && s.status.active && !s.status.paused && p?.alive !== false && p?.finished !== true && (s.game !== 'blind-crown' || p?.phase === 'planning');
    }
    receive(data) {
      const wasEnabled = this.enabled; this.snapshot = data; this.code = data.code; this.lastPoll = this.now(); this.offline = false; this.pollFailures = 0; this.error = '';
      this.seq = Math.max(this.seq, data.lastSeq || 0); this.queue = this.queue.filter(p => p.seq > (data.lastSeq || 0));
      const p = data.privateState;
      if (data.game === 'blind-crown' && p?.plan) {
        const boundary = this.planRound !== p.round || this.planPhase !== p.phase;
        if (boundary || (!this.editing && (p.appliedSeq || 0) >= this.lastPlanSeq)) this.plan = { ...p.plan };
        this.planRound = p.round; this.planPhase = p.phase;
        if (boundary) { this.editing = false; this.lastPlanSeq = 0; this.queue = this.queue.filter(packet => !packet.plan); }
      }
      if (!this.enabled) { this.resetControls(); this.queue = []; } else if (!wasEnabled) this.resetControls();
      this.onChange(this);
    }
    resetControls() { this.x = 0; this.y = 0; this.buttons = 0; this.sources.clear(); this.editing = false; }
    packet(kind = 'edge', withPlan = false) {
      if (!this.enabled) return;
      if (this.queue.length >= 64) { this.queue = []; this.resetControls(); this.error = 'Connection is delayed. Controls reset safely.'; }
      const tail = this.queue.at(-1);
      const coalesce = kind === 'axes' && tail && this.axisTail === tail && tail !== this.sending;
      const packet = { seq: coalesce ? tail.seq : ++this.seq, x: this.x, y: this.y, buttons: this.buttons };
      if (withPlan) { packet.plan = { ...this.plan }; this.lastPlanSeq = packet.seq; }
      // Only unsent axis snapshots may coalesce. Button/plan edges never do.
      if (coalesce) this.queue.pop();
      this.queue.push(packet); this.axisTail = kind === 'axes' ? packet : null;
      this.onChange(this); return packet;
    }
    button(mask, down, source = String(mask)) {
      if (!this.enabled) return;
      if (down) this.sources.set(source, mask); else this.sources.delete(source);
      const next = [...this.sources.values()].reduce((value, bit) => value | bit, 0);
      if (next !== this.buttons) { this.buttons = next; this.packet(); }
    }
    axes(x, y) {
      if (!this.enabled) return;
      x = clamp(x, -1, 1); y = clamp(y, -1, 1);
      const magnitude = Math.hypot(x, y); if (magnitude > 1) { x /= magnitude; y /= magnitude; }
      if (Math.hypot(x, y) < .12) x = y = 0;
      if (x !== this.x || y !== this.y) { this.x = x; this.y = y; this.packet('axes'); }
    }
    neutral() {
      const dirty = this.x !== 0 || this.y !== 0 || this.buttons !== 0 || this.queue.length || this.sending;
      const discardedPlan = this.queue.some(packet => packet.plan && packet !== this.sending);
      // Cancellation abandons queued actions, including retries. The in-flight
      // request keeps its own packet/sequence until flush reconciles its result.
      this.queue = []; this.axisTail = null; this.resetControls();
      if (discardedPlan) {
        this.lastPlanSeq = this.sending?.plan ? this.sending.seq : 0;
        this.plan = { ...(this.sending?.plan || this.snapshot?.privateState?.plan || this.plan) };
      }
      if (dirty && this.enabled) this.packet();
      this.onChange(this);
    }
    watchdog() { if (this.snapshot && this.now() - this.lastPoll > 8000) { this.offline = true; this.resetControls(); this.queue = []; this.error = 'TV connection lost. Waiting to reconnect…'; this.onChange(this); } }
    refreshHeld() { if (this.enabled && (this.x || this.y || this.buttons) && !this.queue.length && this.now() - this.lastSend >= 150) this.packet('axes'); }
    place(x, y) { if (!this.enabled || this.snapshot.game !== 'blind-crown' || this.plan.locked) return; this.plan.x = clamp(x, 0, 1); this.plan.y = clamp(y, 0, 1); this.packet('plan', true); }
    aim(angle) { if (!this.enabled || this.snapshot.game !== 'blind-crown' || this.plan.locked) return; this.plan.a = clamp(angle, -Math.PI, Math.PI); this.packet('plan', true); }
    lock() { if (!this.enabled || this.snapshot.game !== 'blind-crown') return; this.plan.locked = !this.plan.locked; this.packet('plan', true); }
    async join(name) {
      const begin = this.now(), data = await this.request('join', { name }); this.delayMs = Math.max(0, this.now() - begin); this.receive(data); return data;
    }
    async poll() {
      if (this.pollFlight) return this.pollFlight;
      if (this.closed) return;
      this.pollFlight = (async () => {
        const begin = this.now();
        try { const data = await this.request('poll', {}); this.delayMs = Math.max(0, this.now() - begin); this.receive(data); return data; }
        catch (error) {
          this.pollFailures = Math.min(5, this.pollFailures + 1); this.offline = true; this.resetControls(); this.queue = [];
          this.closed = error.status === 401 || error.status === 404;
          this.error = error.status === 404 ? 'Room ended or expired. Join a new room.' : error.status === 401 ? 'Join this room again to reconnect your phone.' : 'Connection interrupted. Reconnecting…';
          this.onChange(this); return null;
        }
      })();
      try { return await this.pollFlight; } finally { this.pollFlight = null; }
    }
    async flush() {
      this.watchdog();
      if (this.inflight || !this.enabled || !this.queue.length || this.now() < this.nextSendAt) return;
      const packet = this.queue[0]; this.inflight = true; this.sending = packet;
      const begin = this.now();
      try {
        await this.request('input', packet); this.delayMs = Math.max(0, this.now() - begin); this.lastSend = this.now(); this.failures = 0;
        this.queue = this.queue.filter(p => p.seq !== packet.seq);
      } catch (error) {
        this.failures += 1;
        // Poll's authenticated lastSeq distinguishes a lost success from an
        // unaccepted packet. Later press/release packets retain their sequences.
        await this.poll();
        const reconciled = !this.queue.some(p => p.seq === packet.seq);
        this.nextSendAt = reconciled ? 0 : this.now() + (error.status === 429 ? 1000 : Math.min(1000, 100 * 2 ** this.failures));
        if (reconciled) this.failures = 0;
        if (this.failures >= 3 && this.queue.some(p => p.seq === packet.seq)) {
          this.resetControls(); this.queue = []; this.error = 'Input connection delayed. Release controls and try again.'; this.failures = 0;
        }
      } finally { this.inflight = false; this.sending = null; this.onChange(this); }
    }
    pollDelay() { return this.pollFailures ? Math.min(3000, 250 * 2 ** this.pollFailures) : this.snapshot?.game === 'blind-crown' || this.snapshot?.game === 'royal-roller-ruckus' ? 200 : this.enabled && (this.x || this.y || this.buttons || this.queue.length) ? 350 : 1000; }
    async leave() { this.neutral(); await this.request('leave', {}); this.closed = true; this.queue = []; }
    stop() { this.neutral(); this.closed = true; this.queue = []; }
  }

  function drawMap(canvas, session) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const p = session.snapshot?.privateState, w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#181125'; ctx.fillRect(0, 0, w, h);
    if (session.snapshot?.game === 'royal-roller-ruckus') {
      const radar = p?.radar; if (!radar?.bounds) return;
      const b = radar.bounds, padding = 40, scale = Math.min((w - 2 * padding) / Math.max(1, b.maxX - b.minX), (h - 2 * padding) / Math.max(1, b.maxZ - b.minZ));
      const ox = (w - (b.maxX - b.minX) * scale) / 2, oy = (h - (b.maxZ - b.minZ) * scale) / 2;
      const point = v => [ox + (v[0] - b.minX) * scale, oy + (v[1] - b.minZ) * scale];
      ctx.strokeStyle = '#756484'; ctx.lineWidth = 22; ctx.lineJoin = 'round'; ctx.beginPath();
      (radar.track || []).forEach((v, i) => { const [x, y] = point(v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
      if (radar.own) { const [x, y] = point(radar.own); ctx.fillStyle = '#ffd98b'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 2 * Math.PI); ctx.fill(); }
      return;
    }
    const board = p?.board; if (!board || !session.plan) return;
    const bw = board.width || 1000, bh = board.height || 640, sx = w / bw, sy = h / bh;
    ctx.save(); ctx.scale(sx, sy);
    const bounds = board.geometry?.bounds;
    if (bounds) { ctx.strokeStyle = '#b6a48c'; ctx.lineWidth = 3; ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY); }
    for (const wall of board.geometry?.walls || []) { if (wall.open) continue; ctx.fillStyle = wall.material === 'mirror' ? '#74c2cf' : '#675875'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h); }
    // Draw only board geometry and this seat's filtered plan. No opponent fields.
    const plan = session.plan, x = plan.x * bw, y = plan.y * bh;
    ctx.fillStyle = plan.locked ? '#a7e0b7' : '#ffd98b'; ctx.beginPath(); ctx.arc(x, y, 17, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(plan.a) * 100, y + Math.sin(plan.a) * 100); ctx.stroke(); ctx.restore();
  }

  function feedback(s) {
    const p = s.snapshot?.privateState || {}, id = s.snapshot?.game;
    if (p.alive === false) return 'Eliminated · watching for the next round';
    if (p.finished) return 'Finished · watch the TV';
    if (id === 'space-bash') return `HP ${p.hp ?? '—'} · ${p.carrying ? 'Carrying ' + (p.cargo || 'cargo') + (p.fuse != null ? ' · fuse ' + Number(p.fuse).toFixed(1) + 's' : '') : 'Hands free'}`;
    if (id === 'royal-twisted') return `${p.lives ?? '—'} lives · ${p.next ? 'Next: ' + p.next.type + ' in ' + Number(p.next.eta).toFixed(1) + 's' : 'Watch for the next rod'}`;
    if (id === 'royal-roller-ruckus') return p.falling ? 'Falling · press Recover' : `Lap ${p.lap ?? 0} / ${p.laps ?? '—'} · checkpoint ${p.checkpoint ?? 0}`;
    if (id === 'royal-scratch-match') return `${p.score ?? 0} points · ${p.combo ?? 0} combo · ${p.lives ?? '—'} lives`;
    if (id === 'royal-sumo') return p.charging ? 'Bash charging · release to strike' : `Stability ${p.stability != null ? Math.round(p.stability) : '—'}`;
    if (id === 'royal-ballistix') return `${p.life ?? '—'} life · ${p.magnet ? 'Magnet holding' : 'Magnet ready'}`;
    if (id === 'blind-crown') return `${p.phase || 'Waiting'} · round ${p.round ?? '—'} · ${p.clock != null ? Math.ceil(p.clock) + 's' : ''} · ${s.plan.locked ? 'Plan locked' : 'Plan editable'}`;
    return 'Watch the TV for the next round.';
  }

  function mount() {
    const $ = id => document.getElementById(id), form = $('cp-join'); if (!form) return;
    let session = null, polling = null, tick = null, joining = false, controlGame = '', mode = 'place', mapPointer = null, stickPointer = null;
    const keySet = new Set(), buttonNodes = new Map();
    const codeInput = $('cp-code'), nameInput = $('cp-name'), status = $('cp-status'), canvas = $('cp-map');
    const codeValue = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    codeInput.value = codeValue(new URLSearchParams(location.search).get('code'));
    const render = () => {
      if (!session?.snapshot) { if (session?.error) status.textContent = session.error; return; }
      const data = session.snapshot, game = games[data.game]; if (!game) { status.textContent = 'This game is not supported.'; return; }
      form.hidden = true; $('cp-play').hidden = false; $('cp-change').hidden = false;
      $('cp-game').textContent = game.title; $('cp-identity').textContent = `${data.name} · Seat ${data.seat + 1} · ${data.code}`;
      status.textContent = session.error || (!data.hostAlive ? 'TV disconnected · controls paused' : data.status.paused ? 'Paused on TV' : !data.status.active ? 'Waiting for the host to start' : session.suspended ? 'Controls paused while this phone is away' : 'Connected · ' + data.status.phase);
      $('cp-feedback').textContent = feedback(session);
      $('cp-delay').textContent = session.delayMs == null ? 'Measuring round-trip delay…' : `Round trip ${Math.round(session.delayMs)} ms · variable`;
      $('cp-retry').hidden = !session.closed && !session.error;
      $('cp-instructions').textContent = game.hint + (game.stick ? ' Arrow keys also move.' : '');
      $('cp-latency-note').textContent = data.game === 'royal-scratch-match' ? 'Rhythm timing has variable network delay. This is a party controller, not precision competitive timing.' : 'Network latency varies. Watch the TV for the match.';
      if (controlGame !== data.game) {
        controlGame = data.game; $('cp-buttons').replaceChildren(); buttonNodes.clear();
        for (const spec of game.buttons) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'cp-controller-action'; button.dataset.mask = spec.mask;
          button.textContent = spec.label; button.setAttribute('aria-label', spec.label + ' (' + spec.key.replace('Key', '') + ')');
          if (spec.color) { button.style.setProperty('--cp-rune', spec.color); button.classList.add('cp-controller-rune'); }
          const press = event => { if (button.disabled) return; event.preventDefault(); button.setPointerCapture(event.pointerId); session?.button(spec.mask, true, 'pointer:' + event.pointerId); void session?.flush(); };
          const release = event => { session?.button(spec.mask, false, 'pointer:' + event.pointerId); void session?.flush(); };
          button.addEventListener('pointerdown', press); for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
          button.addEventListener('click', event => { if (event.detail === 0 && !button.disabled && !session.buttons) { session.button(spec.mask, true, 'accessible:' + spec.mask); session.button(spec.mask, false, 'accessible:' + spec.mask); void session.flush(); } });
          $('cp-buttons').append(button); buttonNodes.set(spec.mask, button);
        }
      }
      for (const [mask, node] of buttonNodes) { node.disabled = !session.enabled || data.game === 'royal-roller-ruckus' && !data.privateState?.falling; node.setAttribute('aria-pressed', String(!!(session.buttons & mask))); }
      document.querySelector('.cp-controller-controls').hidden = !!game.board;
      $('cp-stick').hidden = !game.stick; $('cp-stick').setAttribute('aria-disabled', String(!session.enabled));
      $('cp-knob').style.transform = `translate(${session.x * 40}px, ${session.y * 40}px)`;
      $('cp-map-wrap').hidden = !game.radar && !game.board; $('cp-plan-controls').hidden = !game.board;
      $('cp-map-label').textContent = game.radar ? 'Your gold dot · X right / Z down · TV shows the course' : 'Your private board · drag to ' + mode + ' · other plans stay hidden';
      if (game.board || game.radar) drawMap(canvas, session);
      for (const id of ['cp-place', 'cp-aim', 'cp-lock', 'cp-plan-x', 'cp-plan-y', 'cp-plan-a']) $(id).disabled = !session.enabled || (id !== 'cp-lock' && session.plan.locked);
      $('cp-place').setAttribute('aria-pressed', String(mode === 'place')); $('cp-aim').setAttribute('aria-pressed', String(mode === 'aim')); $('cp-lock').textContent = session.plan.locked ? 'Unlock plan' : 'Lock plan';
      if (!session.editing) { $('cp-plan-x').value = session.plan.x; $('cp-plan-y').value = session.plan.y; $('cp-plan-a').value = session.plan.a; }
      if (!session.enabled) { keySet.clear(); stickPointer = mapPointer = null; }
    };
    const stopLoops = () => { clearTimeout(polling); clearInterval(tick); polling = tick = null; };
    const startLoops = () => {
      stopLoops(); const current = session;
      const loop = async () => { if (current !== session || current.closed) return; await current.poll(); if (current === session && !current.closed) polling = setTimeout(loop, current.pollDelay()); };
      polling = setTimeout(loop, current.pollDelay());
      tick = setInterval(() => { if (current !== session) return; current.watchdog(); current.refreshHeld(); void current.flush(); }, 50);
    };
    const attach = (code, data) => { session?.stop(); session = new Session({ code, onChange: render }); if (data) session.receive(data); return session; };
    const updateURL = code => { const url = new URL(location.href); url.search = code ? '?code=' + code : ''; history.replaceState(null, '', url.href); };
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (joining) return; const code = codeValue(codeInput.value), name = nameInput.value.trim();
      if (code.length !== 4 || !name || name.length > 24 || [...name].some(char => char.charCodeAt(0) < 32)) { status.textContent = 'Enter a four-character room code and a name (1–24 characters).'; return; }
      joining = true; form.querySelector('button[type="submit"]').disabled = true; status.textContent = 'Joining…'; stopLoops();
      try { const current = attach(code); await current.join(name); updateURL(code); startLoops(); }
      catch (error) { status.textContent = error.status === 404 ? 'Room not found or expired. Check the TV code.' : error.code === 'ROOM_FULL' ? 'All ten seats are taken.' : 'Could not join. Check your code and try again.'; }
      finally { joining = false; form.querySelector('button[type="submit"]').disabled = false; }
    });
    $('cp-change').addEventListener('click', async () => {
      const leaving = session; stopLoops(); session = null; controlGame = ''; keySet.clear(); stickPointer = mapPointer = null;
      try { await leaving?.leave(); } catch { leaving?.stop(); }
      form.hidden = false; $('cp-play').hidden = true; $('cp-change').hidden = true; updateURL(null); status.textContent = 'Enter the next TV room code.'; codeInput.focus();
    });
    $('cp-retry').addEventListener('click', async () => { if (!session) return; session.closed = false; await session.poll(); if (session.closed) { form.hidden = false; $('cp-play').hidden = true; } else startLoops(); });
    const stick = $('cp-stick');
    const moveStick = event => { if (event.pointerId !== stickPointer) return; const r = stick.getBoundingClientRect(), radius = Math.min(r.width, r.height) * .4; session?.axes((event.clientX - r.left - r.width / 2) / radius, (event.clientY - r.top - r.height / 2) / radius); void session?.flush(); };
    stick.addEventListener('pointerdown', event => { if (!session?.enabled || stickPointer !== null) return; event.preventDefault(); stickPointer = event.pointerId; stick.setPointerCapture(stickPointer); moveStick(event); });
    stick.addEventListener('pointermove', moveStick);
    const endStick = event => { if (event.pointerId !== stickPointer) return; stickPointer = null; session?.axes(0, 0); void session?.flush(); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, endStick);
    const editMap = event => {
      if (event.pointerId !== mapPointer || !session?.enabled) return;
      const r = canvas.getBoundingClientRect(), x = clamp((event.clientX - r.left) / r.width, 0, 1), y = clamp((event.clientY - r.top) / r.height, 0, 1);
      if (mode === 'place') session.place(x, y); else session.aim(Math.atan2((y - session.plan.y) * canvas.height, (x - session.plan.x) * canvas.width));
      void session.flush();
    };
    canvas.addEventListener('pointerdown', event => { if (!session?.enabled || session.snapshot.game !== 'blind-crown' || session.plan.locked || mapPointer !== null) return; event.preventDefault(); mapPointer = event.pointerId; session.editing = true; canvas.setPointerCapture(mapPointer); editMap(event); });
    canvas.addEventListener('pointermove', editMap);
    const endMap = event => { if (event.pointerId !== mapPointer) return; mapPointer = null; if (session) session.editing = false; render(); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, endMap);
    $('cp-place').addEventListener('click', () => { mode = 'place'; render(); }); $('cp-aim').addEventListener('click', () => { mode = 'aim'; render(); });
    $('cp-lock').addEventListener('click', () => { session?.lock(); void session?.flush(); });
    for (const id of ['cp-plan-x', 'cp-plan-y', 'cp-plan-a']) {
      $(id).addEventListener('pointerdown', () => { if (session) session.editing = true; });
      $(id).addEventListener('input', () => { if (id === 'cp-plan-a') session?.aim(Number($(id).value)); else session?.place(Number($('cp-plan-x').value), Number($('cp-plan-y').value)); void session?.flush(); });
      $(id).addEventListener('change', () => { if (session) session.editing = false; render(); });
      $(id).addEventListener('pointercancel', () => { if (session) session.editing = false; });
    }
    function key(event, down) {
      if (!session?.enabled || (down && event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-arcade-tool]'))) return;
      const game = games[session.snapshot.game], spec = game?.buttons.find(button => button.key === event.code);
      if (spec) { event.preventDefault(); if (!event.repeat) session.button(spec.mask, down, 'key:' + event.code); }
      else if (game?.stick && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault(); if (down) keySet.add(event.code); else keySet.delete(event.code);
        session.axes(Number(keySet.has('ArrowRight')) - Number(keySet.has('ArrowLeft')), Number(keySet.has('ArrowDown')) - Number(keySet.has('ArrowUp')));
      } else return;
      void session.flush();
    }
    window.addEventListener('keydown', event => key(event, true)); window.addEventListener('keyup', event => key(event, false));
    const neutral = () => { keySet.clear(); stickPointer = mapPointer = null; session?.neutral(); void session?.flush(); };
    window.addEventListener('arcade:controls-reset', neutral);
    window.addEventListener('blur', neutral);
    document.addEventListener('visibilitychange', () => { if (document.hidden) neutral(); if (session) { session.suspended = document.hidden; render(); if (!document.hidden) void session.poll(); } });
    window.addEventListener('pagehide', () => { neutral(); stopLoops(); });
    document.addEventListener('contextmenu', event => { if (event.target.closest?.('.cp-controller-controls, .cp-controller-map-wrap')) event.preventDefault(); });
    // Code in the URL is public. Only the HttpOnly cookie can restore ownership.
    if (codeInput.value.length === 4) {
      const code = codeInput.value, current = attach(code); status.textContent = 'Checking for your seat…';
      void current.poll().then(data => { if (current !== session) return; if (data) { nameInput.value = data.name; startLoops(); } else { session = null; status.textContent = 'Enter your name to join this room.'; } });
    }
    return { get session() { return session; }, render };
  }
  window.CallbackPhoneController = { Session, games, mount, drawMap };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
