// PRC-07: a pull request's diagram as one standalone SVG document, drawn without a DOM so aisus
// cloud can draw it in Node each time the image is asked for. It shows the boxes the change marks,
// their neighbours and the arrows between them, in the site's light palette, with a legend. The
// marks come from the pull request's check on the main map, or else from the boxes' tags
// `changed` and `new` in a map drawn for instructions. The output holds no script, no foreign
// content and no external reference, and the same input always gives the same text.
import type { DeltaReport } from "../model/delta";
import type { ViewComponent, ViewConnection, ViewDiagram } from "../model/tolerant";
import { labelAnchor } from "./edges";
import { layoutDiagram } from "./layout";
import { LABEL_PX, SUBLABEL_PX, TAG_PX } from "./measure";
import type { MeasureText, Point, Rect, RunElk } from "./scene";

/** Display pixels per map unit, so the smallest text, the tag line, shows at 16 px. */
const SCALE = 16 / TAG_PX;
const LEGEND_H = 40;
const BADGE = { w: 34, h: 16 };

const COLOR = {
  paper: "#f7f9f4",
  ink: "#182a22",
  ink2: "#4f6055",
  line: "#cad1c6",
  box: "#fffef9",
  changed: "#c8ef72",
  uses: "#eef5df",
  forest: "#142b22",
  leaf: "#477646",
};
const FONT = "Avenir Next, Helvetica Neue, Arial, sans-serif";

type Mark = "changed" | "uses" | "new";

/**
 * A fixed advance per character, since Node has no canvas: 0.6 em, or 1 em for wide scripts such
 * as Japanese and Korean, which keeps every label inside its box.
 */
export const fixedMeasure: MeasureText = (text, sizePx) => ({
  width: [...text].reduce((sum, ch) => sum + (ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.6), 0) * sizePx,
  height: 1.32 * sizePx,
});

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The diagram to draw: the marked boxes, their neighbours, any new boxes, and the marks of each. */
function changeView(diagram: ViewDiagram, check: DeltaReport | null): { view: ViewDiagram; marks: Map<string, Mark>; newArrows: Set<number> } {
  const marks = new Map<string, Mark>();
  const extra: ViewComponent[] = [];
  const arrows: { from: string; to: string }[] = [];
  if (check !== null) {
    for (const box of check.touched.weak) marks.set(box.id, "uses");
    for (const box of check.touched.strong) marks.set(box.id, "changed");
    check.candidates.forEach((candidate, index) => {
      extra.push({ id: `candidate:${index}`, label: candidate.label, sublabel: `${candidate.dir}/`, type: "external", sources: [] });
      marks.set(`candidate:${index}`, "new");
    });
    arrows.push(...check.arrows.map((arrow) => ({ from: arrow.from.id, to: arrow.to.id })).filter((arrow) => diagram.components.some((c) => c.id === arrow.from) && diagram.components.some((c) => c.id === arrow.to)));
  } else {
    for (const component of diagram.components) {
      if (component.tag === "changed" || component.tag === "new") marks.set(component.id, component.tag);
    }
  }
  const known = new Set(diagram.components.map((component) => component.id));
  const touched = new Set([...marks.keys()].filter((id) => known.has(id)));
  const shown = new Set([...touched, ...arrows.flatMap((arrow) => [arrow.from, arrow.to])]);
  for (const connection of diagram.connections) {
    if (touched.has(connection.from)) shown.add(connection.to);
    if (touched.has(connection.to)) shown.add(connection.from);
  }
  const all = shown.size === 0 && extra.length === 0;
  const keep = (id: string): boolean => all || shown.has(id);
  // Positions are left out, so the drawing is always laid out afresh around what it shows.
  const components = [...diagram.components.filter((component) => keep(component.id)), ...extra].map((component) => {
    const { pos: _pos, size: _size, row: _row, col: _col, tag, ...rest } = component;
    // A tag that only marks the change is drawn as the mark, not as a line of text.
    return tag === undefined || (marks.has(component.id) && (tag === "changed" || tag === "new")) ? rest : { ...rest, tag };
  });
  const connections: ViewConnection[] = diagram.connections.filter((c) => keep(c.from) && keep(c.to));
  const newArrows = new Set<number>();
  for (const arrow of arrows) {
    if (!keep(arrow.from) || !keep(arrow.to)) continue;
    newArrows.add(connections.length);
    connections.push({ from: arrow.from, to: arrow.to, variant: "dashed" });
  }
  const boundaries = diagram.boundaries.map((b) => ({ ...b, wraps: b.wraps.filter(keep) })).filter((b) => b.wraps.length > 0);
  return { view: { components, connections, boundaries }, marks, newArrows };
}

function text(x: number, y: number, size: number, fill: string, content: string, extra = ""): string {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${fill}"${extra}>${esc(content)}</text>`;
}

