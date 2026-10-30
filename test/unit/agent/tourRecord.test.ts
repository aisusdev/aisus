// SKL-02: tour-record.mjs checks the tour skill's draft against the map and the code, writes tour.json,
// and removes the draft.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { put, runScript, tempDir } from "../support/temp";

const RUN = "architecture-shop-20261019-120000";
const DRAFT = `.aisus/maps/${RUN}/tour-draft.json`;

/** A repository with an accepted map of web and api boxes. */
function toured(draft: unknown): string {
  const root = tempDir();
  put(root, "src/web.ts", "import { api } from './api';\nexport const web = () => api();\n");
  put(root, "src/api.ts", "export const api = () => 1;\n");
  put(root, ".env", "KEY=1\n");
  put(
    root,
    `.aisus/maps/${RUN}/candidate.json`,
    JSON.stringify({
      schema_version: 1,
      diagram_type: "architecture",
      meta: { title: "Shop" },
      components: [
        { id: "web", type: "frontend", label: "Web", sources: [{ path: "src/web.ts", line: 2 }] },
        { id: "api", type: "backend", label: "API", sources: [{ path: "src/api.ts", line: 1 }] },
      ],
      connections: [{ from: "web", to: "api", label: "calls" }],
    }),
  );
  put(root, DRAFT, typeof draft === "string" ? draft : JSON.stringify(draft));
  return root;
}

const STOP = { component: "web", title: "The page", explanation: "The web box renders the shop and calls the API.", question: "What does web call?", answer: "api(), on line 2.", citation: { path: "src/web.ts", line: 2 } };
const GOOD = { stops: [STOP, { ...STOP, component: "api", citation: { path: "src/api.ts", line: 1 } }, STOP, { ...STOP, citation: { path: "src/web.ts", line: 1, end_line: 2 } }] };

test("SKL-02 a draft of four to twelve stops on the map's boxes is recorded as tour.json with its date, and the draft is removed", () => {
  const root = toured(GOOD);
  const run = runScript("tour-record", [DRAFT], { cwd: root });
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.json()).toEqual({ status: "recorded", tour: `.aisus/maps/${RUN}/tour.json`, stops: 4 });
  expect(JSON.parse(readFileSync(join(root, ".aisus/maps", RUN, "tour.json"), "utf8"))).toEqual({ schema: 1, createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), ...GOOD });
  expect(existsSync(join(root, DRAFT))).toBe(false);
});

test("SKL-02 the draft's shape is checked first: four to twelve stops, explanations of at most 400 characters, every field, and no extra fields", () => {
  const errors = (draft: unknown): string[] => runScript("tour-record", [DRAFT], { cwd: toured(draft) }).json().errors.map((error: { pointer: string }) => error.pointer);
  expect(errors({ stops: GOOD.stops.slice(0, 3) })).toEqual(["/stops"]);
  expect(errors({ stops: Array.from({ length: 13 }, () => STOP) })).toEqual(["/stops"]);
  const { answer: _answer, ...noAnswer } = STOP;
  expect(errors({ stops: [{ ...STOP, explanation: "x".repeat(401) }, noAnswer, { ...STOP, code: "export const web" }, STOP] })).toEqual(["/stops/0/explanation", "/stops/1", "/stops/2"]);
});

test("SKL-02 each stop names a box of the map and cites a line the citation rules accept", () => {
  const run = runScript("tour-record", [DRAFT], { cwd: toured({ stops: [{ ...STOP, component: "db" }, { ...STOP, citation: { path: ".env", line: 1 } }, { ...STOP, citation: { path: "src/api.ts", line: 9 } }, STOP] }) });
  expect(run.status).toBe(1);
  expect(run.json().errors.map((error: { pointer: string }) => error.pointer)).toEqual(["/stops/0/component"]);
  const cited = runScript("tour-record", [DRAFT], { cwd: toured({ stops: [{ ...STOP, citation: { path: ".env", line: 1 } }, { ...STOP, citation: { path: "src/api.ts", line: 9 } }, STOP, STOP] }) });
  expect(cited.status).toBe(1);
  expect(cited.json().errors.map((error: { pointer: string }) => error.pointer)).toEqual([expect.stringMatching(/^\/stops\/0\/citation/), expect.stringMatching(/^\/stops\/1\/citation/)]);
});

test("SKL-02 a tour of a sequence map is recorded when its stops name the map's participants and messages, and refused for a stop naming neither", () => {
  const root = tempDir();
  const run = "sequence-login-20261019-120000";
  const draft = `.aisus/maps/${run}/tour-draft.json`;
  put(root, "src/web.ts", "import { api } from './api';\nexport const web = () => api();\n");
  put(root, "src/api.ts", "export const api = () => 1;\n");
  put(
    root,
    `.aisus/maps/${run}/candidate.json`,
    JSON.stringify({
      schema_version: 1,
      diagram_type: "sequence",
      meta: { title: "Login" },
      participants: [
        { id: "web", type: "frontend", label: "Web", sources: [{ path: "src/web.ts", line: 2 }] },
        { id: "api", type: "backend", label: "API", sources: [{ path: "src/api.ts", line: 1 }] },
      ],
      messages: [{ id: "call", from: "web", to: "api", label: "api()", sources: [{ path: "src/web.ts", line: 2 }] }],
    }),
  );
  const stops = [STOP, { ...STOP, component: "call" }, { ...STOP, component: "api", citation: { path: "src/api.ts", line: 1 } }, STOP];
  put(root, draft, JSON.stringify({ stops: [...stops.slice(0, 3), { ...STOP, component: "components" }] }));
  const refused = runScript("tour-record", [draft], { cwd: root });
  expect(refused.status).toBe(1);
  expect(refused.json().errors.map((error: { pointer: string }) => error.pointer)).toEqual(["/stops/3/component"]);
  put(root, draft, JSON.stringify({ stops }));
  const recorded = runScript("tour-record", [draft], { cwd: root });
  expect(recorded.stderr).toBe("");
  expect(recorded.json()).toEqual({ status: "recorded", tour: `.aisus/maps/${run}/tour.json`, stops: 4 });
});
