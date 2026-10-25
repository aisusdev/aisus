// FRS-10: the comparison's header above the map and the Changes panel on its right. Repository text
// (labels, paths, commit subjects, run folders) goes in with `textContent` only.
import type { CommitRef } from "@aisus/core/model/comparison";
import type { ElementDiff, FieldChange } from "@aisus/core/model/diff";
import { relativeAge } from "@aisus/core/model/home";
import type { FileEntry } from "@aisus/core/model/lineage";
import type { Comparison, WebviewMessage } from "@aisus/core/model/messages";
import type { ViewConnection, ViewDiagram } from "@aisus/core/model/tolerant";

export type ElementKind = "box" | "arrow" | "boundary";

export interface ChangesHooks {
  post(message: WebviewMessage): void;
  /** Zooms to element `index` of `kind` in the shown map. */
  focus(kind: ElementKind, index: number): void;
  /** The Changes toggle was pressed. */
  toggle(on: boolean): void;
}

export const NO_CHANGES = "No changes since the earlier map.";
export const KEPT_NOTE = "Code changed, kept and Not in any component apply only when comparing with the map this one updated.";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el("button", className, text);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}

/** Changed fields: text fields as `label: “old” → “new”`, the others by name. */
export function formatFields(fields: readonly FieldChange[]): string {
  return fields.map((field) => ("before" in field ? `${field.field}: ${[field.before, field.after].map((value) => (value === null ? "(none)" : `“${value}”`)).join(" → ")}` : field.field)).join("; ");
}

/** `API → Database (reads)`, with each end named by its label. */
export function arrowName(arrow: ViewConnection, diagram: ViewDiagram): string {
  const labels = new Map(diagram.components.map((box) => [box.id, box.label]));
  const name = `${labels.get(arrow.from) ?? arrow.from} → ${labels.get(arrow.to) ?? arrow.to}`;
  return arrow.label ? `${name} (${arrow.label})` : name;
}

function fileName(file: FileEntry): string {
  return file.oldPath === undefined ? `${file.status} ${file.path}` : `${file.status} ${file.oldPath} → ${file.path}`;
}

function commitParts(commit: CommitRef | null, withAge: boolean, now: Date): (Node | string)[] {
  if (commit === null) return ["an unknown commit"];
  const parts: (Node | string)[] = [el("code", "compare__hash", commit.revision.slice(0, 7))];
  if (commit.subject !== null) parts.push(" ", el("span", "compare__subject", `“${commit.subject}”`));
  if (withAge && commit.committedAt !== null) parts.push(` · ${relativeAge(commit.committedAt, now)}`);
  return parts;
}

interface Row {
  kind: ElementKind;
  /** Into the shown map's list of `kind`; absent for removed rows. */
  index?: number;
  name: string;
  detail?: string;
}

/**
 * Draws the header into `header` and the panel into `panel`. Header: `div.compare__strip` with
 * the commits, `span.compare__counts`, `span.compare__approximate`, `button.compare__with` and
 * `button.compare__toggle[aria-pressed]`, then one `div.compare__warning[data-code]` per warning.
 * Panel: `h2.changes-panel__title` and one `section[data-section]` per non-empty section, whose
 * rows are `button.changes-panel__item` (or a `span` for removed elements).
 */
export class ChangesView {
  constructor(
    private readonly header: HTMLElement,
    private readonly panel: HTMLElement,
    private readonly hooks: ChangesHooks,
    private readonly now: () => Date = () => new Date(),
  ) {}

  show(diagram: ViewDiagram | undefined, comparison: Comparison | null): void {
    this.header.hidden = comparison === null || diagram === undefined;
    this.panel.hidden = comparison === null || diagram === undefined || !comparison.shown;
    if (comparison === null || diagram === undefined) {
      this.header.replaceChildren();
      this.panel.replaceChildren();
      return;
    }
    this.renderHeader(comparison);
    this.renderPanel(diagram, comparison);
  }

  private renderHeader(comparison: Comparison): void {
    const { context, diff } = comparison;
    const strip = el("div", "compare__strip");
    const commits = el("span", "compare__commits");
    if (context === undefined) commits.append(`Compared with ${comparison.against}`);
    else {
      commits.append("Compared with ", ...commitParts(context.baselineCommit, true, this.now()));
      const dirty = context.baselineCommit?.dirtyCount ?? 0;
      if (dirty > 0) commits.append(` and ${dirty} uncommitted file${dirty === 1 ? "" : "s"}`);
      commits.append(" → ", ...commitParts(context.currentCommit, false, this.now()));
    }
    strip.append(commits);
    const counts = el("span", "compare__counts");
    counts.append(el("span", "compare__count compare__count--added", `+${diff.counts.added}`), " ", el("span", "compare__count compare__count--removed", `−${diff.counts.removed}`), " ", el("span", "compare__count compare__count--changed", `~${diff.counts.changed}`));
    counts.title = `${diff.counts.added} added, ${diff.counts.removed} removed, ${diff.counts.changed} changed`;
    strip.append(counts);
    if (context?.approximate) strip.append(el("span", "compare__approximate", "approximate"));
    if (context !== undefined) strip.append(button("toolbar__button compare__with", "Compare with…", () => this.hooks.post({ type: "compareWith" })));
    const toggle = button("toolbar__button compare__toggle", "Changes", () => this.hooks.toggle(!comparison.shown));
    toggle.setAttribute("aria-pressed", String(comparison.shown));
    toggle.title = "Show the changes on the map";
    strip.append(toggle);
    const lines: HTMLElement[] = [strip];
    for (const warning of context?.warnings ?? []) {
      const line = el("div", "compare__warning", warning.message);
      line.setAttribute("data-code", warning.code);
      if (warning.code === "reversed") line.append(" ", button("toolbar__button compare__swap", "Swap", () => this.hooks.post({ type: "swap" })));
      lines.push(line);
    }
    this.header.replaceChildren(...lines);
  }

