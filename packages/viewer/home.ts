// The aisus sidebar's DOM (UI-01) is a header and a home page whose rows open the Ask, Review, Learn and
// Maps pages. It is built from the HomeState the host sends, and every string goes in as text.
// The composer's text box persists across states. Typing survives updates.
import { mapStatus, relativeAge, runFigures, tokenCount } from "@aisus/core/model/home";
import type { AskTurn, AskView, CloudMapItem, HomeState, HomeWebviewMessage, MapItem, PracticeQuestionView, PracticeView, ReviewView, RunCard } from "@aisus/core/model/messages";
import type { Grade } from "@aisus/core/model/practice";
import type { Check } from "@aisus/core/model/preflight";
import { renderAnswer, spanNode } from "./answer";

export type Post = (message: HomeWebviewMessage) => void;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== "") node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function section(title: string, className: string): HTMLElement {
  const node = el("section", `section ${className}`);
  if (title !== "") node.append(el("h2", "section__title", title));
  return node;
}

/** The home rows' icons: 16 px line drawings in the theme's text colour. */
const ICONS = {
  ask: ["M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"],
  review: ["M3.5 1.5h6l3 3v10h-9z", "M9.5 1.5v3h3", "M6 7.5h4M8 5.5v4M6 12h4"],
  learn: ["M8 1.5a4.5 4.5 0 0 0-2.5 8.2v1.8h5V9.7A4.5 4.5 0 0 0 8 1.5z", "M6 13.5h4"],
  hunt: ["M5.5 6.5a2.5 2.5 0 0 1 5 0v4a2.5 2.5 0 0 1-5 0z", "M8 7v6", "M2.5 7.5h3M10.5 7.5h3M2.5 11h3M10.5 11h3", "M6.5 4.3 5 2.5M9.5 4.3 11 2.5"],
  maps: ["M1.5 3.5l4-1.5 5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5z", "M5.5 2v10.5M10.5 3.5V14"],
} as const;

function icon(name: keyof typeof ICONS): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "row__icon");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ICONS[name]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

const STATUS_LABEL: Record<RunCard["status"], string> = { running: "Running", done: "Done", failed: "Failed", cancelled: "Cancelled" };
/** The Generate button once a run above `aisus.confirmAboveTokens` needs a second click (CST-03). */
const SECOND_CLICK = "Click again to generate";

/** SKL-01: the explain-back's scopes and what their buttons say. */
const PRACTICE_SCOPES = [
  ["branch", "This branch"],
  ["uncommitted", "Uncommitted changes"],
  ["box", "A box…"],
] as const;
const GRADE_LABEL: Record<Grade, string> = { correct: "Correct", partial: "Partial", wrong: "Wrong" };

/** "Validating, attempt 2" and the like, from run.json's phase. */
export function phaseLine(run: RunCard): string | null {
  switch (run.phase) {
    case null:
      return null;
    case "created":
      return "Run folder created";
    case "validating":
      return `Validating, attempt ${run.attempts}`;
    case "rejected":
      return `Rejected on attempt ${run.attempts}, repairing`;
    case "accepted":
      return run.attempts > 1 ? `Accepted on attempt ${run.attempts}` : "Accepted";
  }
}

/** The sidebar's pages: the home, and the pages its rows open, each with its title. */
export const PAGES = [
  ["home", "aisus"],
  ["ask", "Ask about the code"],
  ["review", "Review changes"],
  ["learn", "Check my understanding"],
  ["maps", "Maps"],
  ["settings", "Settings"],
] as const;
export type Page = (typeof PAGES)[number][0];

/** Where the chosen page is kept while the view is hidden. */
export interface PageStore {
  get(): Page | null;
  set(page: Page): void;
}

export interface Home {
  render(state: HomeState): void;
  /** Updates the running card's clock. */
  tick(): void;
}

