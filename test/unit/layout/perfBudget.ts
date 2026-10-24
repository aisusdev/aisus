// ENG-02: the layout budget compares a large layout with a small one timed on the same machine.

/** The large layout may take at most this many times the small one. The measured ratio is about 12. */
export const BUDGET_FACTOR = 24;

export interface BudgetResult {
  /** Median of the large layout's time divided by the small one's, over runs taken in turns. */
  ratio: number;
  /** Median milliseconds of the large layout. */
  subject: number;
  /** Median milliseconds of the small layout. */
  reference: number;
  ok: boolean;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

async function timed(run: () => Promise<unknown>, now: () => number): Promise<number> {
  const start = now();
  await run();
  return now() - start;
}

/** Median of `runs` timed calls, after one untimed warm-up call. */
export async function timedMedian(run: () => Promise<unknown>, now: () => number, runs: number): Promise<number> {
  await run();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) times.push(await timed(run, now));
  return median(times);
}

/**
 * Times both layouts in turns and checks the large one against {@link BUDGET_FACTOR}. Each pair of
 * runs sees the same load on the machine, and the median of the pairs' ratios ignores a slow pair.
 */
export async function checkLayoutBudget(
  subject: () => Promise<unknown>,
  reference: () => Promise<unknown>,
  now: () => number = () => performance.now(),
  runs = 5,
): Promise<BudgetResult> {
  await reference();
  await subject();
  const references: number[] = [];
  const subjects: number[] = [];
  for (let i = 0; i < runs; i++) {
    references.push(await timed(reference, now));
    subjects.push(await timed(subject, now));
  }
  const ratio = median(subjects.map((time, i) => time / references[i]!));
  return { ratio, subject: median(subjects), reference: median(references), ok: ratio <= BUDGET_FACTOR };
}
