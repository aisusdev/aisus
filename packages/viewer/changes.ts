// FRS-10: the comparison's header above the map and the Changes panel on its right. The header shows
// the two commits as chips and the counts as pills. The panel shows a card per change, filtered by
// status. Repository text (labels, paths, commit subjects, run folders) goes in with `textContent` only.
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
  return file.oldPath === undefined ? file.path : `${file.oldPath} → ${file.path}`;
}

/** A commit chip's text: `abcdef1 · Add cache · 2 days ago`. */
function commitChip(commit: CommitRef | null, withAge: boolean, now: Date, role: string): HTMLElement {
  const chip = el("span", "compare__commit");
  chip.setAttribute("data-role", role);
  if (commit === null) {
    chip.append("an unknown commit");
    return chip;
  }
  chip.append(el("code", "compare__hash", commit.revision.slice(0, 7)));
  if (commit.subject !== null) chip.append(" · ", el("span", "compare__subject", commit.subject));
  if (withAge && commit.committedAt !== null) chip.append(" · ", el("span", "compare__age", relativeAge(commit.committedAt, now)));
  return chip;
}

/** The statuses a card can carry, in the panel's order. */
type CardStatus = "added" | "removed" | "changed" | "renamed" | "kept";
type Filter = "all" | "added" | "removed" | "changed" | "kept";

const BADGES: Record<CardStatus, string> = { added: "Added", removed: "Removed", changed: "Changed", renamed: "Renamed", kept: "Kept" };
const TABS: { filter: Filter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "added", label: "Added" },
  { filter: "removed", label: "Removed" },
  { filter: "changed", label: "Changed" },
  { filter: "kept", label: "Kept" },
];

interface Card {
  kind: ElementKind;
  status: CardStatus;
  /** Into the shown map's list of `kind`; absent for removed cards. */
  index?: number;
  name: string;
  /** A line under the kind, such as `1 changed file`. */
  detail?: string;
  fields?: readonly FieldChange[];
}

/** The tab a card shows under: renamed counts as changed. */
function filterOf(status: CardStatus): Filter {
  return status === "renamed" ? "changed" : status;
}

/** A field's name in the before and after table. */
function fieldName(field: FieldChange["field"]): string {
  return field === "sources" ? "cited files" : field;
}

function fieldTable(fields: readonly FieldChange[]): HTMLElement {
  const table = el("table", "change-card__table");
  const head = el("tr", "");
  for (const text of ["Property", "Before", "After"]) head.append(el("th", "", text));
  table.append(el("thead", ""), el("tbody", ""));
  table.tHead!.append(head);
  for (const field of fields) {
    const row = el("tr", "change-card__field");
    row.setAttribute("data-field", field.field);
    row.append(el("td", "", fieldName(field.field)));
    if ("before" in field) row.append(el("td", "change-card__before", field.before ?? "(none)"), el("td", "change-card__after", field.after ?? "(none)"));
    else {
      const cell = el("td", "change-card__after", "changed");
      cell.colSpan = 2;
      row.append(cell);
    }
    table.tBodies[0]!.append(row);
  }
  return table;
}

/**
 * Draws the header into `header` and the panel into `panel`. Header: `div.compare__strip` with
 * `span.compare__commits` (a `span.compare__commit[data-role]` per commit), `span.compare__counts`
 * (a `span.compare__count` pill per status), `span.compare__approximate`, `button.compare__with`,
 * `button.compare__swap` and `button.compare__toggle[role=switch][aria-checked]`, then one
 * `div.compare__warning[data-code]` per warning. Panel: `h2.changes-panel__title`, a tab list of
 * `button.changes-panel__tab[data-filter]`, a `li.change-card[data-status][data-kind]` per change
 * and `details.changes-panel__uncited` for the changed files outside any box.
 */
