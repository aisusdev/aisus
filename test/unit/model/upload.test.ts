// CST-03 with CLD-09: a run.json the extension recorded, estimate included, still uploads; the upload
// stays closed to anything else.
import { expect, test } from "vitest";
import { checkUpload, diagramPayload, mapPayload } from "@aisus/core/model/upload";

const MAP = { schema_version: 1, diagram_type: "architecture", meta: { title: "Shop", output: ".aisus/maps/architecture-shop-20261018-120000/shop.html" }, components: [{ id: "api", type: "backend", label: "API" }] };
const RECORD = {
  schema: 1,
  kind: "full",
  focus: "",
  paths: [],
  base: null,
  parent: null,
  createdAt: "2026-10-18T12:00:00.000Z",
  skillVersion: "0.2.0",
  phase: "accepted",
  attempts: 1,
  agent: "Claude Code",
  mode: "sidebar",
  estimate: { low: 84_000, high: 168_000, basis: "provisional", model: "claude-opus-5-5" },
};

const upload = (run: unknown) => mapPayload({ repo: "acme/shop", commit: "a".repeat(40), branch: "main", run: "architecture-shop-20261018-120000", map: MAP, record: null, sidecars: { run } });

test("CST-03 a run.json with the extension's estimate uploads, and the estimate stays closed", () => {
  expect(checkUpload(upload(RECORD))).toEqual([]);
  expect(checkUpload(upload({ ...RECORD, estimate: { ...RECORD.estimate, text: "About 80k–170k tokens" } })).map((issue) => issue.pointer)).toEqual(["/sidecars/run/estimate/text"]);
});

const diagram = (instructions?: string) =>
  diagramPayload({ repo: "acme/shop", commit: "a".repeat(40), branch: "session-cache", pull: 42, map: MAP, run: "architecture-login-cache-20261030-120000", ...(instructions === undefined ? {} : { instructions }) });

test("PRC-07 a pull request's diagram uploads with its number and instructions, and only within their limits", () => {
  expect(checkUpload(diagram("Show how login reaches the new session cache"))).toEqual([]);
  expect(checkUpload(diagram("x".repeat(500)))).toEqual([]);
  const { pull: _pull, ...withoutPull } = diagram().meta;
  expect(checkUpload({ ...diagram(), meta: withoutPull }).length).toBeGreaterThan(0);
  expect(checkUpload(diagram("x".repeat(501))).map((issue) => issue.pointer)).toEqual(["/meta/instructions"]);
  expect(checkUpload(diagram(`use ghp_${"a".repeat(36)} to log in`)).map((issue) => issue.code)).toContain("SecretLike");
  expect(checkUpload({ ...upload(RECORD), meta: { ...upload(RECORD).meta, instructions: "Show login" } }).length).toBeGreaterThan(0);
});
