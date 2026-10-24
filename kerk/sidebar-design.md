# aisus sidebar: the recommended design

This design starts from the task-first tabs proposal, which had the highest judge totals: 48, against 43 for the overview cards and 32 for the conversation. It keeps one webview view, `aisus.home`, so the manifest's one-view test stays green and the build needs no go from you before it starts. From the overview proposal it takes the card layout, one filled button per tab, panels that keep their elements between updates, and a rich status bar tooltip. From the conversation proposal it takes the Source Control entries and a quiet live region. Where the judges disagreed, the choice went to whatever reads best at 300 px and reuses the messages that already exist.

## 1. The new sidebar

The sidebar is a header, a row of four tabs, and one panel per tab. It uses only `--vscode-*` tokens, works fully from the keyboard, and fits 300 px with no sideways scrolling.

**Header (above the tabs, on every tab)**

- **Row 1.** This holds the folder name, or the folder picker when the workspace has several folders. A long name is cut short with an ellipsis.
  - The agent dropdown sits on the right of this row. It moves here from the composer because Ask, Explain back, Refresh, Add to map and Update map for this branch all use the chosen agent.
  - The dropdown keeps its `.composer__agent` class.
  - With no agent on PATH, the dropdown becomes a "No agent found" button that opens Setup on the Map tab.
- **Row 2.** This is the map status, "Map from 2 days ago · 16 boxes · 3 changed", or "No map yet". While a run goes, it becomes a button, "Generating · Validating, attempt 2 · 1:32", that opens the run card on the Map tab.
- **Row 3.** This row appears only when a setup check fails. It is a line in the warning colour, "1 setup check failed · Show", that opens Setup. It stays visible on every tab.
- **No folder.** With no folder open there are no tabs, only "Open a folder to map it." and an Open Folder… button.
- **Live region.** One hidden polite live region announces only "Run accepted: 16 boxes", "Run failed", "Answer ready" and "Review ready". Screen readers never hear streamed tokens or the ticking clock.

**Tab strip: Map, Ask, Review, Learn**

- **Look.** The strip sticks to the top when the panel scrolls. It is styled like VS Code's own Problems, Output and Terminal tabs, using `--vscode-panelTitle-activeForeground`, `--vscode-panelTitle-activeBorder` and `--vscode-panelTitle-inactiveForeground`. Badges use `--vscode-badge-*`.
- **Keyboard.** It follows the WAI-ARIA tabs pattern: a roving tabindex, the Left, Right, Home and End keys, and a tab that activates when it gets focus.
- **Badges.** Each badge has hidden text for screen readers.
  - Map shows a dot while a run goes, and otherwise the number of changed boxes.
  - Ask shows a dot while an answer streams.
  - Review shows how many of its Health lines need a look, which means uncovered changed lines and broken rules (0 to 2). Changed boxes are counted only on Map, so the same news never shows twice.
  - Learn shows how many explain-back questions are waiting for an answer, read out as "Explain-back: 1 of 3 answered", and a dot while a bug hunt runs.
- **Memory.** `vscode.getState` and `setState` keep the selected tab, each tab's scroll position, the open disclosures and the drafts (focus, question and answers). They survive the view being hidden.
- **Switching from the host.** The host can switch tabs with a `showTab` message. If the webview is not ready yet, the message waits until it is. A state update never changes the tab or moves focus.

**Map tab**

This is the home tab and the place first run lands, because the map plus click-into-code is the product's one validated signal. It holds everything that makes or updates a map, top to bottom:

1. **Run card.** It shows while a run goes or until it is dismissed. It holds:
   - the agent and mode, the status, the focus and the phase;
   - the estimate the run started with, and the live figures;
   - the last 3 feed lines, with a "Show all (12)" toggle;
   - any refusals, with Run in terminal instead;
   - Cancel while the run goes, and a new Dismiss once it has finished.
