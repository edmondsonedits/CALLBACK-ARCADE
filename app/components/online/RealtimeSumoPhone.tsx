'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnlineSnapshot } from './online-client';
import { usePartySocket } from './usePartySocket';
import './realtime-sumo.css';

const MOVEMENT_KEYS = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
] as const;

export default function RealtimeSumoPhone({ room }: { room: OnlineSnapshot }) {
  const party = usePartySocket(room.code, 'player', useCallback(() => {}, []));
  const sendInput = party.sendInput;
  const input = useRef({ x: 0, y: 0, bashDown: false, dash: false });
  const stickPointer = useRef<number | null>(null);
  const stickVector = useRef({ x: 0, y: 0 });
  const keySources = useRef(new Set<string>());
  const chargeSources = useRef(new Set<string>());
  const lastActiveState = useRef<string | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [charging, setCharging] = useState(false);

  const flush = useCallback(() => {
    if (sendInput(input.current)) input.current.dash = false;
  }, [sendInput]);

  const updateMovement = useCallback(() => {
    const keys = keySources.current;
    let x = stickVector.current.x
      + Number(keys.has('KeyD') || keys.has('ArrowRight'))
      - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let y = stickVector.current.y
      + Number(keys.has('KeyS') || keys.has('ArrowDown'))
      - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    input.current.x = x;
    input.current.y = y;
    setStick({ x, y });
  }, []);

  const neutral = useCallback(() => {
    input.current = { x: 0, y: 0, bashDown: false, dash: false };
    keySources.current.clear();
    chargeSources.current.clear();
    stickPointer.current = null;
    stickVector.current = { x: 0, y: 0 };
    setStick({ x: 0, y: 0 });
    setCharging(false);
    flush();
  }, [flush]);

  const selfSeatIndex = room.selfId && /^\d{2}$/u.test(room.selfId)
    ? Number(room.selfId)
    : null;
  const seatAlive = selfSeatIndex === null ? undefined : party.status.alive?.[selfSeatIndex];
  const eliminated = party.status.phase === 'PLAYING' && seatAlive === false;
  const active = party.connected
    && party.status.phase === 'PLAYING'
    && party.status.simPhase === 'fight'
    && !party.status.paused
    && !eliminated;

  useEffect(() => {
    const nextState = [
      party.connected,
      party.status.phase,
      party.status.simPhase,
      party.status.epoch,
      party.status.round ?? -1,
      seatAlive ?? 'unknown',
    ].join(':');
    if (lastActiveState.current !== null && lastActiveState.current !== nextState) neutral();
    lastActiveState.current = nextState;
  }, [neutral, party.connected, party.status.epoch, party.status.phase, party.status.round, party.status.simPhase, seatAlive]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) flush();
    }, 1000 / 30);
    const handleBlur = () => neutral();
    const handleVisibility = () => {
      if (document.hidden) neutral();
    };
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      neutral();
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [flush, neutral]);

  const setChargeSource = useCallback((source: string, held: boolean) => {
    if (held) {
      if (!active) return;
      chargeSources.current.add(source);
    } else {
      chargeSources.current.delete(source);
    }
    const next = chargeSources.current.size > 0;
    input.current.bashDown = next;
    setCharging(next);
    flush();
  }, [active, flush]);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => target instanceof HTMLElement
      && Boolean(target.closest('input,textarea,select,button,[contenteditable="true"]'));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!active || isInteractiveTarget(event.target)) return;
      if (MOVEMENT_KEYS.includes(event.code as typeof MOVEMENT_KEYS[number])) {
        event.preventDefault();
        keySources.current.add(event.code);
        updateMovement();
        flush();
      } else if (event.code === 'Space') {
        event.preventDefault();
        setChargeSource('key:Space', true);
      } else if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) {
        event.preventDefault();
        input.current.dash = true;
        flush();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (MOVEMENT_KEYS.includes(event.code as typeof MOVEMENT_KEYS[number]) && keySources.current.has(event.code)) {
        event.preventDefault();
        keySources.current.delete(event.code);
        updateMovement();
        flush();
      }
      if (event.code === 'Space' && chargeSources.current.has('key:Space')) {
        event.preventDefault();
        setChargeSource('key:Space', false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [active, flush, setChargeSource, updateMovement]);

  const dragStick = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!active || stickPointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.35);
    let y = (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.35);
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    stickVector.current = { x, y };
    updateMovement();
    flush();
  };

  const releaseStick = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (stickPointer.current !== event.pointerId) return;
    stickPointer.current = null;
    stickVector.current = { x: 0, y: 0 };
    updateMovement();
    flush();
  };

  const fireDash = () => {
    if (!active) return;
    input.current.dash = true;
    flush();
  };

  const statusText = !party.connected
    ? 'Connecting…'
    : party.status.paused
      ? 'Paused'
      : eliminated
        ? 'Eliminated · waiting for this round to finish'
        : party.status.phase === 'PLAYING'
          ? party.status.simPhase === 'fight' ? 'Fight!' : 'Get ready…'
          : party.status.phase === 'COUNTDOWN' ? 'Get ready…' : 'Waiting for host';

  return (
    <main className="sumo-live-phone">
      <header>
        <h1>Royal Sumo</h1>
        <strong>{room.players.find((player) => player.id === room.selfId)?.name}</strong>
        <p role="status">{statusText} · RTT p95 {party.rtt ?? '—'} ms</p>
      </header>
      <div className="sumo-live-controls">
        <button
          className="sumo-live-stick"
          disabled={!active}
          aria-label="Move fighter"
          onPointerDown={(event) => {
            if (!active || stickPointer.current !== null) return;
            stickPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragStick(event);
          }}
          onPointerMove={dragStick}
          onPointerUp={releaseStick}
          onPointerCancel={releaseStick}
          onLostPointerCapture={releaseStick}
        >
          <span style={{ transform: `translate(${stick.x * 52}px,${stick.y * 52}px)` }}>MOVE</span>
        </button>
        <div>
          <button
            disabled={!active}
            aria-pressed={charging}
            className={charging ? 'sumo-live-charge held' : 'sumo-live-charge'}
            onPointerDown={(event) => {
              if (!active) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setChargeSource(`pointer:${event.pointerId}`, true);
            }}
            onPointerUp={(event) => setChargeSource(`pointer:${event.pointerId}`, false)}
            onPointerCancel={(event) => setChargeSource(`pointer:${event.pointerId}`, false)}
            onLostPointerCapture={(event) => setChargeSource(`pointer:${event.pointerId}`, false)}
            onKeyDown={(event) => {
              if (event.code !== 'Space' && event.code !== 'Enter') return;
              event.preventDefault();
              setChargeSource(`key:${event.code}`, true);
            }}
            onKeyUp={(event) => {
              if (event.code !== 'Space' && event.code !== 'Enter') return;
              event.preventDefault();
              setChargeSource(`key:${event.code}`, false);
            }}
          >
            Hold to charge<br />Release to bash
          </button>
          <button
            disabled={!active}
            className="sumo-live-dash"
            onPointerDown={(event) => {
              event.preventDefault();
              fireDash();
            }}
            onClick={(event) => {
              if (event.detail === 0) fireDash();
            }}
          >
            Dash
          </button>
        </div>
      </div>
      <p>Move with the pad. Aim, hold charge, then release. Keyboard: arrows/WASD, Space, Shift.</p>
      {party.error && <p role="alert">{party.error}</p>}
      <p className="sumo-live-note">Your spot stays saved when the host chooses New Game.</p>
    </main>
  );
}
