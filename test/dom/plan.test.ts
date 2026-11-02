// PLN-01: a plan map draws its new boxes dashed and its removed boxes faded. Other maps draw tags as badges only.
import { expect, test } from "vitest";
import { parseDiagram } from "@aisus/core/model/tolerant";
import { renderScene } from "@aisus/viewer/render";
import { fixedMeasure, gridScene } from "./support/scene";

const SVG_NS = "http://www.w3.org/2000/svg";

function classesOf(run: string): Record<string, string> {
  const result = parseDiagram(
    JSON.stringify({
      schema_version: 1,
      diagram_type: "architecture",
      meta: { title: "Invoice export", output: `.aisus/maps/${run}/invoice-export.html` },
      components: [
        { id: "api", type: "backend", label: "Handles requests", tag: "changed", sources: [{ path: "src/api.ts", line: 1 }] },
        { id: "pdf", type: "backend", label: "Renders PDFs", tag: "new", sources: [{ path: `.aisus/maps/${run}/spec.md`, line: 3 }] },
        { id: "csv", type: "backend", label: "Writes CSV", tag: "removed", sources: [{ path: "src/csv.ts", line: 1 }] },
      ],
    }),
  );
  if (!result.ok) throw new Error(result.reason);
  const content = document.createElementNS(SVG_NS, "g");
  renderScene(content, result.diagram, gridScene(result.diagram), fixedMeasure);
  return Object.fromEntries([...content.querySelectorAll(".node")].map((node) => [node.getAttribute("data-id")!, node.getAttribute("class")!]));
}

test("PLN-01 a plan map marks its new boxes planned and its removed boxes removed", () => {
  const classes = classesOf("plan-invoice-export-20261102-100000");
  expect(classes["pdf"]).toContain("node--planned");
  expect(classes["csv"]).toContain("node--removed");
  expect(classes["api"]).toBe("node node--backend");
});

test("PLN-01 a map from any other run folder marks no box planned or removed", () => {
  const classes = classesOf("architecture-pr-20261102-100000");
  expect(Object.values(classes)).toEqual(["node node--backend", "node node--backend", "node node--backend"]);
});
