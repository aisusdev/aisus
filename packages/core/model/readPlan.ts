// P-26: the files a Generate run is planned to read, for the detailed estimate. The focus words pick
// the files whose paths name them, up to the tier's read budget (CST-05). The rest of the budget is
// filled with reads of the folder's median file.
import { lstatSync } from "node:fs";
import { join } from "node:path";
import { isTestPath, languageOf, listFiles, READ_BUDGET, type Tier } from "./repoSize";

/** A listed non-test text file and the tokens a read of it takes. */
export interface PlanFile {
  path: string;
  tokens: number;
}

export interface ReadPlan {
  /** Reads and searches the run is planned to make. */
  reads: number;
  /** The files whose paths name the focus, best match first. */
  matched: string[];
  /** Tokens of file content the reads add to the context. */
  readTokens: number;
}

/** Bytes per token in source code. */
const BYTES_PER_TOKEN = 4;
/** An agent's read stops near this many bytes, about 2,000 lines. */
const MAX_READ_BYTES = 80_000;
/** Focus words that name no file. */
const IGNORED = new Set(["the", "and", "for", "with", "from", "into", "how", "what", "this", "that", "flow", "code", "map"]);

/** The listed non-test text files of `root`, each with the tokens a read of it takes. */
export function planFiles(root: string, env: NodeJS.ProcessEnv = process.env): PlanFile[] {
  const files: PlanFile[] = [];
  for (const path of listFiles(root, env).files) {
    if (languageOf(path) === null || isTestPath(path)) continue;
    try {
      const stat = lstatSync(join(root, path));
      if (stat.isFile()) files.push({ path, tokens: Math.ceil(Math.min(stat.size, MAX_READ_BYTES) / BYTES_PER_TOKEN) });
    } catch {
      continue;
    }
  }
  return files;
}

/** The lowercase words of `focus` that can name a file: three letters or more, and not in {@link IGNORED}. */
export function focusWords(focus: string): string[] {
  return [...new Set(focus.toLowerCase().split(/[^\p{L}\p{N}]+/u))].filter((word) => word.length >= 3 && !IGNORED.has(word));
}

/** The plan of a run with `focus` over `files` in a repository of `tier`. */
export function readPlan(files: readonly PlanFile[], focus: string, tier: Tier): ReadPlan {
  const reads = READ_BUDGET[tier];
  const words = focusWords(focus);
  const scored = files
    .map((file) => ({ file, hits: words.filter((word) => file.path.toLowerCase().includes(word)).length }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.file.path.localeCompare(b.file.path))
    .slice(0, reads);
  const sorted = files.map((file) => file.tokens).sort((a, b) => a - b);
  const median = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
  const matchedTokens = scored.reduce((sum, entry) => sum + entry.file.tokens, 0);
  return { reads, matched: scored.map((entry) => entry.file.path), readTokens: matchedTokens + (reads - scored.length) * median };
}
