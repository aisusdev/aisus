# The homepage

dennie approved this design for aisus.dev on 2026-11-02. It replaces the split hero and the story sections with one centred column. [site-style.md](site-style.md) has the shared tokens, and [landing-copy.md](landing-copy.md) has the words.

## Order

1. **Header.** The aisus icon sits before the wordmark. Features, Pricing and FAQ follow. Sign in, or Open cloud when signed in, and a pink Get Started close the row. The header has no bottom border. It sticks to the top and gains a soft shadow once the page scrolls. At phone width the links move into the menu and the brand and Get Started stay.
2. **Hero.** The headline "See your codebase as a map" is centred in Poppins SemiBold, with one line of subhead under it. Get Started (pink, filled) and Sign in (forest outline) sit side by side below.
3. **Works with.** The words "Works with" are followed by one row of seven tools: VS Code, Cursor, IntelliJ, Claude Code, Codex, Devin and GitHub. Each shows its official mark and its name, with nothing else.
4. **Features.** A VS Code window plays one demo at a time over a pale green glow (`#cfe6c0`, blurred). Under it, four pill tabs read Interactive diagram, Follow guided tour, Sequence diagram and /aisus-pr. The active pill is forest with a pink progress bar along its bottom edge. The tabs advance when the progress bar fills. A round button pauses and plays them. One sentence under the tabs describes the active feature.
5. **FAQ.** Six questions open one at a time. A plus turns into a cross when its answer shows.
6. **Footer.** It keeps the pale green paper and reaches the bottom of the window. The columns are the brand with its one-line description, then Product (Features, Get Started, Pricing, FAQ), Project (VS Code extension, GitHub, Privacy) and Follow (Instagram, YouTube). A last row holds the copyright and the line on third-party marks.

## Colour and type

The page background is white. The footer is `--paper-2`. Pink `#c92c6d` marks every action: the Get Started buttons, the active tab's progress and link hover. White text on pink has a contrast of 5.1:1. On forest, pink appears only as a filled button or bar, never as text. Headings use Poppins SemiBold, and body text keeps Avenir Next.

## The demos

The window copies VS Code's Light Modern theme. It has grey title, tab and status bars, a blue line on the active tab, Menlo for code and the editor's blue selection for cited lines. The map inside uses the colours the viewer takes from VS Code (`packages/viewer/hosts/vscode.ts`). Every file and line shown is real aisus code. A cursor moves and clicks, and a pink ring marks each click.

| Demo | What plays |
|---|---|
| Interactive diagram | A map of the aisus repository. Clicking Sidebar, then Viewer, then Core opens `generate.ts`, `tour.ts` and `check.ts` at their cited lines. An edit to line 104 of `check.ts` then marks Core edited. |
| Follow guided tour | Four stops: Sidebar, Core, Viewer and Cloud. The tour card shows each stop's explanation, citation and question. Show answer and Next are clicked, and the cited code opens beside the map. |
| Sequence diagram | The generate flow between Sidebar, Claude Code, the validator and the viewer. Its messages arrive in order. Clicking the validate message opens the line in the architecture skill. |
| /aisus-pr | The command is typed in the terminal and the agent reports each step. The diagram comment then lands on the pull request page. |

Each demo loops while its tab is active. A visitor who prefers reduced motion sees each demo's last frame without the cursor.