  private renderPanel(diagram: ViewDiagram, comparison: Comparison): void {
    const { diff, context, changes } = comparison;
    const title = el("h2", "changes-panel__title", "Changes");
    const body: HTMLElement[] = [title];
    if (diff.counts.added + diff.counts.removed + diff.counts.changed === 0) body.push(el("p", "changes-panel__empty", NO_CHANGES));
    const rows = (wanted: (entry: ElementDiff) => boolean): Row[] => [
      ...diff.boxes.flatMap((entry, index): Row[] => (wanted(entry) ? [{ kind: "box", index, name: diagram.components[index]!.label, detail: formatFields(entry.fields) }] : [])),
      ...diff.arrows.flatMap((entry, index): Row[] => (wanted(entry) && diagram.connections[index] ? [{ kind: "arrow", index, name: arrowName(diagram.connections[index]!, diagram), detail: formatFields(entry.fields) }] : [])),
      ...diff.boundaries.flatMap((entry, index): Row[] => (wanted(entry) && diagram.boundaries[index] ? [{ kind: "boundary", index, name: diagram.boundaries[index]!.label, detail: formatFields(entry.fields) }] : [])),
    ];
    this.section(body, "added", "Added", rows((entry) => entry.status === "added"));
    const removed = this.section(body, "removed", "Removed", [
      ...diff.removed.boxes.map((box): Row => ({ kind: "box", name: box.label })),
      ...diff.removed.arrows.map((arrow): Row => ({ kind: "arrow", name: arrow.name })),
      ...diff.removed.boundaries.map((boundary): Row => ({ kind: "boundary", name: boundary.label })),
    ]);
    if (removed !== null && context !== undefined) removed.append(button("toolbar__button changes-panel__baseline", "Open baseline", () => this.hooks.post({ type: "openBaseline" })));
    this.section(body, "changed", "Changed", rows((entry) => entry.status === "changed" || entry.status === "renamed"));
    if (context?.keptAvailable && changes !== undefined) {
      const files = new Map(changes.touched.map((box) => [box.id, box.files.length]));
      this.section(
        body,
        "kept",
        "Code changed, kept",
        diff.boxes.flatMap((entry, index): Row[] => {
          if (entry.status !== "kept") return [];
          const box = diagram.components[index]!;
          const count = files.get(box.id) ?? 0;
          return [{ kind: "box", index, name: box.label, detail: `${count} changed file${count === 1 ? "" : "s"}` }];
        }),
      );
      if (changes.uncited.length > 0) {
        const list = el("ul", "changes-panel__list");
        for (const file of changes.uncited) {
          const item = el("li", "changes-panel__row");
          if (file.status === "deleted") item.append(el("span", "changes-panel__item", fileName(file)));
          else {
            const open = button("changes-panel__item changes-panel__file", fileName(file), () => this.hooks.post({ type: "openFile", path: file.path }));
            open.setAttribute("data-path", file.path);
            item.append(open);
          }
          list.append(item);
        }
        body.push(this.wrap("uncited", "Not in any component", changes.uncited.length, list));
      }
    } else if (context?.keptNote) body.push(el("p", "changes-panel__note", KEPT_NOTE));
    this.panel.replaceChildren(...body);
  }

  private wrap(key: string, title: string, count: number, list: HTMLElement): HTMLElement {
    const section = el("section", "changes-panel__section");
    section.setAttribute("data-section", key);
    section.append(el("h3", "changes-panel__heading", `${title} (${count})`), list);
    return section;
  }

  /** Appends a section of `rows` to `body` unless it is empty; rows with an index zoom to their element. */
  private section(body: HTMLElement[], key: string, title: string, rows: Row[]): HTMLElement | null {
    if (rows.length === 0) return null;
    const list = el("ul", "changes-panel__list");
    for (const row of rows) {
      const item = el("li", "changes-panel__row");
      const index = row.index;
      const entry = index === undefined ? el("span", "changes-panel__item") : button("changes-panel__item", "", () => this.hooks.focus(row.kind, index));
      entry.setAttribute("data-kind", row.kind);
      if (index !== undefined) entry.setAttribute("data-index", String(index));
      entry.append(el("span", "changes-panel__kind", row.kind), " ", el("span", "changes-panel__name", row.name));
      if (row.detail) entry.append(" ", el("span", "changes-panel__fields", row.detail));
      item.append(entry);
      list.append(item);
    }
    const section = this.wrap(key, title, rows.length, list);
    body.push(section);
    return section;
  }
}
