// SEQ-01: the sequence schema and the checks it cannot express.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { validateSequence } from "@aisus/core/model/schema";
import { citedItems, sequenceChecks } from "@aisus/core/model/sequence";
import type { SequenceDoc } from "@aisus/core/model/types";

const EXAMPLE = "skills/aisus-sequence/references/example.json";

function example(): SequenceDoc {
  return JSON.parse(readFileSync(EXAMPLE, "utf8")) as SequenceDoc;
}

describe("SEQ-01 sequence schema", () => {
  test("the skill's example is a valid sequence map with no semantic issues", () => {
    expect(validateSequence(example())).toEqual([]);
    expect(sequenceChecks(example())).toEqual([]);
  });

  test("coordinates and a missing participant label are refused at their pointers", () => {
    const doc = example() as unknown as { messages: Record<string, unknown>[]; participants: Record<string, unknown>[] };
    doc.messages[0]!["y"] = 160;
    delete doc.participants[1]!["label"];
    const pointers = validateSequence(doc).map((issue) => issue.pointer);
    expect(pointers).toContain("/messages/0/y");
    expect(pointers).toContain("/participants/1");
  });
});

describe("SEQ-01 sequence checks", () => {
  test("a message id that repeats a participant id is a duplicate", () => {
    const doc = example();
    doc.messages[2]!.id = "seats";
    expect(sequenceChecks(doc)).toEqual([{ code: "DuplicateId", pointer: "/messages/2/id", message: "Duplicate id `seats` (first used at /participants/2)" }]);
  });

  test("unknown message ends and unknown phase messages are reported", () => {
    const doc = example();
    doc.messages[0]!.to = "gateway";
    doc.phases![0]!.last = "nowhere";
    expect(sequenceChecks(doc).map((issue) => [issue.code, issue.pointer])).toEqual([
      ["UnknownReference", "/messages/0/to"],
      ["UnknownReference", "/phases/0/last"],
    ]);
  });

  test("a call without sources is refused, and a return without them is not", () => {
    const doc = example();
    delete doc.messages[2]!.sources;
    delete doc.participants[0]!.sources;
    expect(sequenceChecks(doc).map((issue) => [issue.code, issue.pointer])).toEqual([
      ["MissingSources", "/messages/2"],
      ["MissingSources", "/participants/0"],
    ]);
  });

  test("a phase that ends before it starts, or overlaps another, is out of order", () => {
    const backwards = example();
    backwards.phases = [{ label: "Back", first: "held", last: "submit" }];
    expect(sequenceChecks(backwards).map((issue) => [issue.code, issue.pointer])).toEqual([["PhaseOrder", "/phases/0"]]);
    const overlapping = example();
    overlapping.phases![1]!.first = "held";
    expect(sequenceChecks(overlapping)).toEqual([{ code: "PhaseOrder", pointer: "/phases/1", message: "Phase `Pay and record` overlaps the phase at /phases/0" }]);
  });

  test("participants then messages are the cited items, each at its pointer", () => {
    const items = citedItems(example());
    expect(items.map((item) => item.pointer).slice(5, 7)).toEqual(["/participants/5", "/messages/0"]);
    expect(items.find((item) => item.id === "held")!.sources).toEqual([]);
  });
});
