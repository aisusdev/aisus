// SEQ-03: a sequence map's layout from message order: column widths, activations, calls to
// itself and phases. Text is measured at 0.6 of the font size per character.
import { describe, expect, test } from "vitest";
import { layoutSequence } from "@aisus/core/layout/sequence";
import { readDiagram, type ViewSequence } from "@aisus/core/model/tolerant";
import { fixedAdvance } from "./helpers";

type Raw = { from: string; to: string; label?: string; variant?: string; note?: string };

function sequence(participants: string[], messages: Raw[], phases: { label: string; first: string; last: string }[] = []): ViewSequence {
  const result = readDiagram({
    diagram_type: "sequence",
    participants: participants.map((id) => ({ id, type: "backend", label: id })),
    messages: messages.map((message, i) => ({ id: `m${i}`, label: "go", ...message })),
    phases,
  });
  if (!result.ok || !result.diagram.sequence) throw new Error("not a sequence");
  return result.diagram.sequence;
}

describe("SEQ-03 sequence layout", () => {
  test("a long message label widens only the gap it crosses", () => {
    // 40 characters at 12 px is 288 px, plus 28 px of room. Short boxes are 110 px wide, 142 px apart.
    const scene = layoutSequence(sequence(["a", "b", "c"], [{ from: "a", to: "b", label: "x".repeat(40) }, { from: "b", to: "c" }]), fixedAdvance);
    const [a, b, c] = scene.participants.map((participant) => participant.x);
    expect(b! - a!).toBeCloseTo(316);
    expect(c! - b!).toBeCloseTo(142);
  });

  test("a label across two gaps shares what it needs between them", () => {
    const scene = layoutSequence(sequence(["a", "b", "c"], [{ from: "c", to: "a", label: "x".repeat(60) }]), fixedAdvance);
    const [a, b, c] = scene.participants.map((participant) => participant.x);
    // 60 × 7.2 + 28 = 460, split evenly from 2 × 142.
    expect([b! - a!, c! - b!].map(Math.round)).toEqual([230, 230]);
  });

  test("a call activates its receiver until the receiver returns, and the caller from its first message to the end", () => {
    const scene = layoutSequence(
      sequence(["a", "b", "c"], [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "b", variant: "return" },
        { from: "b", to: "a", variant: "return" },
        { from: "a", to: "c", variant: "dashed" },
      ]),
      fixedAdvance,
    );
    const y = scene.messages.map((message) => message.points[0]!.y);
    const spans = scene.activations.map((activation) => [activation.participant, activation.depth, activation.rect.y + 6, activation.rect.y + activation.rect.h - 6]);
    const last = y[4]!;
    expect(spans).toEqual([
      [0, 0, y[0], last],
      [1, 0, y[0], y[3]],
      [2, 0, y[1], y[2]],
      [2, 0, y[4], last],
    ]);
  });

  test("a call that never returns keeps its receiver active only until the last message the receiver takes part in", () => {
    const scene = layoutSequence(
      sequence(["a", "b", "c"], [
        { from: "a", to: "b" },
        { from: "b", to: "c", variant: "dashed" },
        { from: "b", to: "a", variant: "return" },
        { from: "a", to: "b" },
        { from: "b", to: "a", variant: "return" },
      ]),
      fixedAdvance,
    );
    const y = scene.messages.map((message) => message.points[0]!.y);
    const c = scene.activations.filter((activation) => activation.participant === 2);
    expect(c.map((activation) => [activation.rect.y + 6, activation.rect.y + activation.rect.h - 6])).toEqual([[y[1], y[1]]]);
  });

  test("a second call before a return nests a second activation to the right of the first", () => {
    const scene = layoutSequence(
      sequence(["a", "b"], [
        { from: "a", to: "b" },
        { from: "a", to: "b" },
        { from: "b", to: "a", variant: "return" },
        { from: "b", to: "a", variant: "return" },
      ]),
      fixedAdvance,
    );
    const y = scene.messages.map((message) => message.points[0]!.y);
    const b = scene.activations.filter((activation) => activation.participant === 1);
    expect(b.map((activation) => [activation.depth, activation.rect.y + 6, activation.rect.y + activation.rect.h - 6])).toEqual([
      [0, y[0], y[3]],
      [1, y[1], y[2]],
    ]);
    expect(b[1]!.rect.x - b[0]!.rect.x).toBe(5);
    // The inner return leaves from the inner bar's left edge.
    expect(scene.messages[2]!.points[0]!.x).toBe(b[1]!.rect.x);
  });

  test("a call to itself loops right in one taller row, and its label after the loop widens the map", () => {
    const plain = layoutSequence(sequence(["a", "b"], [{ from: "a", to: "b" }, { from: "a", to: "b" }]), fixedAdvance);
    const looped = layoutSequence(sequence(["a", "b"], [{ from: "b", to: "b", label: "x".repeat(50) }, { from: "a", to: "b" }]), fixedAdvance);
    const rowOf = (scene: typeof plain): number => scene.messages[1]!.points[0]!.y - scene.messages[0]!.points[0]!.y;
    expect([rowOf(plain), rowOf(looped)]).toEqual([40, 60]);
    const loop = looped.messages[0]!;
    expect(loop.points).toHaveLength(4);
    expect(loop.points[1]!.x - loop.points[0]!.x).toBe(30);
    expect(loop.labelAnchor).toBe("start");
    expect(looped.bounds.w).toBeGreaterThanOrEqual(loop.labelAt.x + 50 * 7.2 + 40);
  });

  test("a phase band spans its messages, and its label's gutter moves the columns right", () => {
    const messages: Raw[] = [{ from: "a", to: "b" }, { from: "b", to: "a", variant: "return" }, { from: "a", to: "b" }];
    const without = layoutSequence(sequence(["a", "b"], messages), fixedAdvance);
    const scene = layoutSequence(sequence(["a", "b"], messages, [{ label: "Setup", first: "m0", last: "m1" }]), fixedAdvance);
    // "Setup" in bold 12 px is 36 px, plus 12 px either side.
    expect(scene.participants[0]!.x - without.participants[0]!.x).toBeCloseTo(60);
    const band = scene.phases[0]!.rect;
    const y = scene.messages.map((message) => message.points[0]!.y);
    expect(band.y).toBeLessThan(y[0]!);
    expect(band.y + band.h).toBeGreaterThan(y[1]!);
    expect(band.y + band.h).toBeLessThan(y[2]!);
  });
});