function path(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${n(p.x)} ${n(p.y)}`).join(" ");
}

function node(component: ViewComponent, rect: Rect, mark: Mark | undefined, measure: MeasureText): string {
  const fill = mark === "changed" ? COLOR.changed : mark === "uses" ? COLOR.uses : mark === "new" ? "#ffffff" : COLOR.box;
  const stroke = mark === "changed" ? COLOR.forest : mark ? COLOR.leaf : COLOR.line;
  const parts = [
    `<rect x="${n(rect.x)}" y="${n(rect.y)}" width="${n(rect.w)}" height="${n(rect.h)}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${mark === "changed" ? 2 : 1.5}"${mark === "new" ? ' stroke-dasharray="6 4"' : ""}/>`,
  ];
  const lines: [string, number, boolean, string][] = [[component.label, LABEL_PX, true, COLOR.ink]];
  if (component.sublabel) lines.push([component.sublabel, SUBLABEL_PX, false, COLOR.ink2]);
  if (component.tag) lines.push([component.tag, TAG_PX, false, COLOR.ink2]);
  const heights = lines.map(([content, size, bold]) => measure(content, size, bold).height);
  let y = rect.y + (rect.h - heights.reduce((a, b) => a + b, 0)) / 2;
  lines.forEach(([content, size, bold, fillColor], i) => {
    y += heights[i]!;
    parts.push(text(rect.x + rect.w / 2, y - heights[i]! * 0.28, size, fillColor, content, ` text-anchor="middle"${bold ? ' font-weight="700"' : ""}`));
  });
  if (mark === "new") {
    const bx = rect.x + rect.w - BADGE.w - 6;
    const by = rect.y - BADGE.h / 2;
    parts.push(`<rect x="${n(bx)}" y="${n(by)}" width="${BADGE.w}" height="${BADGE.h}" rx="2" fill="${COLOR.leaf}"/>`);
    parts.push(text(bx + BADGE.w / 2, by + 12, TAG_PX, "#ffffff", "NEW", ' text-anchor="middle" font-weight="700"'));
  }
  return parts.join("");
}

/** The legend row: one swatch and name per mark, and the wordmark at the right. Returns its width too. */
function legend(x: number, y: number, right: number | null, measure: MeasureText): { svg: string; width: number } {
  const items: [string, string][] = [
    ["changed", "Changed"],
    ["uses", "Uses changed code"],
    ["new", "New"],
    ["arrow", "New import"],
  ];
  const parts: string[] = [];
  let at = x;
  const mid = y + LEGEND_H / 2;
  for (const [kind, name] of items) {
    if (kind === "arrow") {
      parts.push(`<path d="M${n(at)} ${n(mid)} L${n(at + 20)} ${n(mid)}" stroke="${COLOR.leaf}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    } else {
      const fill = kind === "changed" ? COLOR.changed : kind === "uses" ? COLOR.uses : "#ffffff";
      const stroke = kind === "changed" ? COLOR.forest : COLOR.leaf;
      parts.push(`<rect x="${n(at)}" y="${n(mid - 7)}" width="20" height="14" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${kind === "new" ? ' stroke-dasharray="4 3"' : ""}/>`);
    }
    parts.push(text(at + 26, mid + 4, TAG_PX, COLOR.ink, name));
    at += 26 + measure(name, TAG_PX, false).width + 16;
  }
  const mark = measure("aisus", TAG_PX, true).width;
  const width = at - x + 16 + mark;
  parts.push(text(right ?? x + width, mid + 4, TAG_PX, COLOR.ink2, "aisus", ' text-anchor="end" font-weight="700"'));
  return { svg: parts.join(""), width };
}

/**
 * PRC-07: draws `diagram` as an SVG document of what a pull request changed. With `check`, the
 * marks are the check's touched boxes, new box candidates and new imports; without it, the boxes
 * tagged `changed` or `new`. Draws the whole map when nothing is marked.
 */
export async function changeSvg(diagram: ViewDiagram, check: DeltaReport | null, run: RunElk): Promise<string> {
  if (diagram.sequence) throw new Error("a pull request's diagram is an architecture map");
  const { view, marks, newArrows } = changeView(diagram, check);
  const measure = fixedMeasure;
  const scene = await layoutDiagram(view, { measure, viewport: { width: 1200, height: 800 }, run });
  const { bounds } = scene;
  const key = legend(0, 0, null, measure);
  const width = Math.max(bounds.w, key.width + 80);
  const height = bounds.h + LEGEND_H;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(bounds.x)} ${n(bounds.y)} ${n(width)} ${n(height)}" width="${Math.ceil(width * SCALE)}" height="${Math.ceil(height * SCALE)}" font-family="${FONT}" role="img" aria-label="Diagram of a pull request's changes">`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COLOR.forest}"/></marker><marker id="arrow-new" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COLOR.leaf}"/></marker></defs>`,
    `<rect x="${n(bounds.x)}" y="${n(bounds.y)}" width="${n(width)}" height="${n(height)}" fill="${COLOR.paper}"/>`,
  ];
  for (const boundary of scene.boundaries) {
    const { x, y, w, h } = boundary.rect;
    parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="6" fill="none" stroke="${COLOR.line}" stroke-width="1.5" stroke-dasharray="6 4"/>`);
    if (boundary.label) parts.push(text(x + 10, y + 16, TAG_PX, COLOR.ink2, boundary.label));
  }
  for (const edge of scene.edges) {
    const isNew = newArrows.has(edge.index);
    const dashed = isNew || edge.variant === "dashed";
    parts.push(`<path d="${path(edge.points)}" fill="none" stroke="${isNew ? COLOR.leaf : COLOR.forest}" stroke-width="1.5"${dashed ? ' stroke-dasharray="6 4"' : ""} marker-end="url(#${isNew ? "arrow-new" : "arrow"})"/>`);
    const label = isNew ? "new import" : edge.label;
    const at = isNew ? labelAnchor(edge.points) : edge.labelAt;
    if (label && at) parts.push(text(at.x, at.y + 4, TAG_PX, COLOR.ink2, label, ` text-anchor="middle" stroke="${COLOR.paper}" stroke-width="7" stroke-linejoin="round" paint-order="stroke"`));
  }
  for (const sceneNode of scene.nodes) {
    const component = view.components[sceneNode.index]!;
    parts.push(node(component, sceneNode.rect, marks.get(component.id), measure));
  }
  const y = bounds.y + bounds.h - 8;
  const x = bounds.x + 40;
  parts.push(legend(x, y, bounds.x + width - 40, measure).svg);
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}