2. **Current map card.** This is the newest map, the same one the header describes.
   - Its headline is the freshness sentence, "3 of 16 boxes changed since the map." or "Every box matches its code."
   - Its title opens the map. Its meta line gives the focus, agent, age and box count.
   - Its main action is "Refresh 3 changed boxes" when boxes changed, and Open otherwise. The other action shows as a link.
   - A "⋯" button opens a row in place with Export page, Create tour and Delete…. Delete still asks first in a modal.
   - The ⋯ row stays in the DOM and posts the existing `exportMap`, `createTour` and `deleteMap` messages, so it needs no host menu and no new message. Right-click menus on map rows are left for later, because each one would need a new hidden command that takes a map.
3. **Older maps (n).** This list is collapsed by default. Each row has its title (which opens the map), its meta line and a ⋯ with Refresh, Export page, Create tour and Delete….
4. **New map.** This is open when no map exists and collapsed otherwise. It holds the composer:
   - the focus box, where Ctrl/⌘+Enter generates;
   - Generate at full width, with CST-03's second click above the cost threshold;
   - the notes line (skill install or repair, the data note and the estimate);
   - Copy prompt for….
5. **Runs: In sidebar · In terminal.** This one-line toggle sits under New map, outside it. It is there because Refresh, Create tour, Add to map and Map This Box in Detail follow the same `aisus.runMode` setting as Generate.
6. **Setup.** This disclosure sits at the foot and reads "Setup · ready", "Setup · checking…" or "Setup · needs attention". It holds each check, a fix for each failing one, and Check again. Its placement depends on what fails:
   - It opens by itself whenever a check fails.
   - It moves to the top of the tab only when Generate cannot run, which means Node or the chosen agent is missing.
   - A missing skill, which Generate installs anyway, leaves it at the foot.

**Ask tab**

A chat needs the full height with its input pinned at the bottom. Mixed into a long scroll, it scrolled out of sight.

- **Turns.** Each turn is the question, the streamed answer with checked file:line links and box links, and its figures (agent, tokens in and out, cost, and "stopped" if it was stopped).
- **Empty state.** It says "Ask your agent about this repository. It reads the map first and cites the lines it uses." It offers up to three starter questions, such as "How does payments work?", taken from the busiest boxes in `HomeState.hotspots`. A starter fills the box and never sends.
- **Footer.** The footer is pinned to the bottom and holds:
  - the question box, where Ctrl/⌘+Enter asks;
  - the estimate or the blocked note;
  - Ask, with its second click above the threshold;
  - Stop while an answer streams, and Clear when there is history.

  The footer stops sticking when the panel is under 360 px tall.
- **No map.** Without a map, the tab shows the existing text, "Generate a map first. Ask uses it as the guide.", and a Go to Map button.

**Review tab**

This is the architecture job. Everything here checks a change or the structure against the map at zero tokens, except Update map for this branch.

1. **Health.** These are the four ARC-05 lines. The ones that need a look are in the warning colour, and each opens its view. Under the hotspot line, a "Top 5" disclosure lists ARC-03's five busiest boxes with their commits and lines. Each row focuses its box on the map through the existing `focusBox` message.
2. **Review changes.** This holds:
   - Review changes…, with its native scope picker;
   - the counts line or the error;
   - each new box candidate, with Show files, Add to map and Ignore;
   - Compare with base map and Update map for this branch, when they apply.
3. **Rules.** This disclosure reads "Rules · 4 · 1 broken". It opens by itself when a rule breaks. It holds each rule with its violations and reason, the empty text, and Suggest rules.

Without a map, the tab shows "Generate a map first. Review compares changes with it." and Go to Map. That empty state avoids the `.review` and `.rules` classes, so the existing "section is left out" tests still hold.

**Learn tab**

This is the skill job, and it is the one tab that works fully before a map exists. Work in progress comes first:

1. **Bug-hunt card.** While a session runs, it shows the phase, "Step k of n", the score and Open session.
2. **Explain back.** This holds:
   - the intro line and the three scopes, This branch, Uncommitted changes and A box…, with the second click;
   - the estimate or the blocked note;
   - the questions with their answer boxes, which keep their drafts;
   - the grades with their reasons and code links;
   - Stop while the agent writes, and Clear.
3. **Bug hunt.** One line says what a bug hunt is, followed by Start learning session. Both are hidden while a session runs.
4. **Tour for the newest map.** Play tour shows when the map has a `tour.json`. It opens the map, waits for the map panel to be ready, then plays. Otherwise the button is Create tour. Without a map, it says "Tours need a map."
5. **Your practice.** This disclosure holds the SKL-03 log of hunts, explain-backs and tours, with dates.