/** Builds the sidebar in `container`. `now` gives the host's clock. */
export function createHome(container: HTMLElement, post: Post, now: () => Date = () => new Date(), store: PageStore | null = null): Home {
  const header = el("header", "header");
  const composer = el("div", "composer");
  const focus = el("textarea", "composer__focus");
  focus.rows = 2;
  focus.placeholder = "Focus (optional)";
  focus.setAttribute("aria-label", "Focus");
  const controls = el("div", "composer__controls");
  // CST-03: above the threshold the first click arms the button and the second sends the run.
  let generateArmed = false;
  const generate = button("Generate", "button button--primary composer__generate", () => {
    const confirm = current?.composer.confirm === true;
    if (confirm && !generateArmed) {
      generateArmed = true;
      generate.textContent = SECOND_CLICK;
      return;
    }
    generateArmed = false;
    generate.textContent = "Generate";
    post({ type: "generate", focus: focus.value, ...(confirm ? { confirmed: true } : {}) });
  });
  const notes = el("div", "composer__notes");
  // RCH-04: the same prompt, for an agent aisus does not launch.
  const copyPrompt = button("Copy prompt for…", "link composer__copy", () => post({ type: "copyPromptFor", focus: focus.value }));
  // SEQ-04: the same text names the flow a sequence map follows.
  const drawSequence = button("Draw a sequence map", "link composer__sequence", () => post({ type: "generateSequence", flow: focus.value }));
  composer.append(focus, controls, generate, copyPrompt, drawSequence, notes);
  focus.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !generate.disabled) generate.click();
  });
  const runSlot = el("div", "run-slot");
  const currentSlot = el("div", "current-slot");
  const attentionSlot = el("div", "attention-slot");
  const doSlot = el("div", "do-slot");
  const maps = el("div", "maps-slot");
  // The maps whose ⋯ row is open, kept across states.
  const expanded = new Set<string>();
  const newMap = section("New map", "new-map");
  const reviewSlot = el("div", "review-slot");
  const rulesSlot = el("div", "rules-slot");
  const hotspotsSlot = el("div", "hotspots-slot");
  const setup = section("", "setup");
  const settings = section("", "settings");
  settings.append(button("Open aisus settings", "link", () => post({ type: "openSettings" })));
  // SKL-01: rebuilt only when the practice view changes, so an answer being typed keeps its box.
  const practiceSlot = el("div", "practice-slot");
  let practiceKey = "";
  let practiceArmed: string | null = null;
  const drafts = new Map<string, string>();
  // UI-06: the Ask chat sits at the bottom; its text box persists like the composer's.
  const askSection = section("", "ask");
  const askTurns = el("div", "ask__turns");
  const askNote = el("p", "ask__note");
  const askEstimate = el("p", "ask__estimate");
  let askArmed = false;
  const question = el("textarea", "ask__question");
  question.rows = 2;
  question.placeholder = "Ask about this repository";
  question.setAttribute("aria-label", "Question");
  const askButtons = el("div", "ask__buttons");
  const askButton = button("Ask", "button button--primary", () => {
    if (question.value.trim() === "") return;
    const confirm = current?.ask.confirm === true;
    if (confirm && !askArmed) {
      askArmed = true;
      askButton.textContent = "Click again to ask";
      return;
    }
    askArmed = false;
    askButton.textContent = "Ask";
    post({ type: "ask", question: question.value, ...(confirm ? { confirmed: true } : {}) });
    question.value = "";
  });
  const stopButton = button("Stop", "button", () => post({ type: "cancelAsk" }));
  const clearButton = button("Clear", "link", () => post({ type: "clearAsk" }));
  askButtons.append(askButton, stopButton, clearButton);
  askSection.append(askTurns, askNote, question, askEstimate, askButtons);
  question.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !askButton.disabled) askButton.click();
  });
  // Each page keeps its elements between states. Every page but the home opens with a back button.
  const pages = new Map<Page, HTMLElement>();
  const backs = new Map<Page, HTMLButtonElement>();
  for (const [id, title] of PAGES) {
    const page = el("div", `page page--${id}`);
    page.id = `page-${id}`;
    if (id !== "home") {
      const back = button(title, "page__back", () => showPage("home", true));
      back.setAttribute("aria-label", `Back from ${title}`);
      backs.set(id, back);
      page.append(back);
    }
    pages.set(id, page);
  }
  pages.get("home")!.append(runSlot, currentSlot, attentionSlot, doSlot);
  pages.get("ask")!.append(askSection);
  pages.get("review")!.append(reviewSlot, rulesSlot, hotspotsSlot);
  pages.get("learn")!.append(practiceSlot);
  pages.get("maps")!.append(maps, newMap);
  pages.get("settings")!.append(setup, settings);
  container.append(header, ...pages.values());
  container.addEventListener("keydown", (event) => {
    const typing = event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement;
    if (event.key === "Escape" && selected !== "home" && !typing) showPage("home", true);
  });
  let selected: Page = "home";

  /** Shows `id`. With `moveFocus`, focus goes to the page's back button, or home to the row that opened the page. */
  function showPage(id: Page, moveFocus = false): void {
    const from = selected;
    selected = id;
    for (const [entry, page] of pages) page.hidden = entry !== id;
    store?.set(id);
    if (!moveFocus) return;
    if (id === "home") (from === "settings" ? header.querySelector<HTMLElement>(".header__status") : doSlot.querySelector<HTMLElement>(`[data-page="${from}"]`))?.focus();
    else backs.get(id)?.focus();
  }
  const stored = store?.get() ?? null;
  showPage(PAGES.some(([entry]) => entry === stored) && stored !== null ? stored : "home");

  let current: HomeState | null = null;
  let figures: HTMLElement | null = null;
  let doKey = "";

  function renderHeader(state: HomeState): void {
    header.replaceChildren();
    if (state.root === null) {
      header.append(el("p", "header__empty", "Open a folder to map it."));
      return;
    }
    if (state.folders.length > 1) {
      const picker = el("select", "header__folder");
      picker.setAttribute("aria-label", "Folder");
      for (const folder of state.folders) {
        const option = el("option", "", folder.name);
        option.value = folder.root;
        option.selected = folder.root === state.root;
        picker.append(option);
      }
      picker.addEventListener("change", () => post({ type: "pickFolder", root: picker.value }));
      header.append(picker);
    } else {
      header.append(el("div", "header__folder", state.folders[0]?.name ?? ""));
    }
    // Ask, Review, Explain back and Refresh all use the chosen agent, so it sits in the header.
    if (state.composer.agents.length === 0) {
      header.append(el("span", "composer__none", "No agent found."));
    } else {
      const agent = el("select", "composer__agent");
      agent.setAttribute("aria-label", "Agent");
      for (const entry of state.composer.agents) {
        const option = el("option", "", entry.label);
        option.value = entry.cli;
        option.selected = entry.cli === state.composer.agent;
        agent.append(option);
      }
      agent.addEventListener("change", () => post({ type: "setAgent", agent: agent.value === "codex" || agent.value === "devin" ? agent.value : "claude" }));
      header.append(agent);
    }
    // SET-02: the setup checks show as one dot. It opens the Settings page, which lists them.
    const status = state.setup === null ? "checking" : state.setup.every((check) => check.ok) ? "ok" : "fail";
    const dot = button("", `header__status header__status--${status}`, () => showPage("settings", true));
    const label = `Setup: ${status === "checking" ? "checking…" : status === "ok" ? "ready" : "needs attention"}`;
    dot.title = label;
    dot.setAttribute("aria-label", label);
    header.append(dot);
  }

  function renderComposer(state: HomeState): void {
    controls.replaceChildren();
    const running = state.run?.status === "running";
    focus.disabled = state.root === null;
    const mode = el("div", "toggle");
    mode.setAttribute("role", "group");
    mode.setAttribute("aria-label", "Run mode");
    for (const [value, label] of [["sidebar", "In sidebar"], ["terminal", "In terminal"]] as const) {
      const option = button(label, `toggle__option${state.composer.runMode === value ? " toggle__option--on" : ""}`, () => post({ type: "setRunMode", runMode: value }));
      option.setAttribute("aria-pressed", String(state.composer.runMode === value));
      mode.append(option);
    }
    controls.append(mode);
    generate.disabled = running || state.root === null || state.composer.agent === null;
    if (!state.composer.confirm) generateArmed = false;
    generate.textContent = running ? "Generating…" : generateArmed ? SECOND_CLICK : "Generate";
    notes.replaceChildren(...state.composer.notes.map((note) => el("p", "composer__note", note)));
  }

  function renderRun(run: RunCard | null): void {
    runSlot.replaceChildren();
    figures = null;
    if (run === null) return;
    const card = el("section", `section run run--${run.status}`);
    const top = el("div", "run__top");
    top.append(el("span", "run__agent", run.mode === "terminal" ? `${run.agent} in a terminal` : run.agent), el("span", `run__status run__status--${run.status}`, STATUS_LABEL[run.status]));
    card.append(top);
    if (run.focus !== "") card.append(el("div", "run__focus", run.focus));
    const phase = phaseLine(run);
    if (phase !== null) card.append(el("div", "run__phase", phase));
    if (run.estimate !== null) card.append(el("div", "run__estimate", run.estimate));
    figures = el("div", "run__figures", runFigures(run, now()));
    card.append(figures);
    if (run.feed.length > 0) {
      const feed = el("ol", "run__feed");
      for (const item of run.feed.slice(-12)) feed.append(el("li", `feed feed--${item.kind}`, item.text));
      card.append(feed);
    }
    if (run.denials.length > 0) {
      const denied = el("div", "run__denials");
      denied.append(el("p", "run__denials-title", "Refused"));
      const list = el("ul", "run__denial-list");
      for (const denial of run.denials) list.append(el("li", "", denial));
      denied.append(list, button("Run in terminal instead", "button", () => post({ type: "runInTerminal" })));
      card.append(denied);
    }
    if (run.status === "running") card.append(button("Cancel", "button run__cancel", () => post({ type: "cancelRun" })));
    runSlot.append(card);
  }

  /** SEQ-04: a sequence map opens, exports or goes, and counts its participants. */
  function sequenceEntry(item: MapItem): HTMLElement {
    const entry = el("li", "map map--sequence");
    const open = button(item.title ?? item.runFolder, "map__title", () => post({ type: "openMap", file: item.file }));
    open.title = item.runFolder;
    const meta = [
      item.agent,
      relativeAge(item.createdAt, now()),
      item.boxes === null ? null : `${item.boxes} participant${item.boxes === 1 ? "" : "s"}`,
      item.changed !== null && item.changed > 0 ? `${item.changed} changed` : null,
    ].filter((part): part is string => part !== null && part !== "");
    const actions = el("div", "map__actions");
    actions.append(button("Export page", "link", () => post({ type: "exportMap", file: item.file })), button("Delete", "link link--danger", () => post({ type: "deleteMap", file: item.file })));
    entry.append(open, el("div", "map__meta", meta.join(" · ")), actions);
    return entry;
  }

  /** CLD-16: a map from aisus cloud, which says where it comes from and opens when clicked. */
  function cloudEntry(item: CloudMapItem): HTMLElement {
    const entry = el("li", "map map--cloud");
    const open = button(item.title ?? item.runFolder, "map__title", () => post({ type: "openMap", file: item.file }));
    open.title = item.source;
    const meta = [item.source, relativeAge(item.createdAt, now()), item.boxes === null ? null : `${item.boxes} box${item.boxes === 1 ? "" : "es"}`].filter(
      (part): part is string => part !== null,
    );
    entry.append(open, el("div", "map__meta", meta.join(" · ")));
    return entry;
  }

  function mapEntry(item: MapItem): HTMLElement {
    const entry = el("li", "map");
    const open = button(item.title ?? item.runFolder, "map__title", () => post({ type: "openMap", file: item.file }));
    open.title = item.runFolder;
    const meta = [
      item.focus,
      item.agent,
      relativeAge(item.createdAt, now()),
      item.boxes === null ? null : `${item.boxes} box${item.boxes === 1 ? "" : "es"}`,
      item.changed !== null && item.changed > 0 ? `${item.changed} changed` : null,
    ].filter(
      (part): part is string => part !== null && part !== "",
    );
    // The title opens the map. The ⋯ button shows the rest of its actions in place.
    const actions = el("div", "map__actions");
    actions.id = `map-actions-${item.runFolder}`;
    actions.hidden = !expanded.has(item.file);
    actions.append(
      button("Refresh", "link", () => post({ type: "refreshMap", file: item.file })),
      button("Export page", "link", () => post({ type: "exportMap", file: item.file })),
      button("Create tour", "link", () => post({ type: "createTour", file: item.file })),
      ...(current?.cloud === true ? [button("Share to aisus cloud", "link", () => post({ type: "shareMap", file: item.file }))] : []),
      button("Delete", "link link--danger", () => post({ type: "deleteMap", file: item.file })),
    );
    const more = button("⋯", "map__more", () => {
      if (expanded.has(item.file)) expanded.delete(item.file);
      else expanded.add(item.file);
      actions.hidden = !expanded.has(item.file);
      more.setAttribute("aria-expanded", String(!actions.hidden));
    });
    more.setAttribute("aria-label", `More actions for ${item.title ?? item.runFolder}`);
    more.setAttribute("aria-controls", actions.id);
    more.setAttribute("aria-expanded", String(!actions.hidden));
    const top = el("div", "map__top");
    top.append(open, more);
    entry.append(top, el("div", "map__meta", meta.join(" · ")), actions);
    return entry;
  }

  /** The home's first card: the newest map with one filled button, or the composer when there is no map. */
  function renderCurrent(state: HomeState): void {
    currentSlot.replaceChildren();
    const newest = state.maps[0];
    if (newest === undefined) {
      const intro = section("Map this folder", "current current--empty");
      intro.append(composer);
      currentSlot.append(intro);
      return;
    }
    newMap.append(composer);
    const card = el("section", "current");
    const title = button(newest.title ?? newest.runFolder, "current__title", () => post({ type: "openMap", file: newest.file }));
    title.title = newest.runFolder;
    const changed = newest.changed ?? 0;
    const actions = el("div", "current__actions");
    if (changed > 0) {
      actions.append(
        button(`Refresh ${changed} box${changed === 1 ? "" : "es"}`, "button button--primary", () => post({ type: "refreshMap", file: newest.file })),
        button("Open", "button", () => post({ type: "openMap", file: newest.file })),
      );
    } else {
      actions.append(button("Open", "button button--primary", () => post({ type: "openMap", file: newest.file })));
    }
    card.append(title, el("div", `current__status${changed > 0 ? " current__status--changed" : ""}`, mapStatus(state.maps, now())), actions);
    currentSlot.append(card);
  }

  /** ARC-05: the Health lines that need a look, each opening its view. The map card already says what changed. */
  function renderAttention(state: HomeState): void {
    attentionSlot.replaceChildren();
    const items = (state.health ?? []).filter((item) => item.attention && item.kind !== "freshness");
    if (state.root === null || state.maps.length === 0 || items.length === 0) return;
    const block = section("Needs a look", "health");
    const list = el("ul", "rows health__list");
    for (const item of items) {
      const entry = el("li", "health__item health__item--attention");
      entry.append(button(item.text, "row health__open", () => post({ type: "openHealth", item: item.kind })));
      list.append(entry);
    }
    block.append(list);
    attentionSlot.append(block);
  }

  /** The home's list of what else there is to do. Each row opens its page, and Bug hunt starts or opens a session. */
  function renderDo(state: HomeState): void {
    const hasMap = state.maps.length > 0;
    const session = state.session;
    const hunt = session === null ? "" : `${session.phase[0]?.toUpperCase() ?? ""}${session.phase.slice(1)}${session.stepsTotal > 0 ? ` · Step ${Math.min(session.stepIndex + 1, session.stepsTotal)} of ${session.stepsTotal}` : ""} · Score ${session.score}`;
    // The rows are rebuilt only when they change, so a focused row keeps its focus across states.
    const mapCount = state.maps.length + state.sequences.length + state.cloudMaps.length;
    const key = JSON.stringify([state.root, hasMap && state.maps.length, mapCount, hunt]);
    if (key === doKey) return;
    doKey = key;
    doSlot.replaceChildren();
    if (state.root === null) return;
    const list = el("ul", "rows do");
    const row = (label: string, meta: string, onClick: () => void, page: Exclude<Page, "settings"> | null): void => {
      const entry = button("", page === null ? "row row--hunt" : "row", onClick);
      entry.append(icon(page === null || page === "home" ? "hunt" : page), el("span", "row__label", label));
      if (meta !== "") entry.append(el("span", page === null ? "row__meta learning__status" : "row__meta", meta));
      if (page !== null) entry.dataset["page"] = page;
      const item = el("li");
      item.append(entry);
      list.append(item);
    };
    const open = (page: Page) => () => showPage(page, true);
    const title = (page: Page): string => PAGES.find(([id]) => id === page)![1];
    row(title("ask"), "", open("ask"), "ask");
    if (hasMap) row(title("review"), "", open("review"), "review");
    row(title("learn"), "", open("learn"), "learn");
    row("Bug hunt", hunt, () => post(session === null ? { type: "startLearning" } : { type: "openSession" }), null);
    if (mapCount > 0) row(title("maps"), String(mapCount), open("maps"), "maps");
    doSlot.append(list);
  }

  function renderMaps(items: MapItem[], sequences: MapItem[], cloud: CloudMapItem[]): void {
    maps.replaceChildren();
    if (items.length > 0) {
      const list = section("", "maps");
      const entries = el("ul", "maps__list");
      for (const item of items) entries.append(mapEntry(item));
      list.append(entries);
      maps.append(list);
    }
    if (cloud.length > 0) {
      const list = section("aisus cloud", "maps maps--cloud");
      const entries = el("ul", "maps__list");
      for (const item of cloud) entries.append(cloudEntry(item));
      list.append(entries);
      maps.append(list);
    }
    if (sequences.length > 0) {
      const list = section("Sequence maps", "maps maps--sequence");
      const entries = el("ul", "maps__list");
      for (const item of sequences) entries.append(sequenceEntry(item));
      list.append(entries);
      maps.append(list);
    }
  }

  /** ARC-02: the Rules section, each rule with its violations and reason, and Suggest rules. */
  function renderRules(state: HomeState): void {
    rulesSlot.replaceChildren();
    if (state.root === null || state.rules === null || state.maps.length === 0) return;
    const block = section("Rules", "rules");
    if (state.rules.rules.length === 0) {
      block.append(el("p", "rules__empty", "No rules yet."));
    } else {
      const list = el("ul", "rules__list");
      for (const rule of state.rules.rules) {
        const entry = el("li", `rule${rule.violations > 0 ? " rule--broken" : ""}`);
        entry.append(el("div", "rule__id", `${rule.id} · ${rule.violations} violation${rule.violations === 1 ? "" : "s"}`), el("div", "rule__reason", rule.reason));
        list.append(entry);
      }
      block.append(list);
    }
    block.append(button("Suggest rules", "button", () => post({ type: "suggestRules" })));
    rulesSlot.append(block);
  }

  /** ARC-03: the five most changed boxes over the window. */
  function renderHotspots(state: HomeState): void {
    hotspotsSlot.replaceChildren();
    if (state.root === null || state.hotspots === null || state.maps.length === 0) return;
    const block = section(`Hotspots · ${state.hotspots.days} days`, "hotspots");
    if (state.hotspots.boxes.length === 0) block.append(el("p", "hotspots__empty", `No changes in ${state.hotspots.days} days.`));
    else {
      const list = el("ol", "hotspots__list");
      for (const box of state.hotspots.boxes) list.append(el("li", "hotspot", `${box.label} · ${box.commits} commit${box.commits === 1 ? "" : "s"} · ${box.lines} line${box.lines === 1 ? "" : "s"}`));
      block.append(list);
    }
    hotspotsSlot.append(block);
  }

  /** PRC-02: the Review changes section, with each new box candidate's actions. */
  function renderReview(state: HomeState): void {
    reviewSlot.replaceChildren();
    if (state.root === null || state.maps.length === 0) return;
    const block = section("", "review");
    block.append(button("Review changes…", "button", () => post({ type: "review" })));
    const review: ReviewView | null = state.review;
    if (review?.error) block.append(el("p", "review__error", review.error));
    if (review?.counts) {
      const { touched, stale, gone, uncovered, candidates, arrows } = review.counts;
      const newArrows = arrows > 0 ? ` · ${arrows} new arrow${arrows === 1 ? "" : "s"}` : "";
      block.append(
        el("p", "review__counts", `${review.scope}: ${touched} touched · ${stale} stale · ${gone} gone · ${uncovered} not on the map · ${candidates} new box candidate${candidates === 1 ? "" : "s"}${newArrows}`),
      );
      const list = el("ul", "review__candidates");
      for (const candidate of review.candidates) {
        const entry = el("li", "candidate");
        const actions = el("div", "map__actions");
        actions.append(
          button("Show files", "link", () => post({ type: "showFiles", dir: candidate.dir })),
          button("Add to map", "link", () => post({ type: "addToMap", dir: candidate.dir })),
          button("Ignore", "link", () => post({ type: "ignoreCandidate", dir: candidate.dir })),
        );
        entry.append(
          el("div", "candidate__dir", `${candidate.dir}/`),
          el("div", "map__meta", `${candidate.files.length} file${candidate.files.length === 1 ? "" : "s"} · ${candidate.lines} lines · suggested box: ${candidate.label}`),
          actions,
        );
        list.append(entry);
      }
      block.append(list);
      // PRC-03: a branch's own map, and refreshing it for what the review found.
      const branch = el("div", "map__actions review__branch");
      if (review.branchMap) branch.append(button("Compare with base map", "link", () => post({ type: "compareBase" })));
      if (review.canUpdate) branch.append(button("Update map for this branch", "link", () => post({ type: "updateBranchMap" })));
      if (branch.childElementCount > 0) block.append(branch);
    }
    reviewSlot.append(block);
  }

  function renderSetup(checks: Check[] | null): void {
    setup.replaceChildren(el("h2", "section__title", "Setup"));
    if (checks === null) {
      setup.append(el("p", "setup__pending", "Checking…"));
      return;
    }
    const list = el("ul", "checks");
    for (const check of checks) {
      const row = el("li", `check check--${check.ok ? "ok" : "fail"}`);
      row.dataset["check"] = check.id;
      row.append(el("span", "check__mark", check.ok ? "✓" : "✗"), el("span", "check__detail", check.detail));
      if (!check.ok && check.fix) row.append(button(check.fix.label, "link check__fix", () => post({ type: "fix", check: check.id })));
      list.append(row);
    }
    setup.append(list, button("Check again", "link setup__again", () => post({ type: "checkSetup" })));
  }


  function practiceQuestion(scope: string, entry: PracticeQuestionView, index: number, busy: boolean): HTMLElement {
    const item = el("li", `practice-question practice-question--${entry.status}`);
    item.append(el("div", "practice-question__text", entry.question));
    if (entry.status === "open" || entry.status === "failed") {
      const draftKey = `${scope}\n${index}\n${entry.question}`;
      const answer = el("textarea", "practice-question__answer");
      answer.rows = 3;
      answer.setAttribute("aria-label", `Your answer to question ${index + 1}`);
      answer.value = drafts.get(draftKey) ?? entry.answer ?? "";
      answer.addEventListener("input", () => drafts.set(draftKey, answer.value));
      const send = button("Answer", "button practice-question__send", () => {
        if (answer.value.trim() !== "") post({ type: "practiceAnswer", index, answer: answer.value });
      });
      send.disabled = busy;
      if (entry.error !== null) item.append(el("p", "practice-question__error", entry.error));
      item.append(answer, send);
      return item;
    }
    item.append(el("div", "practice-question__given", entry.answer ?? ""));
    if (entry.status === "grading") item.append(el("p", "practice-question__pending", "Grading…"));
    if (entry.grade !== null) {
      const grade = el("div", `practice-grade practice-grade--${entry.grade.grade}`);
      grade.append(el("span", "practice-grade__label", GRADE_LABEL[entry.grade.grade]), el("span", "practice-grade__reason", entry.grade.reason));
      if (entry.grade.cite !== null) grade.append(spanNode(entry.grade.cite, post));
      item.append(grade);
    }
    return item;
  }

  /** SKL-01: the Practice section, with the explain-back's scopes and the folder's latest check. */
  function renderPractice(root: string | null, view: PracticeView): void {
    const key = JSON.stringify([root, view]);
    if (key === practiceKey) return;
    practiceKey = key;
    practiceSlot.replaceChildren();
    if (root === null) return;
    const block = section("", "practice");
    const check = view.check;
    const busy = check !== null && (check.status === "running" || check.questions.some((entry) => entry.status === "grading"));
    if (!view.confirm) practiceArmed = null;
    const scopes = el("div", "practice__scopes");
    const buttons: HTMLButtonElement[] = [];
    for (const [scope, label] of PRACTICE_SCOPES) {
      const start = button(practiceArmed === scope ? "Click again to start" : label, "button", () => {
        if (view.confirm && practiceArmed !== scope) {
          practiceArmed = scope;
          PRACTICE_SCOPES.forEach(([, text], index) => (buttons[index]!.textContent = text));
          start.textContent = "Click again to start";
          return;
        }
        practiceArmed = null;
        start.textContent = label;
        post({ type: "practiceStart", scope, ...(view.confirm ? { confirmed: true } : {}) });
      });
      start.disabled = view.blocked !== null || busy;
      buttons.push(start);
      scopes.append(start);
    }
    block.append(scopes);
    if (view.blocked !== null) block.append(el("p", "practice__note", view.blocked));
    else if (view.estimate !== null) block.append(el("p", "practice__estimate", view.estimate));
    if (check !== null) {
      block.append(el("div", "practice__scope", check.scope));
      if (check.status === "running") block.append(el("p", "practice__pending", "Writing questions…"), button("Stop", "button", () => post({ type: "practiceCancel" })));
      if (check.error !== null) block.append(el("p", "practice__error", check.error));
      const list = el("ol", "practice__questions");
      check.questions.forEach((entry, index) => list.append(practiceQuestion(check.scope, entry, index, busy)));
      block.append(list);
      if (!busy) block.append(button("Clear", "link", () => post({ type: "practiceClear" })));
    }
    // SKL-03: the practice log, newest first, with dates.
    if (view.log.length > 0) {
      const log = el("ul", "practice-log");
      for (const entry of view.log) log.append(el("li", `practice-log__entry practice-log__entry--${entry.kind}`, `${entry.at.slice(0, 10)} · ${entry.title} · ${entry.detail}`));
      block.append(el("h3", "practice__subtitle", "Your practice"), log);
    }
    practiceSlot.append(block);
  }

  function askTurn(turn: AskTurn): HTMLElement {
    const entry = el("div", `turn turn--${turn.status}`);
    entry.append(el("div", "turn__question", turn.question));
    if (turn.blocks.length > 0) entry.append(renderAnswer(turn.blocks, post));
    else if (turn.status === "running") entry.append(el("p", "turn__pending", "Reading the map…"));
    if (turn.error !== null) entry.append(el("p", "turn__error", turn.error));
    const input = turn.usage.input + turn.usage.cacheRead + turn.usage.cacheWrite;
    const figures = [turn.agent];
    if (input + turn.usage.output > 0) figures.push(`${tokenCount(input)} in`, `${tokenCount(turn.usage.output)} out`);
    if (turn.costUsd !== null) figures.push(`$${turn.costUsd.toFixed(2)}`);
    if (turn.status === "cancelled") figures.push("stopped");
    entry.append(el("div", "turn__figures", figures.join(" · ")));
    return entry;
  }

  function renderAsk(ask: AskView): void {
    askTurns.replaceChildren(...ask.turns.map(askTurn));
    const running = ask.turns.at(-1)?.status === "running";
    askNote.textContent = ask.blocked ?? "";
    askNote.hidden = ask.blocked === null;
    askEstimate.textContent = ask.estimate ?? "";
    askEstimate.hidden = ask.estimate === null;
    if (!ask.confirm) askArmed = false;
    askButton.textContent = askArmed ? "Click again to ask" : "Ask";
    question.disabled = ask.blocked !== null;
    askButton.disabled = ask.blocked !== null || running;
    stopButton.hidden = !running;
    clearButton.hidden = running || ask.turns.length === 0;
  }

  return {
    render(state) {
      // Work that starts anywhere opens the page that shows it.
      const started = (was: boolean | undefined, now: boolean): boolean => now && was !== true;
      const prev = current;
      if (started(prev?.run?.status === "running", state.run?.status === "running")) showPage("home");
      else if (started(prev?.ask.turns.at(-1)?.status === "running", state.ask.turns.at(-1)?.status === "running")) showPage("ask");
      else if (started(prev?.practice.check?.status === "running", state.practice.check?.status === "running")) showPage("learn");
      current = state;
      renderHeader(state);
      if (state.root === null && selected !== "home") showPage("home");
      // A page that needs a map goes home when the last map goes.
      if ((state.maps.length === 0 && selected === "review") || (state.maps.length + state.sequences.length + state.cloudMaps.length === 0 && selected === "maps")) showPage("home");
      renderComposer(state);
      renderRun(state.run);
      renderCurrent(state);
      renderAttention(state);
      renderDo(state);
      renderMaps(state.maps, state.sequences, state.cloudMaps);
      renderReview(state);
      renderRules(state);
      renderHotspots(state);
      renderSetup(state.setup);
      renderPractice(state.root, state.practice);
      renderAsk(state.ask);
    },
    tick() {
      if (current?.run?.status === "running" && figures !== null) figures.textContent = runFigures(current.run, now());
    },
  };
}
