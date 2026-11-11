"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";

const HISTORY_KEY = "__kingPrompterPanels";
const STACK_KEY = "__kingPrompterPanelStack";
const OWNER_KEY = "__kingPrompterPanelOwner";
const CHANGE_EVENT = "king-prompter:history-panel-change";
type PanelState = Record<string, unknown>;

function stateRecord(): PanelState {
  const state = window.history.state;
  return state && typeof state === "object" && !Array.isArray(state) ? state as PanelState : {};
}

function readPanel<T>(key: string, fallback: T): T {
  const panels = stateRecord()[HISTORY_KEY];
  if (!panels || typeof panels !== "object" || !(key in panels)) return fallback;
  return (panels as Record<string, T>)[key];
}

function panelStack(record: PanelState): string[] {
  const stack = record[STACK_KEY];
  return Array.isArray(stack) ? stack.filter((value): value is string => typeof value === "string") : [];
}

function removePanel(record: PanelState, key: string): PanelState {
  const panels = { ...(record[HISTORY_KEY] as Record<string, unknown> | undefined) };
  delete panels[key];
  const stack = panelStack(record).filter(value => value !== key);
  const next = { ...record };
  if (Object.keys(panels).length) next[HISTORY_KEY] = panels;
  else delete next[HISTORY_KEY];
  if (stack.length) {
    next[STACK_KEY] = stack;
    next[OWNER_KEY] = stack[stack.length - 1];
  } else {
    delete next[STACK_KEY];
    delete next[OWNER_KEY];
  }
  return next;
}

/** A bounded history entry per local screen. Back closes it; Forward restores it. */
export function useHistoryPanel<T>(initial: T, onPop?: (value: T) => void): [T, (value: T, options?: { replace?: boolean }) => void, () => void, () => void] {
  const reactId = useId();
  const key = `panel:${reactId}`;
  const subscribe = useCallback((listener: () => void) => {
    window.addEventListener("popstate", listener);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
      window.removeEventListener("popstate", listener);
      window.removeEventListener(CHANGE_EVENT, listener);
    };
  }, []);
  const getSnapshot = useCallback(() => readPanel(key, initial), [initial, key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  const valueRef = useRef(value);
  const onPopRef = useRef(onPop);
  const closingRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
    onPopRef.current = onPop;
  }, [onPop, value]);

  useEffect(() => {
    const onPopState = () => {
      const next = readPanel(key, initial);
      closingRef.current = false;
      valueRef.current = next;
      onPopRef.current?.(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initial, key]);

  const navigate = useCallback((next: T, options?: { replace?: boolean }) => {
    const currentRecord = stateRecord();
    const panels = currentRecord[HISTORY_KEY] && typeof currentRecord[HISTORY_KEY] === "object"
      ? currentRecord[HISTORY_KEY] as Record<string, T>
      : {};
    const hasEntry = Object.prototype.hasOwnProperty.call(panels, key);
    if (Object.is(next, valueRef.current)) return;
    if (Object.is(next, initial) && hasEntry) {
      if (options?.replace) {
        window.history.replaceState(removePanel(currentRecord, key), "", window.location.href);
        window.dispatchEvent(new Event(CHANGE_EVENT));
        closingRef.current = false;
        valueRef.current = next;
        return;
      }
      if (closingRef.current) return;
      closingRef.current = true;
      window.history.back();
      return;
    }

    closingRef.current = false;
    const nextPanels = { ...panels, [key]: next };
    const nextRecord: PanelState = { ...currentRecord, [HISTORY_KEY]: nextPanels };
    if (hasEntry) {
      window.history.replaceState(nextRecord, "", window.location.href);
    } else {
      const stack = panelStack(currentRecord);
      nextRecord[STACK_KEY] = [...stack, key];
      nextRecord[OWNER_KEY] = key;
      window.history.pushState(nextRecord, "", window.location.href);
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    valueRef.current = next;
  }, [initial, key]);

  const discardCurrentEntry = useCallback(() => {
    const record = stateRecord();
    const panels = record[HISTORY_KEY];
    if (!panels || typeof panels !== "object" || !(key in panels) || record[OWNER_KEY] !== key || Object.is(valueRef.current, initial) || closingRef.current) return;
    closingRef.current = true;
    window.history.back();
  }, [initial, key]);

  const discardBranch = useCallback(() => {
    const record = stateRecord();
    const panels = record[HISTORY_KEY];
    const stack = panelStack(record);
    const index = stack.lastIndexOf(key);
    if (!panels || typeof panels !== "object" || !(key in panels) || index < 0 || closingRef.current) return;
    closingRef.current = true;
    window.history.go(-(stack.length - index));
  }, [key]);

  return [value, navigate, discardCurrentEntry, discardBranch];
}
