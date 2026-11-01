// CST-02: token estimates from the repository's size, prices from the official pages, and
// bench:fit reproducing known coefficients from bench results. CST-03: the estimate's text and the
// second click. P-26: calibration to a folder's past runs, and the detailed estimate's read plan.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runFit } from "../../../tools/bench/fit";
import { COEFFICIENTS, detailedEstimate, detailedRunEstimate, dollars, ESTIMATE_AGENTS, ESTIMATE_KINDS, estimate, estimateText, modelPrice, PRICING, priceRange, runEstimate, skillEstimates, tokenAmount, type Coefficients, type TokenMix } from "@aisus/core/model/estimate";
import type { BenchResult } from "@aisus/core/model/fit";
import { readPlan } from "@aisus/core/model/readPlan";
import { READ_BUDGET } from "@aisus/core/model/repoSize";
import { MAP_DIR } from "@aisus/core/model/runFolder";
import { finishedRuns } from "@aisus/core/model/runRecord";
import { tempDir } from "../support/temp";

test("CST-02 estimates grow with size for every agent and kind, and stay provisional until fitted", () => {
  const sizes = [
    { nonTestLines: 2_000, files: 40 },
    { nonTestLines: 30_000, files: 400 },
    { nonTestLines: 300_000, files: 4_000 },
  ];
  for (const agent of ESTIMATE_AGENTS) {
    for (const kind of ESTIMATE_KINDS) {
      const ranges = sizes.map((size) => estimate(size, agent, kind));
      for (const range of ranges) expect(range.low).toBeLessThan(range.high);
      expect(ranges[1]!.low, `${agent} ${kind}`).toBeGreaterThan(ranges[0]!.low);
      expect(ranges[2]!.high, `${agent} ${kind}`).toBeGreaterThan(ranges[1]!.high);
      expect(ranges[0]!.basis).toBe("provisional");
    }
  }
  expect(COEFFICIENTS.basis).toBe("provisional");
});

