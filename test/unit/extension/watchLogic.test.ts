// FR-WAT-01: 300 ms debouncing and the reload / switch / notify / deleted decisions.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { candidateOf, ChangeBatch, DEBOUNCE_MS, LOCK_POLL_MS, LockPoll, noteCandidate, sessionPathOf, watchAction, type CandidateChange } from "../../../apps/vscode/src/watchLogic";

describe("FR-WAT-01 debouncing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("events are delivered once, 300 ms after the last one, merged per file", () => {
    const flushes: [string, boolean][][] = [];
    const batch = new ChangeBatch((changes) => flushes.push([...changes]));
    batch.add("/r/a", true);
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    batch.add("/r/a", false);
    batch.add("/r/b", false);
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(flushes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([
      [
        ["/r/a", true],
        ["/r/b", false],
      ],
    ]);
    batch.add("/r/a", false);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(flushes[1]).toEqual([["/r/a", false]]);
  });

  test("dispose drops pending events", () => {
    const flush = vi.fn();
    const batch = new ChangeBatch(flush);
    batch.add("/r/a", true);
    batch.dispose();
    vi.advanceTimersByTime(DEBOUNCE_MS * 2);
    expect(flush).not.toHaveBeenCalled();
  });
});

describe("FR-WAT-01 decisions", () => {
  const change = (overrides: Partial<CandidateChange>): CandidateChange => ({
    file: "/r/.aisus/maps/new/candidate.json",
    created: true,
    exists: true,
    root: "/r",
    newest: "/r/.aisus/maps/new/candidate.json",
    ...overrides,
  });
  const panel = { root: "/r", file: "/r/.aisus/maps/old/candidate.json" };

  test("a change to the shown file reloads it", () => {
    expect(watchAction(change({ file: panel.file, created: false, newest: "/r/.aisus/maps/new/candidate.json" }), panel)).toEqual({ kind: "reload" });
  });

  test("deleting the shown file shows the deleted state", () => {
    expect(watchAction(change({ file: panel.file, exists: false }), panel)).toEqual({ kind: "deleted" });
  });

  test("a new newest candidate loads into a panel open for its folder", () => {
    expect(watchAction(change({}), panel)).toEqual({ kind: "switch", root: "/r", file: "/r/.aisus/maps/new/candidate.json" });
  });

  test("a new newest candidate is offered when no panel is open or it shows another folder", () => {
    expect(watchAction(change({}), undefined)).toEqual({ kind: "notify", root: "/r", file: "/r/.aisus/maps/new/candidate.json" });
    expect(watchAction(change({}), { root: "/other", file: "/other/x.json" })).toMatchObject({ kind: "notify" });
  });

  test.each([
    ["not the newest", { newest: "/r/.aisus/maps/later/candidate.json" }],
    ["only changed, not created", { created: false }],
    ["already deleted again", { exists: false }],
  ])("a candidate that is %s is ignored", (_case, overrides) => {
    expect(watchAction(change(overrides), panel)).toBeUndefined();
    expect(watchAction(change(overrides), undefined)).toBeUndefined();
  });
});

describe("FR-WAT-01 candidates from any event in a run folder", () => {
  test("an event anywhere in a run folder concerns that folder's candidate.json", () => {
    const maps = "/r/.aisus/maps";
    expect(candidateOf(maps, "/r/.aisus/maps/run-a", "/")).toBe("/r/.aisus/maps/run-a/candidate.json");
    expect(candidateOf(maps, "/r/.aisus/maps/run-a/.candidate.json.tmp-1-2", "/")).toBe("/r/.aisus/maps/run-a/candidate.json");
    expect(candidateOf(maps, "/r/.aisus/maps", "/")).toBeUndefined();
    expect(candidateOf(maps, "/r/.aisus/mapsx/run-a", "/")).toBeUndefined();
  });

  test("a candidate is new once, then a change, and new again after it was deleted", () => {
    const known = new Set<string>();
    expect(noteCandidate(known, "/r/.aisus/maps/a/candidate.json", true)).toBe(true);
    expect(noteCandidate(known, "/r/.aisus/maps/a/candidate.json", true)).toBe(false);
    expect(noteCandidate(known, "/r/.aisus/maps/a/candidate.json", false)).toBe(false);
    expect(noteCandidate(known, "/r/.aisus/maps/a/candidate.json", true)).toBe(true);
  });
});

describe("P-2 SAF-06 session watcher paths", () => {
  test("the lock, a run's session.json and the .aisus and .aisus/sessions folders count, and nothing else", () => {
    const at = (path: string): string | undefined => sessionPathOf("/r", path, "/");
    expect(at("/r/.aisus/sessions/active")).toBe("lock");
    expect(at("/r/.aisus/sessions/bugfix-a-20261019-120000/session.json")).toBe("session");
    expect([at("/r/.aisus"), at("/r/.aisus/sessions")]).toEqual(["folder", "folder"]);
    expect(at("/r/.aisus/sessions/bugfix-a-20261019-120000/events.jsonl")).toBeUndefined();
    expect(at("/r/.aisus/sessions/bugfix-a-20261019-120000/manifest.json")).toBeUndefined();
    expect(at("/r/.aisus/sessions/bugfix-a-20261019-120000")).toBeUndefined();
    expect(at("/r/.aisus/sessions/a/b/session.json")).toBeUndefined();
    expect([at("/r/.aisus/maps"), at("/r/.aisus/maps/active"), at("/r/src/.aisus/sessions/active"), at("/other/.aisus/sessions/active")]).toEqual([undefined, undefined, undefined, undefined]);
    expect(sessionPathOf("C:\\r", "C:\\r\\.aisus\\sessions\\active", "\\")).toBe("lock");
  });
});

describe("P-2 SAF-06 lock check", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("a lock that exists is checked once a second, and its going is reported once", () => {
    let exists = true;
    let gone = 0;
    const poll = new LockPoll(() => exists, () => (gone += 1));
    poll.start();
    poll.start();
    vi.advanceTimersByTime(LOCK_POLL_MS * 3);
    expect(gone).toBe(0);
    exists = false;
    vi.advanceTimersByTime(LOCK_POLL_MS);
    expect(gone).toBe(1);
    vi.advanceTimersByTime(LOCK_POLL_MS * 3);
    expect(gone).toBe(1);
  });

  test("no check starts while there is no lock", () => {
    let gone = 0;
    new LockPoll(() => false, () => (gone += 1)).start();
    vi.advanceTimersByTime(LOCK_POLL_MS * 3);
    expect(gone).toBe(0);
  });
});
