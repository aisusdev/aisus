// The guide from installation to a first map: install aisus, prepare an agent, generate a map.
import { AgentTabs, PanelTabs, SkillCommand } from "../../../components/GuideTabs";
import { CodeBlock } from "../../../components/CodeBlock";
import { GeneratePicture, VsixPicture } from "../../../components/GuidePictures";
import { GuideTree } from "../../../components/GuideTree";
import { docTree } from "../../../lib/docs";
import { releasesRepo } from "../../../lib/install";

// Change both together whenever the guide's steps change.
const UPDATED = "2026-11-02";
const UPDATED_TEXT = "2 November 2026";

const MARKETPLACE = "https://marketplace.visualstudio.com/items?itemName=aisus.aisus";

const SUBSTEPS = [
  { href: "#marketplace", label: "Install from the Marketplace" },
  { href: "#vsix", label: "Install from a VSIX" },
  { href: "#agent-cli", label: "Install your agent" },
  { href: "#skills", label: "Install the skills" },
  { href: "#generate-vscode", label: "Generate in VS Code" },
  { href: "#generate-skill", label: "Generate with the skill" },
];

function ExtensionsKeys() {
  return (
    <>
      <kbd>⌘</kbd><kbd>⇧</kbd><kbd>X</kbd> on macOS, or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on Windows and Linux
    </>
  );
}

export default function GetStartedPage() {
  const repo = releasesRepo();
  return (
    <main className="guide-page">
      <div className="wrap guide-layout">
        <GuideTree current="/get-started" docs={docTree()} />
        <article className="guide-article">
          <header className="guide-intro" id="top-of-guide">
            <h1>Get Started</h1>
            <p className="guide-updated">Last updated <time dateTime={UPDATED}>{UPDATED_TEXT}</time></p>
          </header>

          <section id="install">
            <h2><span className="guide-step">1</span>Installation</h2>
            <p>Install the extension in VS Code from the Marketplace, or from a VSIX file in any VS Code-based editor.</p>
            <PanelTabs
              label="Ways to install"
              tabs={[
                {
                  id: "marketplace",
                  name: "VS Code Marketplace",
                  content: (
                    <>
                      <ol className="steps">
                        <li>Open the <b>Extensions</b> view with <ExtensionsKeys />.</li>
                        <li>Search for <b>aisus</b>.</li>
                        <li>Press <b>Install</b>.</li>
                      </ol>
                      <p>To install from a terminal instead, run this command. <a href={MARKETPLACE}>View on Marketplace ↗</a></p>
                      <CodeBlock code="code --install-extension aisus.aisus" label="the install command" language="shell" />
                    </>
                  ),
                },
                {
                  id: "vsix",
                  name: "VSIX",
                  content: (
                    <>
                      <div className="steps-with-picture">
                        <ol className="steps">
                          <li>Download the VSIX file.<a className="btn btn-primary steps-button" href="/install" data-umami-event="install">Download the VSIX</a></li>
                          <li>In the <b>Extensions</b> view, open the <b>⋯</b> menu at its top.</li>
                          <li>Choose <b>Install from VSIX…</b> and pick the file you downloaded.</li>
                        </ol>
                        <VsixPicture />
                      </div>
                      <p>Cursor and other VS Code-based editors install aisus this way.</p>
                    </>
                  ),
                },
              ]}
            />
          </section>

          <section id="agent">
            <h2><span className="guide-step">2</span>Prepare your agent</h2>
            <p id="agent-cli">aisus asks the coding agent you already use to draw the map. Install its command-line tool. It needs Node.js 18 or newer.</p>
            <AgentTabs
              panels={{
                "Claude Code": (
                  <>
                    <p>Install Claude Code, then run <code>claude</code> once in a terminal to sign in.</p>
                    <CodeBlock code="npm install -g @anthropic-ai/claude-code" label="the Claude Code install command" language="shell" />
                  </>
                ),
                Codex: (
                  <>
                    <p>Install Codex, then run <code>codex</code> once in a terminal to sign in.</p>
                    <CodeBlock code="npm install -g @openai/codex" label="the Codex install command" language="shell" />
                  </>
                ),
                Devin: (
                  <p>Devin&apos;s command-line tool installs from its own guide. <a href="https://docs.devin.ai/cli">Open Devin&apos;s install guide ↗</a></p>
                ),
              }}
            />
            <p>The aisus sidebar&apos;s setup checklist names anything still missing.</p>
            <h3 id="skills">Prefer the skills alone?</h3>
            <p>Add the aisus skills to your repository, and run them from your agent without the extension.</p>
            <CodeBlock code={`npx skills add ${repo}`} label="the skills command" language="shell" />
          </section>

          <section id="generate">
            <h2><span className="guide-step">3</span>Generate a map</h2>
            <h3 id="generate-vscode">In VS Code</h3>
            <div className="steps-with-picture steps-panel">
              <ol className="steps">
                <li>Click the <b>aisus</b> icon in the Activity Bar.</li>
                <li>Type a focus such as <i>checkout flow</i>, or leave it empty to map the whole repository.</li>
                <li>Press <b>Generate</b>.</li>
                <li>Choose <b>Claude Code</b>, <b>Codex</b> or <b>Devin</b>. The map opens when your agent finishes.</li>
              </ol>
              <GeneratePicture />
            </div>
            <h3 id="generate-skill">With the skill</h3>
            <p>Start your agent in the repository and run its command. The focus is optional. The agent uses its own tokens or subscription to draw the map.</p>
            <SkillCommand />
          </section>
        </article>
        <aside className="guide-aside" aria-label="On this page">
          <strong>On this page</strong>
          {SUBSTEPS.map((step) => <a key={step.href} href={step.href}>{step.label}</a>)}
        </aside>
      </div>
    </main>
  );
}