test("CST-02 every price is dated and sourced from its provider's pricing page, and dollars follow the token mix", () => {
  expect(PRICING.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  for (const model of PRICING.models) {
    expect(model.source, model.id).toBe(model.agent === "claude" ? "https://platform.claude.com/docs/en/about-claude/pricing" : "https://developers.openai.com/api/docs/pricing");
  }
  for (const agent of ESTIMATE_AGENTS) expect(modelPrice(agent)?.id).toBe(PRICING.defaults[agent]);
  const opus = modelPrice("claude", "claude-opus-5-5")!;
  const mix: TokenMix = { input: 0.1, cacheWrite: 0.1, cacheRead: 0.7, output: 0.1 };
  expect(dollars(1_000_000, opus, mix)).toBeCloseTo(0.4 + 0.5 + 0.14 + 2, 10);
  const table: Coefficients = { ...COEFFICIENTS, mix: { ...COEFFICIENTS.mix, claude: mix } };
  const range = priceRange({ low: 200_000, high: 300_000, basis: "provisional" }, "claude", opus, table);
  expect([range.low, range.high].map((value) => Number(value.toFixed(3)))).toEqual([0.608, 0.912]);
  expect(modelPrice("codex", "claude-opus-5-5")).toBeUndefined();
});

test("CST-02 bench:fit reproduces known coefficients and the token mix from bench results", () => {
  const known = { base: 50_000, perLine: 2, perFile: 40 };
  const usage = (tokens: number): TokenMix => ({ input: tokens * 0.1, cacheWrite: tokens * 0.2, cacheRead: tokens * 0.6, output: tokens * 0.1 });
  const sizes = [[1_000, 50], [5_000, 80], [20_000, 300], [60_000, 500], [120_000, 2_000]] as const;
  const results: BenchResult[] = sizes.map(([nonTestLines, files]) => ({
    agent: "claude",
    kind: "full",
    accepted: true,
    size: { nonTestLines, files },
    usage: usage(known.base + known.perLine * nonTestLines + known.perFile * files),
  }));
  results.push({ ...results[0]!, accepted: false, usage: usage(10_000_000) });
  results.push({ ...results[0]!, agent: "codex", kind: "refresh" });
  const dir = tempDir();
  results.forEach((result, index) => {
    mkdirSync(join(dir, `run-${index}`));
    writeFileSync(join(dir, `run-${index}`, "result.json"), JSON.stringify(result));
  });
  const out = join(tempDir(), "coefficients.json");
  const summary = runFit(dir, out, new Date("2026-10-18T00:00:00Z"));
  const fitted = JSON.parse(readFileSync(out, "utf8")) as Coefficients;
  expect(fitted.lines.claude.full).toEqual({ ...known, low: 1, high: 1 });
  expect(fitted.mix.claude).toEqual({ input: 0.1, cacheWrite: 0.2, cacheRead: 0.6, output: 0.1 });
  expect(fitted.lines.codex.refresh).toEqual(COEFFICIENTS.lines.codex.refresh);
  expect(fitted).toMatchObject({ basis: "fitted", fittedAt: "2026-10-18T00:00:00.000Z", runs: 5 });
  expect(summary).toBe("bench:fit: 7 results; fitted claude full; kept claude refresh, claude ask, codex full, codex refresh, codex ask.\n");
});

test("CST-02 a fit never lets an estimate shrink as the repository grows", () => {
  const sizes = [[1_000, 900], [5_000, 700], [20_000, 500], [60_000, 300], [120_000, 100]] as const;
  const results: BenchResult[] = sizes.map(([nonTestLines, files]) => ({
    agent: "codex",
    kind: "full",
    accepted: true,
    size: { nonTestLines, files },
    usage: { input: 40_000 + 2 * nonTestLines - 30 * files, cacheWrite: 0, cacheRead: 0, output: 0 },
  }));
  const dir = tempDir();
  results.forEach((result, index) => {
    mkdirSync(join(dir, `run-${index}`));
    writeFileSync(join(dir, `run-${index}`, "result.json"), JSON.stringify(result));
  });
  const out = join(tempDir(), "coefficients.json");
  runFit(dir, out);
  const line = (JSON.parse(readFileSync(out, "utf8")) as Coefficients).lines.codex.full;
  expect(line.perLine).toBeGreaterThan(0);
  expect(line.perFile).toBe(0);
});

test("CST-03 the estimate line gives the token range and the API price", () => {
  const range = { low: 182_000, high: 257_000, basis: "provisional" as const };
  expect(estimateText(range, { low: 0.5, high: 0.8 })).toBe("About 180k–260k tokens ($0.50–$0.80 at API prices)");
  expect(estimateText(range, null)).toBe("About 180k–260k tokens");
  expect([tokenAmount(4_000), tokenAmount(995_000), tokenAmount(1_240_000), tokenAmount(2_000_000)]).toEqual(["10k", "1M", "1.2M", "2M"]);
  expect(estimateText({ ...range, low: 1_000 }, { low: 0.001, high: 0.004 })).toContain("($0.01–$0.01 at API prices)");
});

test("CST-03 a run needs a second click only when the top of its range is above the threshold", () => {
  const size = { nonTestLines: 10_000, files: 200 };
  const { range, text, model } = runEstimate(size, "claude", "full", Infinity);
  expect(model).toBe(PRICING.defaults.claude);
  expect(text).toBe(estimateText(range, priceRange(range, "claude", modelPrice("claude")!)));
  expect(runEstimate(size, "claude", "full", range.high).confirm).toBe(false);
  expect(runEstimate(size, "claude", "full", range.high - 1).confirm).toBe(true);
  expect(skillEstimates(size, "refresh").codex).toEqual({ ...estimate(size, "codex", "refresh"), text: runEstimate(size, "codex", "refresh", Infinity).text });
});

test("P-26 finished runs that spent 2, 3 and 7 times their estimate scale the next one by their median, 3, and other runs are left out", () => {
  const root = tempDir();
  const run = (name: string, fields: Record<string, unknown>): void => {
    mkdirSync(join(root, MAP_DIR, name), { recursive: true });
    const record = { schema: 1, kind: "full", focus: "", paths: [], base: null, parent: null, createdAt: `2026-11-01T00:00:0${name.length}Z`, skillVersion: "1", phase: "accepted", attempts: 1, agent: "Claude Code", tokens: { input: 1, output: 1, cacheRead: 1, cacheWrite: 1 } };
    writeFileSync(join(root, MAP_DIR, name, "run.json"), JSON.stringify({ ...record, ...fields }));
  };
  run("a", {});
  run("bb", { phase: "rejected" });
  run("ccc", { agent: "Codex" });
  run("dddd", { kind: "refresh" });
  run("eeeee", { phase: "created" });
  run("ffffff", { tokens: undefined });
  expect(finishedRuns(root, "Claude Code", "full", 5).map((record) => record.phase)).toEqual(["rejected", "accepted"]);

  const size = { nonTestLines: 10_000, files: 200 };
  const plain = runEstimate(size, "claude", "full", Infinity);
  const scaled = runEstimate(size, "claude", "full", Infinity, [7, 2, 3]);
  expect(scaled.range).toEqual({ ...plain.range, low: plain.range.low * 3, high: plain.range.high * 3 });
  expect(scaled.details).toEqual(["Scaled to what the last 3 runs in this folder spent."]);
  expect(plain.details).toEqual([]);
});

test("P-26 the detailed estimate counts each read again on every later turn, as worked by hand", () => {
  // 45 reads at 3 a turn and 8 more turns make 23 turns: 23 × 20k + 30k × 24 / 2 + 20k = 840k.
  const plan = { reads: 45, matched: [], readTokens: 30_000 };
  const { range, turns } = detailedEstimate(plan, "claude");
  const line = COEFFICIENTS.lines.claude.full;
  expect(turns).toBe(23);
  expect(range).toEqual({ low: Math.round(840_000 * line.low), high: Math.round(840_000 * line.high), basis: COEFFICIENTS.basis });
  const doubled = detailedEstimate({ reads: 90, matched: [], readTokens: 60_000 }, "claude").range;
  expect(doubled.high).toBeGreaterThan(2 * range.high);
  expect(detailedRunEstimate(plan, "claude").confirm).toBe(true);
});

test("P-26 a focus naming one folder plans only that folder's files, and an empty focus plans the full budget at the median file", () => {
  const files = [
    { path: "src/payments/charge.ts", tokens: 900 },
    { path: "src/payments/refund.ts", tokens: 700 },
    { path: "src/auth/login.ts", tokens: 100 },
    { path: "src/auth/session.ts", tokens: 200 },
    { path: "README.md", tokens: 300 },
  ];
  const focused = readPlan(files, "the payment flow", "S");
  expect(focused.matched).toEqual(["src/payments/charge.ts", "src/payments/refund.ts"]);
  expect(focused.reads).toBe(READ_BUDGET.S);
  expect(focused.readTokens).toBe(900 + 700 + (READ_BUDGET.S - 2) * 300);
  const whole = readPlan(files, "", "S");
  expect(whole.matched).toEqual([]);
  expect(whole.readTokens).toBe(READ_BUDGET.S * 300);
});
