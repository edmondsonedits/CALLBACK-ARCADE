/* Shared same-origin TV lobby. The existing game adapter remains the game authority. */
(function () {
  'use strict';
  const gameId = document.currentScript?.dataset.game;
  const noop = () => {};
  const INPUT_DELIVERY_MS = 1500, HELD_INPUT_MS = 500;
  const storageKey = 'cp-phone-room:' + gameId;
  const validCode = code => /^[A-Z0-9]{4}$/.test(code || '');
  const lobbyPhases = {
    'royal-sumo': { ready: ['menu'], settled: ['matchend'] },
    'royal-twisted': { ready: ['setup'], settled: ['matchover'] },
    'royal-roller-ruckus': { ready: ['setup'], settled: ['finished'] },
    'royal-scratch-match': { ready: ['menu'], settled: ['results'] },
    'blind-crown': { ready: ['lobby'], settled: ['final'] },
  };
  function returnedToLobby(status) {
    const phases = lobbyPhases[gameId];
    if (!phases || !status) return false;
    const phase = String(status.phase || '').toLowerCase();
    return phases.ready.includes(phase) && !status.active || phases.settled.includes(phase);
  }

  async function post(code, action, body) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 2500);
    try {
      const response = await fetch('/api/arcade-phone/' + (action === 'create' ? 'create' : code + '/' + action), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Room connection failed'), { code: data.error?.code, status: response.status });
      return data;
    } finally { clearTimeout(timer); }
  }

  class Room {
    constructor({ code, adapter, request, now = Date.now, onChange = noop }) {
      this.code = code; this.adapter = adapter; this.request = request || ((action, body) => post(code, action, body));
      this.now = now; this.onChange = onChange; this.ack = {}; this.occupancies = new Map(); this.seats = new Map(); this.roster = [];
      this.botEnabled = Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [seat, true])); this.activeSeatIds = null; this.version = 1;
      this.inflight = false; this.closed = false; this.started = false; this.failures = 0; this.error = ''; this.lastSuccess = now();
    }
    status() {
      const current = this.adapter.status();
      return { phase: String(current.phase || 'lobby').slice(0, 40), paused: !this.started || !!current.paused || document.hidden === true, active: this.started && !!current.active,
        text: !this.started || !current.active ? 'Waiting for host to start' : current.paused || document.hidden ? 'Paused on TV' : 'Playing on TV' };
    }
    clear(seat, member) { this.adapter.clear(seat); if (member) member.cleared = true; }
    sweep() {
      if (this.closed) return;
      const now = this.now(), status = this.status();
      for (const [seat, member] of this.seats) {
        if ((!status.active || status.paused || now - member.inputAt > HELD_INPUT_MS) && !member.cleared) this.clear(seat, member);
        if (now - member.seenAt > 3000) { this.clear(seat, member); this.adapter.release(seat); this.seats.delete(seat); }
      }
    }
    receive(data, elapsedMs = 0) {
      if (this.closed) return;
      const now = this.now(); const hasRoster = Array.isArray(data.roster); this.roster = data.roster || []; this.lastSuccess = now; this.failures = 0; this.error = '';
      if (data.botEnabled) this.botEnabled = data.botEnabled;
      if (Number.isSafeInteger(data.version)) this.version = data.version;
      if (Array.isArray(data.activeSeatIds)) this.activeSeatIds = data.activeSeatIds;
      else if (Object.hasOwn(data, 'activeSeatIds')) this.activeSeatIds = null;
      if (hasRoster) {
        const presentSeats = new Set(this.roster.map(player => player.seat));
        for (const [seat, member] of this.seats) if (!presentSeats.has(seat)) { this.clear(seat, member); this.adapter.release(seat); this.seats.delete(seat); delete this.ack[seat]; }
        for (const seat of Object.keys(this.ack)) if (!presentSeats.has(Number(seat))) delete this.ack[seat];
        for (const seat of this.occupancies.keys()) if (!presentSeats.has(seat)) this.occupancies.delete(seat);
      }
      for (const player of this.roster) {
        const seat = player.seat;
        if (!Number.isInteger(seat) || seat < 0 || seat > 9) continue;
        const occupancyId = typeof player.occupancyId === 'string' ? player.occupancyId : null;
        const previousOccupancy = this.occupancies.get(seat);
        if (occupancyId && previousOccupancy && previousOccupancy !== occupancyId) {
          const previous = this.seats.get(seat);
          if (previous) { this.clear(seat, previous); this.adapter.release(seat); this.seats.delete(seat); }
          delete this.ack[seat];
        }
        if (occupancyId) this.occupancies.set(seat, occupancyId);
        const previous = this.seats.get(seat);
        if (!player.connected) {
          if (previous) { this.clear(seat, previous); this.adapter.release(seat); this.seats.delete(seat); }
          continue;
        }
        const member = previous || { name: player.name, inputAt: -Infinity, cleared: false };
        if (!previous || member.name !== player.name) { this.adapter.assign(seat, player.name); member.name = player.name; }
        member.seenAt = now; this.seats.set(seat, member);
        // Mailbox staleness measures transport age; local holds are timed from
        // their last accepted arrival by sweep(), independently of this flag.
      }
      // A native pause/menu may have opened while the request was in flight.
      const status = this.status();
      if (status.active && !status.paused) for (const event of data.inputs || []) {
        const member = this.seats.get(event.seat), seq = event.packet?.seq;
        if (!member || !Number.isInteger(seq) || seq <= (this.ack[event.seat] || 0)) continue;
        // Full local request duration conservatively bounds time in transit;
        // server age uses only server timestamps, with no clock synchronization.
        const age = Math.max(0, (data.serverNow || now) - event.receivedAt) + Math.max(0, elapsedMs);
        if (age > INPUT_DELIVERY_MS) continue;
        // False/throw means not handled: leave it unacknowledged for mailbox retry.
        if (this.adapter.input(event.seat, event.packet) !== false) {
          this.ack[event.seat] = seq; member.inputAt = now; member.cleared = false;
        }
      }
      this.sweep(); this.onChange(this);
    }
    async poll() {
      this.sweep();
      if (this.inflight || this.closed) return;
      this.inflight = true;
      const startedAt = this.now();
      try {
        const privateStates = {};
        for (const seat of this.seats.keys()) {
          const occupancyId = this.occupancies.get(seat);
          if (!occupancyId) continue;
          const own = this.started ? this.adapter.phoneState(seat) : null;
          privateStates[seat] = { occupancyId, state: own ? { ...own, appliedSeq: this.ack[seat] || 0 } : null };
        }
        const ack = Object.fromEntries(Object.entries(this.ack).flatMap(([seat, seq]) => {
          const occupancyId = this.occupancies.get(Number(seat));
          return occupancyId ? [[seat, { seq, occupancyId }]] : [];
        }));
        let data = await this.request('host', { status: this.status(), privateStates, ack });
        if (!this.closed && data.hostRefreshRequired) {
          this.receive({ ...data, inputs: [] }, this.now() - startedAt);
          this.error = 'Reload this TV tab to safely reconnect phone players.';
          this.onChange(this);
          return;
        }
        const nativeStatus = this.adapter.status();
        if (!this.closed && Array.isArray(data.activeSeatIds) && returnedToLobby(nativeStatus)) {
          const lobby = await this.request('lobby', { version: data.version });
          this.started = false; this.activeSeatIds = null;
          data = { ...data, activeSeatIds: null, version: lobby.version, botEnabled: lobby.botEnabled || data.botEnabled, inputs: [] };
        }
        if (!this.closed) this.receive(data, this.now() - startedAt);
      } catch (error) {
        if (this.closed) return;
        this.failures = Math.min(6, this.failures + 1);
        this.error = error.status === 404 ? 'Room expired or ended. Create a new room.' : error.status === 401 ? 'This TV no longer owns the room. Create a new room.' : 'Connection interrupted. Retrying…';
        if (error.status === 404 || error.status === 401) this.dispose();
        this.sweep(); this.onChange(this);
      } finally { this.inflight = false; }
    }
    async start() {
      if (this.closed || this.started && this.status().active) return false;
      const started = await this.request('start', { version: this.version });
      if (!Array.isArray(started.activeSeatIds) || started.activeSeatIds.length < 2) throw new Error('The server returned an invalid player roster.');
      this.activeSeatIds = started.activeSeatIds; this.botEnabled = started.botEnabled || this.botEnabled; this.version = started.version;
      this.adapter.start({ activeSeatIds: [...this.activeSeatIds] }); this.started = true; this.onChange(this); return true;
    }
    async toggleBot(seat) {
      const data = await this.request('bot', { seat, enabled: !this.botEnabled[seat], version: this.version });
      if (data.botEnabled) this.botEnabled = data.botEnabled;
      if (Number.isSafeInteger(data.version)) this.version = data.version;
      this.activeSeatIds = null; this.onChange(this); return true;
    }
    togglePause() {
      if (this.closed || !this.status().active) return;
      if (this.status().paused) this.adapter.resume(); else this.adapter.pause();
      this.sweep(); this.onChange(this);
    }
    dispose() {
      if (this.closed) return false;
      // stop() preserves adapter roster metadata for same-room restarts. Release
      // this room's ownership first, and make late callbacks inert before doing so.
      this.closed = true; this.started = false;
      for (const [seat, member] of this.seats) { this.clear(seat, member); this.adapter.release(seat); }
      this.seats.clear(); this.roster = []; this.adapter.stop();
      return true;
    }
    async close() {
      if (this.closed) return;
      this.adapter.pause(); for (const [seat, member] of this.seats) this.clear(seat, member);
      await this.request('close', {});
      if (this.dispose()) this.onChange(this);
    }
    delay() { return this.failures ? Math.min(2000, 200 * 2 ** this.failures) : this.status().active ? 100 : 300; }
  }

  // Install during defer execution, before DOMContentLoaded game handlers. Only
  // widget events are stopped; defaults still edit inputs, focus, and click buttons.
  let routeEvent = noop;
  for (const type of ['click', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'contextmenu']) {
    window.addEventListener(type, event => {
      if (!event.target?.closest?.('.cp-host')) return;
      routeEvent(event); event.stopImmediatePropagation();
    }, true);
  }

  function mount() {
    const adapter = window.CallbackPhoneGame;
    if (!adapter || !gameId || document.querySelector('.cp-host-launch')) return;
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/arcade-games/phone/phone.css'; document.head.append(style);
    const qrScript = document.createElement('script'); qrScript.src = '/arcade-games/phone/vendor/qrcode.js'; document.head.append(qrScript);
    const launcher = document.createElement('button'); launcher.type = 'button'; launcher.className = 'cp-host cp-host-launch'; launcher.dataset.action = 'open'; launcher.textContent = 'Phone players';
    launcher.setAttribute('aria-haspopup', 'dialog'); document.body.append(launcher);
    const dialog = document.createElement('dialog'); dialog.className = 'cp-host cp-host-dialog'; dialog.setAttribute('aria-labelledby', 'cp-host-title');
    dialog.innerHTML = '<header class="cp-host-heading"><div><p class="cp-host-eyebrow">Royal party arcade</p><h2 id="cp-host-title">Bring your phones</h2></div><button type="button" data-action="collapse" aria-label="Close phone lobby">×</button></header><p class="cp-host-intro">One TV. Up to ten phone players. Bots fill the empty seats.</p><p class="cp-host-message" role="status" aria-live="polite"></p><button class="cp-host-primary" type="button" data-action="create">Create room</button><section class="cp-host-room" hidden><div class="cp-host-join"><div><span class="cp-host-eyebrow">Join this room</span><strong class="cp-host-code"></strong><a class="cp-host-url" target="_blank" rel="noopener"></a><button type="button" data-action="copy">Copy join link</button></div><img class="cp-host-qr" alt="QR code to join this phone room" hidden></div><ol class="cp-host-roster" aria-label="Ten player seats"></ol><div class="cp-host-actions"><button class="cp-host-primary" type="button" data-action="start" disabled>Start match</button><button type="button" data-action="pause" disabled>Pause</button><button type="button" data-action="collapse">View game</button><button class="cp-host-danger" type="button" data-action="end">End room</button></div></section><footer class="cp-host-footer"><small>Phone inputs use variable network latency.</small><a href="/arcade" data-action="back">Back to arcade</a></footer>';
    document.body.append(dialog);
    const q = selector => dialog.querySelector(selector);
    const message = q('.cp-host-message'), code = q('.cp-host-code'), url = q('.cp-host-url'), qr = q('.cp-host-qr');
    const rows = Array.from({ length: 10 }, (_, seat) => {
      const row = document.createElement('li'); row.dataset.seat = seat;
      const label = document.createElement('span'); label.className = 'cp-host-seat-label'; row.append(label);
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'cp-host-bot-switch'; toggle.dataset.action = 'bot'; toggle.dataset.seat = seat; toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-label', `Bot ${seat + 1}`);
      const bot = document.createElement('span'); bot.textContent = 'Bot';
      const state = document.createElement('span'); state.dataset.botState = '';
      toggle.append(bot, state); row.append(toggle); q('.cp-host-roster').append(row); return row;
    });
    let room = null, timer = null, busy = false, disposed = false, qrValue = '';
    const stored = value => { try { if (value) sessionStorage.setItem(storageKey, value); else sessionStorage.removeItem(storageKey); } catch { /* storage is optional; cookie remains authority */ } };
    const show = () => { if (!dialog.open) dialog.showModal(); q('[data-action="collapse"]').focus(); };
    const collapse = () => { dialog.close(); launcher.focus(); };
    const refresh = () => {
      const live = !!room && !room.closed, count = live ? room.seats.size : 0;
      q('.cp-host-room').hidden = !live; q('[data-action="create"]').hidden = live;
      launcher.textContent = live ? `${room.code} · ${count}/10 phones` : 'Phone players';
      launcher.setAttribute('aria-label', live ? `Phone room ${room.code}, ${count} connected. Open lobby` : 'Phone players');
      message.textContent = room?.error || (live ? room.status().active ? room.status().paused ? 'Paused on TV. Resume when everyone is ready.' : 'Match in progress. Open the game view to watch.' : count ? 'Ready to start. You can keep the selected TV settings.' : 'Scan the code or open the link on a phone.' : 'Create a room to connect your players.');
      if (!live) { if (room?.closed) stored(null); return; }
      code.textContent = room.code;
      const joinURL = location.origin + '/arcade-games/phone/controller.html?code=' + room.code;
      url.href = joinURL; url.textContent = joinURL;
      const people = new Set(room.roster.map(player => player.seat));
      const activeCount = Array.from({ length: 10 }, (_, seat) => seat).filter(seat => people.has(seat) || room.botEnabled[seat] === true).length;
      q('[data-action="start"]').disabled = activeCount < 2 || room.started && room.status().active;
      q('[data-action="pause"]').disabled = !room.status().active;
      q('[data-action="pause"]').textContent = room.status().paused ? 'Resume' : 'Pause';
      rows.forEach((row, seat) => {
        const member = room.seats.get(seat), absent = room.roster.find(p => p.seat === seat);
        const human = member || absent;
        row.querySelector('.cp-host-seat-label').textContent = `${seat + 1}. ${member ? member.name + ' · Connected' : absent ? absent.name + ' · Disconnected' : 'Open seat'}`;
        row.dataset.connected = String(!!member);
        const toggle = row.querySelector('.cp-host-bot-switch'), enabled = room.botEnabled[seat] === true;
        toggle.hidden = !!human;
        toggle.disabled = room.started && room.status().active;
        toggle.setAttribute('aria-checked', String(enabled)); toggle.dataset.enabled = String(enabled);
        toggle.children[1].textContent = enabled ? 'On' : 'Off';
      });
      if (window.CallbackPhoneQR && qrValue !== joinURL) {
        qrValue = joinURL;
        window.CallbackPhoneQR.toDataURL(joinURL, { width: 224, margin: 2, color: { dark: '#181125', light: '#fff9ec' } }).then(data => { if (url.href === joinURL) { qr.src = data; qr.hidden = false; } }).catch(() => { qrValue = ''; });
      }
    };
    qrScript.addEventListener('load', refresh);
    const loop = async () => {
      if (disposed || !room || room.closed) return;
      const current = room;
      await current.poll();
      if (!disposed && current === room && !current.closed) timer = setTimeout(loop, current.delay());
    };
    const attach = value => { clearTimeout(timer); room = new Room({ code: value, adapter, onChange: refresh }); stored(value); refresh(); void loop(); };
    const end = async () => { if (!room || room.closed) return true; try { await room.close(); stored(null); clearTimeout(timer); refresh(); return true; } catch { message.textContent = 'Could not end the room. Retry End room when connected.'; return false; } };
    async function action(name, detail = {}) {
      if (name === 'open') { show(); return; }
      if (name === 'collapse') { collapse(); return; }
      if (busy) return;
      busy = true;
      try {
        if (name === 'create') {
          message.textContent = 'Creating room…'; const data = await post(null, 'create', { game: gameId }); attach(data.code);
        } else if (name === 'start' && room) { if (await room.start()) { collapse(); void room.poll(); } }
        else if (name === 'bot' && room) await room.toggleBot(Number(detail.seat));
        else if (name === 'pause') { room?.togglePause(); void room?.poll(); }
        else if (name === 'end') await end();
        else if (name === 'copy') { await navigator.clipboard.writeText(url.href); message.textContent = 'Join link copied.'; }
        else if (name === 'back') { if (await end()) location.href = '/arcade'; }
      } catch (error) { message.textContent = name === 'copy' ? 'Copy unavailable. Use the displayed link or scan the code.' : error.status === 409 ? error.message : 'Connection failed. Try again.'; }
      finally { busy = false; }
    }
    routeEvent = event => {
      if (event.type === 'keydown' && event.key === 'Escape') { event.preventDefault(); collapse(); }
      if (event.type === 'click') { const button = event.target.closest('[data-action]'); if (button && !button.disabled) { if (button.dataset.action === 'back') event.preventDefault(); void action(button.dataset.action, { seat: button.dataset.seat }); } }
      if (event.type === 'contextmenu') event.preventDefault();
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); collapse(); });
    const watchdog = setInterval(() => { if (room && !room.closed) { room.sweep(); refresh(); } }, 100);
    document.addEventListener('visibilitychange', () => { if (document.hidden && room && !room.closed) { adapter.pause(); room.sweep(); void room.poll(); } });
    window.addEventListener('pagehide', () => { disposed = true; clearTimeout(timer); clearInterval(watchdog); if (room && !room.closed) { adapter.pause(); room.sweep(); } });
    for (const selector of ['.so-launch', '#onlineTab', '#onlineSettings']) { const legacy = document.querySelector(selector); if (legacy) legacy.hidden = true; }
    try { const saved = sessionStorage.getItem(storageKey); if (validCode(saved)) attach(saved); } catch { /* optional room-code restoration */ }
    refresh();
    return { launcher, dialog, get room() { return room; } };
  }
  window.CallbackPhoneHost = { Room, mount };
  function mountWhenAdapterIsReady() {
    if (window.CallbackPhoneGame) { mount(); return; }
    // Module based games can finish installing their input adapter after the
    // document's readiness event. Keep the lobby available once that adapter
    // arrives instead of silently omitting phone play on those packages.
    const deadline = Date.now() + 15000;
    const timer = setInterval(() => {
      if (window.CallbackPhoneGame) { clearInterval(timer); mount(); }
      else if (Date.now() >= deadline) clearInterval(timer);
    }, 50);
  }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', mountWhenAdapterIsReady, { once: true });
  else mountWhenAdapterIsReady();
})();