**Around the sidebar**

- **Sidebar title bar.** No change: Cancel Run while running, then Refresh and Check Setup, with the same overflow menu. Check Setup now also opens Setup on the Map tab.
- **Map panel title bar.** The overflow (group `z_aisus`) gains three items, because all three work on the shown map:
  - Ask About This Map, a new command (`aisus.askAboutMap`) that opens the Ask tab with the cursor in the question box;
  - Review Changes;
  - Suggest Rules.
- **Source Control title bar.** Review Changes becomes an icon there, and Check My Understanding goes in its overflow menu. Each runs the existing command and then opens its tab.
- **Status bar.**
  - **Text.** It keeps its three texts.
  - **Click.** A click opens the tab that fits: generating opens the run card, "3 changed" opens Map, and idle opens the last tab used.
  - **Tooltip.** The tooltip lists the Health lines that need a look, or "Map matches the code", plus the last run's figures.
  - **Refresh link.** In the changed state, the tooltip also has a Refresh link. The link is trusted for `aisus.refreshArchitecture` only. It shows only while the map panel shows a map, so it can never fall back to a full Generate.

**Rules for every tab**

- **One filled button per tab.** A pure, unit-tested function in `src/model/home.ts` picks it.
  - Map, in order of priority: the fix for a check that stops Generate; then Run in terminal instead after a refusal; then Refresh N changed boxes; then Generate when there is no map; then Open.
  - Ask: Ask.
  - Review: Review changes….
  - Learn: the first open question's Answer, or Open session while a hunt runs.

  The pick depends only on the setup results, the run status, the changed boxes and whether a map exists. It never depends on line counts that move on every save, so the button stays put without a timer.
- **Panels keep their elements.** Each panel and section keeps its element and is rebuilt only when its part of HomeState changes. This extends the `practiceKey` pattern used today. A new state arrives on every save of a cited file, and this is what keeps focus, a half-typed answer and a screen reader's place.

## 2. First run and every day

**First run.** With a folder that has no map, the header reads "my-repo" with "Claude Code" on the right and "No map yet" below.

- **What the Map tab shows.** The Map tab is selected, and New map is the only open part:
  - a heading, "Map this folder";
  - one sentence: "Your agent reads the code and draws its architecture. Each box opens the code it describes.";
  - the focus box and a full-width filled Generate;
  - the notes line, which says what this click also does: install the skill, the data note, the estimate.
- **Below that.** Copy prompt for…, the Runs toggle and Setup follow. On a fresh install, Setup is open and shows the skill check that Generate is about to fix. Only a missing Node or agent moves Setup to the top and gives its fix the filled style.
- **Generating.** One click on Generate starts the run (SET-03). The run card appears at the top of the Map tab, the header line becomes "Generating · 0:42", and the Map tab shows a dot.
- **Acceptance.** The live region says "Run accepted: 16 boxes", the map opens beside the editor, and the current map card replaces New map.
- **The other tabs before a map.** Ask and Review say they need a map and offer Go to Map. Learn already works, with explain-back on the branch or uncommitted changes and with bug hunts.

**Every day.**

- **Returning.** A returning user gets the tab they used last, with their drafts and open disclosures as they left them. The header reads "my-repo · Claude Code" and "Map from 2 days ago · 16 boxes · 3 changed".
- **Map tab.** It leads with "3 of 16 boxes changed since the map." and a filled "Refresh 3 changed boxes". The composer stays folded until they want a focused map.
- **Status bar.** Hovering it shows the same Health lines without opening the sidebar. Clicking "aisus: 3 changed" lands on the Map tab.
- **Questions.** They go to the Ask tab, or to Ask About This Map on the map's title bar. The input waits at the bottom, and answers stream in with file:line links.
- **Before a pull request.** The Review badge already says 2. Review Changes, from the Source Control title bar or the Review tab, lists new box candidates with Add to map. Rules opens by itself when a rule breaks.
- **Before merging.** Check My Understanding, from Source Control or the Learn tab's This branch, runs an explain-back.
- **Work started elsewhere.** It lands on its own tab. Map This Box in Detail and Add to map open the Map tab with the run card, and Check My Understanding on a box opens Learn.

