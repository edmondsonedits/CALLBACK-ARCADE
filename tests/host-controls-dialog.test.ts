import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import { createElement, type ReactElement } from "react";
import ts from "typescript";

// Execute the real drawer and its effects/handlers. The dialog DOM boundary is
// simulated; native Tab containment/inertness/focus restoration need browser QA.
const source = ts.createSourceFile("page.tsx", readFileSync(new URL("../app/host/[code]/page.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "HostControls");
assert.ok(component);
const compiled = ts.transpileModule(component.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
type Element = ReactElement<Record<string, unknown>>;
function elements(element: Element): Element[] {
  const children = [element.props.children].flat(Infinity).filter((child): child is Element => !!child && typeof child === "object" && "props" in child);
  return [element, ...children.flatMap(elements)];
}

function harness() {
  const refs: { current: unknown }[] = [];
  let refIndex = 0;
  let effectIndex = 0;
  const dependencies: unknown[][] = [];
  let pending: (() => void)[] = [];
  let closeRequests = 0;
  let focusRequests = 0;
  let confirmation = false;
  const actions: unknown[][] = [];
  const dialog = {
    open: false,
    shows: 0,
    closes: 0,
    showModal() { this.open = true; this.shows += 1; },
    close() { this.open = false; this.closes += 1; },
  };
  const context = createContext({
    React: { createElement },
    ScrollPanel: ({children}:{children:unknown}) => children,
    useRef: (current: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current }),
    useEffect: (callback: () => void, next: unknown[]) => {
      const index = effectIndex++;
      if (!dependencies[index] || next.some((value, i) => !Object.is(value, dependencies[index][i]))) pending.push(callback);
      dependencies[index] = next;
    },
    confirm: () => confirmation,
  });
  runInContext(compiled, context);
  const render = (open: boolean) => {
    refIndex = 0; effectIndex = 0; pending = [];
    const tree = context.HostControls({
      open,
      close: () => { closeRequests += 1; },
      act: async (...args: unknown[]) => { actions.push(args); },
      snapshot: { gameLength: "standard", phase: "LOBBY", paused: false, deadlineAt: null, answers: [], players: [], timerAccessibility: false, joiningLocked: false },
      audio: { ready: false, settings: { muted: false, masterVolume: 0.25, music: true, musicVolume: 0.25, effects: true, effectsVolume: 0.25, narrator: true, narratorVolume: 0.25, voiceURI: "" }, voiceOptions: [], activateOrToggle() {}, update() {}, testVoice() {} },
    }) as Element;
    const ref = tree.props.ref as { current: unknown } | undefined;
    if (ref) ref.current = dialog;
    const close = elements(tree).find((element) => element.props["aria-label"] === "Close controls");
    const closeRef = close?.props.ref as { current: unknown } | undefined;
    if (closeRef) closeRef.current = { focus() { focusRequests += 1; } };
    for (const effect of pending) effect();
    return tree;
  };
  return { render, dialog, actions, get closeRequests() { return closeRequests; }, get focusRequests() { return focusRequests; }, confirm(value: boolean) { confirmation = value; } };
}

test("host controls enter a named native modal with the close button as initial focus", () => {
  const h = harness();
  h.render(false);
  assert.equal(h.dialog.shows, 0);
  const tree = h.render(true);
  assert.equal(tree.type, "dialog", "a CSS overlay does not make the background inert");
  assert.equal(tree.props["aria-label"], "Host controls");
  assert.equal(tree.props.open, undefined, "showModal must be used instead of a modeless open attribute");
  assert.equal(h.dialog.shows, 1);
  assert.equal(h.focusRequests, 1);
});

test("repeated open/close uses the native modal lifecycle without reopening on room refresh", () => {
  const h = harness();
  h.render(false);
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    h.render(true);
    assert.equal(h.dialog.open, true);
    assert.equal(h.dialog.shows, cycle);
    assert.equal(h.focusRequests, cycle);
    h.render(true);
    assert.equal(h.dialog.shows, cycle);
    h.render(false);
    assert.equal(h.dialog.open, false);
    assert.equal(h.dialog.closes, cycle, "native close restores the pre-modal focus");
    h.render(false);
    assert.equal(h.dialog.closes, cycle);
  }
});

test("Escape requests a React close and prevents a divergent native cancel", () => {
  const h = harness();
  const tree = h.render(true);
  let prevented = false;
  assert.equal(typeof tree.props.onCancel, "function");
  (tree.props.onCancel as (event: unknown) => void)({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.closeRequests, 1);
  h.render(false);
  assert.equal(h.dialog.open, false);
});

test("the backdrop retains its non-dismissing behavior while Close still dismisses", () => {
  const h = harness();
  const tree = h.render(true);
  assert.equal(tree.props.onClick, undefined);
  assert.equal(h.closeRequests, 0);
  const close = elements(tree).find((element) => element.props["aria-label"] === "Close controls")!;
  (close.props.onClick as () => void)();
  assert.equal(h.closeRequests, 1);
});

test("a delayed native close event cannot dismiss a newly reopened drawer", () => {
  const h = harness();
  h.render(true); h.render(false);
  const reopened = h.render(true);
  assert.equal(typeof reopened.props.onClose, "function");
  const onClose = reopened.props.onClose as (event: unknown) => void;
  onClose({ currentTarget: h.dialog });
  assert.equal(h.closeRequests, 0);
  h.dialog.close();
  onClose({ currentTarget: h.dialog });
  assert.equal(h.closeRequests, 1);
});

test("ending the game remains guarded by its existing confirmation", () => {
  const h = harness();
  const tree = h.render(true);
  const end = elements(tree).find((element) => element.props.className === "danger-button")!;
  (end.props.onClick as () => void)();
  assert.deepEqual(h.actions, []);
  h.confirm(true);
  (end.props.onClick as () => void)();
  assert.deepEqual(h.actions, [["END_GAME"]]);
});
