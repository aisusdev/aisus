// SEQ-03: draws a laid-out sequence map as SVG. Participants are `.node` boxes like an
// architecture map's, so freshness, highlights and image export treat them the same, and each
// message is a `.message` group that opens its call site.
import { LABEL_PX, SUBLABEL_PX } from "@aisus/core/layout/measure";
import type { MeasureText } from "@aisus/core/layout/scene";
import { MESSAGE_PX, NOTE_PX, PHASE_PX, type SequenceScene } from "@aisus/core/layout/sequence";
import type { ViewSequence } from "@aisus/core/model/tolerant";
import { boxName } from "./a11y";
import { edgeGeometry } from "./render";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_RADIUS = 6;
const PHASE_RADIUS = 6;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  return el;
}

function textEl(className: string, content: string, x: number, y: number, sizePx: number, anchor: "start" | "middle"): SVGTextElement {
  const el = svgEl("text", { class: className, x, y, "font-size": sizePx, "text-anchor": anchor, "dominant-baseline": "central" });
  el.textContent = content;
  return el;
}

/**
 * Replaces the children of `content` with the sequence, in layers drawn in this order:
 * `g.phases`, `g.lifelines`, `g.activations`, `g.messages`, `g.nodes`.
 *
 * - Phase: `g.phase` > `rect.phase__band`, `text.phase__label`.
 * - Lifeline: `line.lifeline`. Activation: `rect.activation.activation--<type>`.
 * - Message: `g.message.edge.edge--<variant>[data-id][tabindex=0][role=button][aria-label]` >
 *   `path.message__hit`, `path.edge__line`, `path.edge__head`, `text.message__label`, optional `text.message__note`.
 * - Participant: `g.node.node--<type>[data-id][tabindex=0][role=button][aria-label]` > `rect.node__box`,
 *   `text.node__label`, optional `text.node__sublabel`.
 */
export function renderSequence(content: SVGGElement, sequence: ViewSequence, scene: SequenceScene, measure: MeasureText): void {
  const phases = svgEl("g", { class: "phases" });
  for (const phase of scene.phases) {
    const { x, y, w, h } = phase.rect;
    const g = svgEl("g", { class: "phase", "data-index": phase.index });
    g.append(svgEl("rect", { class: "phase__band", x, y, width: w, height: h, rx: PHASE_RADIUS }), textEl("phase__label", phase.label, phase.labelAt.x, phase.labelAt.y, PHASE_PX, "start"));
    phases.append(g);
  }

  const lifelines = svgEl("g", { class: "lifelines" });
  for (const line of scene.lifelines) lifelines.append(svgEl("line", { class: "lifeline", x1: line.x, y1: line.top, x2: line.x, y2: line.bottom }));

  const activations = svgEl("g", { class: "activations" });
  for (const activation of scene.activations) {
    const { x, y, w, h } = activation.rect;
    const type = scene.participants[activation.participant]!.type;
    activations.append(svgEl("rect", { class: `activation activation--${type}`, x, y, width: w, height: h }));
  }

  const messages = svgEl("g", { class: "messages" });
  for (const message of scene.messages) {
    const view = sequence.messages[message.index]!;
    const from = sequence.participants[view.from]!.label;
    const to = sequence.participants[view.to]!.label;
    const name = boxName({ id: view.id, label: view.label || view.id, sublabel: `${from} to ${to}`, type: "external", sources: view.sources });
    const g = svgEl("g", { class: `message edge edge--${message.variant}`, "data-id": message.id, "data-index": message.index, tabindex: 0, role: "button", "aria-label": name });
    const { line, head } = edgeGeometry(message.points);
    const path = message.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
    g.append(svgEl("path", { class: "message__hit", d: path }), svgEl("path", { class: "edge__line", d: line }), svgEl("path", { class: "edge__head", d: head }));
    g.append(textEl("message__label", message.label, message.labelAt.x, message.labelAt.y, MESSAGE_PX, message.labelAnchor));
    if (message.note && message.noteAt) g.append(textEl("message__note", message.note, message.noteAt.x, message.noteAt.y, NOTE_PX, message.labelAnchor));
    messages.append(g);
  }

  const nodes = svgEl("g", { class: "nodes" });
  for (const node of scene.participants) {
    const participant = sequence.participants[node.index]!;
    const { x, y, w, h } = node.rect;
    const g = svgEl("g", { class: `node node--${node.type}`, "data-id": node.id, "data-index": node.index, tabindex: 0, role: "button", "aria-label": boxName(participant) });
    g.append(svgEl("rect", { class: "node__box", x, y, width: w, height: h, rx: NODE_RADIUS }));
    const label = measure(participant.label, LABEL_PX, true);
    const sub = participant.sublabel ? measure(participant.sublabel, SUBLABEL_PX, false) : null;
    let top = y + h / 2 - (label.height + (sub?.height ?? 0)) / 2;
    g.append(textEl("node__label", participant.label, x + w / 2, top + label.height / 2, LABEL_PX, "middle"));
    top += label.height;
    if (sub) g.append(textEl("node__sublabel", participant.sublabel!, x + w / 2, top + sub.height / 2, SUBLABEL_PX, "middle"));
    nodes.append(g);
  }

  content.replaceChildren(phases, lifelines, activations, messages, nodes);
}