## 3. What moves out of the sidebar

Nothing you can do today leaves the sidebar, and nothing moves into the Command Palette. Some actions gain native entry points outside the sidebar, and the single scroll is split into tabs.

**New native entry points outside the sidebar:**
- Review Changes becomes an icon in the Source Control title bar, and Check My Understanding goes in its overflow menu. Developers are already there when they look at a change.
- Ask About This Map (new), Review Changes and Suggest Rules join the map panel's title-bar overflow menu.
- The status bar tooltip carries the Health lines that need a look, the last run's figures and a Refresh link. A click opens the matching tab instead of only focusing the view.

**Moved out of the single scroll, within the sidebar:**
- The agent dropdown moves from the composer to the header.
- The run-mode toggle moves from the composer to the Runs line on the Map tab.
- The composer moves into the New map disclosure, which is folded once a map exists.
- The maps list splits into the current map card and Older maps. Export page, Create tour and Delete go behind each map's ⋯. Open and Refresh stay inline on the current map.
- The setup checklist becomes a disclosure at the foot of the Map tab. A warning line in the header appears when a check fails.
- Health, Review changes and Rules move to the Review tab. Rules becomes a disclosure that opens itself when a rule breaks.
- The five-box Hotspots list moves under Health's hotspot line as Top 5. Colouring the map stays on the map's Show Hotspots button.
- Practice, the learning session and the practice log move to the Learn tab. The log goes into Your practice, and Play tour for the newest map is new there.
- Ask moves to its own tab with a pinned input.
- The run card moves to the top of the Map tab, and the header line acts as its summary and link on every tab.

**Left out on purpose:**
- A host QuickPick behind More…, replaced by the ⋯ row that stays in the page.
- A second webview view.
- Slash commands and Enter-to-send. Ctrl/⌘+Enter stays.
- The practice streak, which the spec does not define.

## 4. What changes