export class ChangesView {
  private filter: Filter = "all";
  private last: { diagram: ViewDiagram; comparison: Comparison } | null = null;

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
      this.last = null;
      this.filter = "all";
      this.header.replaceChildren();
      this.panel.replaceChildren();
      return;
    }
    this.last = { diagram, comparison };
    this.renderHeader(comparison);
    this.renderPanel(diagram, comparison);
  }

  private renderHeader(comparison: Comparison): void {
    const { context, diff } = comparison;
    const strip = el("div", "compare__strip");
    const commits = el("span", "compare__commits");
    if (context === undefined) commits.append(el("span", "compare__commit", `Compared with ${comparison.against}`));
    else {
      const baseline = commitChip(context.baselineCommit, true, this.now(), "baseline");
      const dirty = context.baselineCommit?.dirtyCount ?? 0;
      if (dirty > 0) baseline.append(" ", el("span", "compare__dirty", `+ ${dirty} uncommitted file${dirty === 1 ? "" : "s"}`));
      baseline.title = "The earlier map";
      const current = commitChip(context.currentCommit, false, this.now(), "current");
      current.title = "The shown map";
      commits.append(baseline, el("span", "compare__arrow", "→"), current);
    }
    strip.append(commits);
    const counts = el("span", "compare__counts");
    counts.append(
      el("span", "compare__count compare__count--added", `+${diff.counts.added} added`),
      el("span", "compare__count compare__count--removed", `−${diff.counts.removed} removed`),
      el("span", "compare__count compare__count--changed", `~${diff.counts.changed} changed`),
    );
    strip.append(counts);
    if (context?.approximate) {
      const approximate = el("span", "compare__approximate", "approximate");
      approximate.title = "A full drawing lies between the two maps, so boxes were paired by their cited files.";
      strip.append(approximate);
    }
    const actions = el("span", "compare__actions");
    if (context !== undefined) {
      actions.append(button("toolbar__button compare__with", "Compare with…", () => this.hooks.post({ type: "compareWith" })));
      const swap = button("toolbar__button compare__swap", "Swap", () => this.hooks.post({ type: "swap" }));
      swap.title = "Show the earlier map, compared with this one";
      actions.append(swap);
    }
    const toggle = button("compare__toggle", "Changes", () => this.hooks.toggle(!comparison.shown));
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(comparison.shown));
    toggle.title = "Show the changes on the map";
    toggle.append(el("span", "compare__switch"));
    actions.append(toggle);
    strip.append(actions);
    const lines: HTMLElement[] = [strip];
    for (const warning of context?.warnings ?? []) {
      const line = el("div", "compare__warning", warning.message);
      line.setAttribute("data-code", warning.code);
      lines.push(line);
    }
    this.header.replaceChildren(...lines);
  }

  private cards(diagram: ViewDiagram, comparison: Comparison): Card[] {
    const { diff, context, changes } = comparison;
    const shown = (wanted: (status: ElementDiff["status"]) => boolean): Card[] => [
      ...diff.boxes.flatMap((entry, index): Card[] => (wanted(entry.status) ? [{ kind: "box", status: entry.status as CardStatus, index, name: diagram.components[index]!.label, fields: entry.fields }] : [])),
      ...diff.arrows.flatMap((entry, index): Card[] => (wanted(entry.status) && diagram.connections[index] ? [{ kind: "arrow", status: entry.status as CardStatus, index, name: arrowName(diagram.connections[index]!, diagram), fields: entry.fields }] : [])),
      ...diff.boundaries.flatMap((entry, index): Card[] => (wanted(entry.status) && diagram.boundaries[index] ? [{ kind: "boundary", status: entry.status as CardStatus, index, name: diagram.boundaries[index]!.label, fields: entry.fields }] : [])),
    ];
    const cards: Card[] = [
      ...shown((status) => status === "added"),
      ...diff.removed.boxes.map((box): Card => ({ kind: "box", status: "removed", name: box.label })),
      ...diff.removed.arrows.map((arrow): Card => ({ kind: "arrow", status: "removed", name: arrow.name })),
      ...diff.removed.boundaries.map((boundary): Card => ({ kind: "boundary", status: "removed", name: boundary.label })),
      ...shown((status) => status === "changed" || status === "renamed"),
    ];
    if (context?.keptAvailable && changes !== undefined) {
      const files = new Map(changes.touched.map((box) => [box.id, box.files.length]));
      for (const card of shown((status) => status === "kept")) {
        const count = files.get(diagram.components[card.index!]!.id) ?? 0;
        cards.push({ ...card, fields: [], detail: `${count} changed file${count === 1 ? "" : "s"}` });
      }
    }
    return cards;
  }

  private renderPanel(diagram: ViewDiagram, comparison: Comparison): void {
    const { diff, context, changes } = comparison;
    const body: HTMLElement[] = [el("h2", "changes-panel__title", "Changes")];
    const cards = this.cards(diagram, comparison);
    if (diff.counts.added + diff.counts.removed + diff.counts.changed === 0) body.push(el("p", "changes-panel__empty", NO_CHANGES));
    const counts = new Map<Filter, number>([["all", cards.length]]);
    for (const card of cards) counts.set(filterOf(card.status), (counts.get(filterOf(card.status)) ?? 0) + 1);
    if (!counts.has(this.filter)) this.filter = "all";
    if (cards.length > 0) {
      const tabs = el("div", "changes-panel__tabs");
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Show changes");
      for (const tab of TABS) {
        const count = counts.get(tab.filter);
        if (count === undefined) continue;
        const item = button("changes-panel__tab", tab.label, () => this.setFilter(tab.filter));
        if (tab.filter !== "all") item.append(" ", el("span", "changes-panel__tab-count", String(count)));
        item.setAttribute("role", "tab");
        item.setAttribute("data-filter", tab.filter);
        item.setAttribute("aria-selected", String(tab.filter === this.filter));
        tabs.append(item);
      }
      body.push(tabs);
      const list = el("ul", "changes-panel__list");
      for (const card of cards) if (this.filter === "all" || filterOf(card.status) === this.filter) list.append(this.card(card, context !== undefined));
      body.push(list);
    }
    if (context?.keptAvailable && changes !== undefined && changes.uncited.length > 0 && this.filter === "all") {
      const uncited = el("details", "changes-panel__uncited");
      uncited.open = true;
      const count = changes.uncited.length;
      uncited.append(el("summary", "changes-panel__uncited-title", `${count} changed file${count === 1 ? "" : "s"} outside any box`));
      const files = el("ul", "changes-panel__files");
      for (const file of changes.uncited) {
        const item = el("li", "changes-panel__file-row");
        const name = file.status === "deleted" ? el("span", "changes-panel__file", fileName(file)) : button("changes-panel__file", fileName(file), () => this.hooks.post({ type: "openFile", path: file.path }));
        if (file.status !== "deleted") name.setAttribute("data-path", file.path);
        item.append(name, " ", el("span", `changes-panel__file-status changes-panel__file-status--${file.status}`, `(${file.status})`));
        files.append(item);
      }
      uncited.append(files);
      body.push(uncited);
    } else if (!context?.keptAvailable && context?.keptNote) body.push(el("p", "changes-panel__note", KEPT_NOTE));
    this.panel.replaceChildren(...body);
  }

  private setFilter(filter: Filter): void {
    this.filter = filter;
    if (this.last !== null) this.renderPanel(this.last.diagram, this.last.comparison);
    this.panel.querySelector<HTMLButtonElement>(`.changes-panel__tab[data-filter="${filter}"]`)?.focus();
  }

  /** One card. A card with an index zooms to its element; a removed card offers the baseline. */
  private card(card: Card, withBaseline: boolean): HTMLElement {
    const item = el("li", `change-card change-card--${card.status}`);
    item.setAttribute("data-status", card.status);
    item.setAttribute("data-kind", card.kind);
    const index = card.index;
    const main = index === undefined ? el("div", "change-card__main") : button("change-card__main", "", () => this.hooks.focus(card.kind, index));
    if (index !== undefined) main.setAttribute("data-index", String(index));
    const text = el("span", "change-card__text");
    text.append(el("span", "change-card__name", card.name), el("span", "change-card__kind", card.kind));
    if (card.detail !== undefined) text.append(el("span", "change-card__detail", card.detail));
    main.append(el("span", `change-card__icon change-card__icon--${card.kind}`), text, el("span", "change-card__badge", BADGES[card.status]));
    item.append(main);
    if (card.fields !== undefined && card.fields.length > 0) item.append(fieldTable(card.fields));
    if (card.status === "removed" && withBaseline) item.append(button("change-card__baseline", "Open in baseline", () => this.hooks.post({ type: "openBaseline" })));
    return item;
  }
}