| Where | Change | Size |
|---|---|---|
| `webview/home.ts` | This file becomes the shell. It builds the header with the ticking run line, the warning line, the no-folder state and the live region. It also wires the tab strip, keeps each panel's element and rebuild key, and hands each panel's content to the files below. | +200 / -420 LoC |
| `webview/tabs.ts` (new) | This is an accessible tab list with roles, `aria-selected`, `aria-controls`, a roving tabindex, the arrow, Home and End keys, and badges with hidden text. Selecting a tab never takes focus on a state update. | +90 LoC |
| `webview/homeMap.ts` (new) | This is the Map tab. It holds the run card (moved, plus Dismiss and Show all), the current map card with its freshness headline and ⋯ row, Older maps, New map with the composer (moved), the Runs toggle (moved), and Setup (moved, rising to the top when Generate cannot run). | +250 LoC, about 160 moved |
| `webview/homeAsk.ts` (new) | This is the Ask tab. It holds the turns (moved), the starters that fill the box without sending, the pinned footer that stops sticking under 360 px of height, and the no-map state with Go to Map. | +130 LoC, about 70 moved |
| `webview/homeReview.ts` (new) | This is the Review tab. It holds Health (moved) with the Top 5 disclosure, whose rows post `focusBox`. It also holds Review changes (moved), the Rules disclosure with its count line, and the no-map state. | +170 LoC, about 120 moved |
| `webview/homeLearn.ts` (new) | This is the Learn tab. It holds the bug-hunt card, Explain back (moved, with its drafts kept), Bug hunt, Play tour or Create tour for the newest map, and the Your practice disclosure. | +200 LoC, about 110 moved |
| `webview/sidebar.ts` | It stores the tab, scroll positions, open disclosures and drafts with `getState` and `setState`. It handles `showTab`, including putting focus in the composer, the question box or Setup. | +45 LoC |
| `webview/sidebar.css` | It adds a header that wraps at 300 px with names cut short, the sticky tab strip in panel-tab tokens, badges, the map card, the warning line, the pinned Ask footer, the disclosure headings and the ⋯ row. A reduced-motion guard covers the running dot. | +220 / -60 LoC |
| `src/model/messages.ts` | It adds `HomeTab`, the host message `showTab` with an optional focus target, the webview messages `dismissRun`, `playTour` and `openFolder`, and `MapItem.tour`. | +20 LoC |
| `src/model/home.ts` | It adds pure helpers: `tabBadges`, `statusTab`, `primaryAction(state, tab)` and the tooltip lines. `SIDEBAR_ACTIONS` gains `playTour`. | +70 LoC |
| `src/extension/home.ts` | It adds `reveal(tab, focus)`, which holds the tab until the webview is ready. It handles `dismissRun`, `playTour` and `openFolder`, sets the tour flag in `mapsOf`, and shares the Health lines with the status bar. | +70 LoC |
| `src/extension/panel.ts` | It adds a ready promise, so Play tour from the sidebar waits for a newly opened map to listen and to have its tour. | +15 LoC |
| `src/extension/statusBar.ts` | The click runs the internal `aisus.home.reveal` with the tab from `statusTab`. The tooltip becomes a MarkdownString with the Health lines, the last run's figures and the trusted Refresh link in the changed state. | +45 LoC |
| `src/extension/extension.ts`, `review.ts`, `practice.ts` | They register `aisus.home.reveal`, which is internal and not contributed, and `aisus.askAboutMap`. Review Changes, Check My Understanding (replacing its plain focus call), Check Setup and runs started elsewhere open their tab. | +35 LoC |
| `package.json` | It contributes `aisus.askAboutMap` and puts it, Review Changes and Suggest Rules in the map's `z_aisus` overflow. It adds Review Changes as an icon and Check My Understanding in the overflow to `scm/title`, and gives Review Changes an icon. | +30 LoC |
| `test/dom/sidebar.test.ts` | Existing tests select their tab first. Hidden panels stay in the page, so most queries hold. The no-folder test now checks the Open Folder… button and that no tabs exist. New tests cover the tab keys, badges and their text, `showTab` with focus, each empty state, the ⋯ row, Dismiss, starters that do not send, the header run line, the filled button per state, focus kept across a state, and the stored-state round trip. | +240 / -40 LoC |
| `test/unit/home.test.ts`, `test/unit/manifest.test.ts` | They test `tabBadges`, `statusTab` and `primaryAction`. The "each sidebar action is a button" scan reads every `webview/home*.ts` file. The new menu entries are checked, and the exact one-view check stays as it is. | +70 LoC |
| `test/e2e` (single-folder suite) | Clicking the status bar while generating opens the Map tab. Review Changes lands on Review, and Ask About This Map puts focus in the question box. Play tour on a newly opened map plays its first stop. | +45 LoC |
| `docs/spec-v0.3.md`, `README.md`, `docs/progress-v0.3.md` | UI-01's top-to-bottom list becomes the header and four tabs, UI-04 gains the tab-aware click, and UI-06 names the Ask tab. ARC-03's five boxes are described under Health's hotspot line. The README's "Where to find it" rows list the tabs, the Source Control entries and Ask About This Map. A progress-log entry records each divergence. | +50 / -20 LoC |
| Manual check | The layout is checked at 300 px wide and 360 px tall in Dark+, Light+ and High Contrast, with a keyboard and with a screen reader, because happy-dom cannot measure layout. | none |
| Total | This is about 2,000 lines added and 540 removed, of which about 460 are moved. It needs no new dependency, view or bundle. | about 3 to 4 days |

## 5. Open choices

1. **Ask as a tab, or as its own view.** A separate `aisus.ask` view could be dragged into the secondary side bar, as other agent chats can. It would need a second bundle, a second provider, and a spec change away from one view. I recommend shipping Ask as a tab in this change. `homeAsk.ts` stays self-contained, so splitting it out later is a small change if you want it after using the tabs.
2. **The IntelliJ Home tab.** The Swing `HomePanel.kt` keeps its single scroll, so the two IDEs will look more different. I recommend leaving IntelliJ as it is for this change, describing each IDE in the README and recording the difference in the progress log. The four tabs can be ported to IntelliJ once the VS Code layout has settled.