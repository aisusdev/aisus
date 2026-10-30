// A release-accurate path from installation to the first code-linked map.
import { releasesRepo } from "../../../lib/install";
import { CommandPanel } from "../../../components/CommandPanel";

const sections = [
  { href: "#install", label: "Install aisus" },
  { href: "#generate", label: "Generate a map" },
  { href: "#inspect", label: "Inspect cited code" },
  { href: "#freshness", label: "Check what changed" },
  { href: "#share", label: "Share a map" },
];

export default function GetStartedPage() {
  const repo = releasesRepo();
  return (
    <main className="guide-page">
      <div className="wrap guide-layout">
        <nav className="guide-sidebar" aria-label="Get Started navigation">
          <strong>Get Started</strong>
          <a className="active" href="#overview">Introduction</a>
          {sections.map((section) => <a key={section.href} href={section.href}>{section.label}</a>)}
        </nav>
        <article className="guide-article">
          <div className="guide-intro" id="overview">
            <nav className="breadcrumb" aria-label="Breadcrumb"><a href="/">aisus</a><span aria-hidden="true">›</span><span>Get Started</span></nav>
            <h1>Get started with aisus</h1>
            <p>Install aisus where you work, generate a map with the agent you already use, and follow a box back to its code. Local maps do not need an aisus cloud account.</p>
          </div>
          <section id="install">
            <h2>Install aisus</h2>
            <p>For VS Code, Cursor or Devin Desktop, download the current VSIX and choose <strong>Install from VSIX…</strong> in the Extensions view. Open a repository, then select the aisus icon in the Activity Bar.</p>
            <p><a className="btn btn-primary" href="/install" data-umami-event="install">Download for VS Code</a></p>
            <p className="guide-note">The sidebar setup checklist names anything still needed for your chosen agent. Viewing an existing map does not need an agent.</p>
            <h3>Use the skills without the extension</h3>
            <p>In a repository, install the aisus skills for Claude Code or Codex. Node.js 18 or newer and a signed-in agent are needed to generate a map.</p>
            <CommandPanel title="Install skills">{`npx skills add ${repo}`}</CommandPanel>
            <p>The generated map can open as a standalone HTML page, including when you work in a JetBrains IDE.</p>
          </section>
          <section id="generate">
            <h2>Generate a map</h2>
            <p>In the aisus sidebar, choose <strong>Generate</strong>. Give it an optional focus such as “checkout flow,” then choose Claude Code, Codex or Devin. The agent writes a map and checks its citations.</p>
            <p>With the skills alone, run one of these commands in the repository:</p>
            <CommandPanel title="Generate a map">
              <span className="terminal-comment"># Claude Code</span>{"\n"}
              /aisus-architecture checkout flow{"\n\n"}
              <span className="terminal-comment"># Codex</span>{"\n"}
              $aisus-architecture checkout flow
            </CommandPanel>
            <p>The focus can be left out. The agent uses its own tokens or subscription allowance to generate the map.</p>
          </section>
          <section id="inspect">
            <h2>Inspect cited code</h2>
            <p>Open the map from the aisus Maps list. Click a box to open the file and lines it cites. Follow an arrow to the next component, then check the source behind its description.</p>
          </section>
          <section id="freshness">
            <h2>Check what changed</h2>
            <p>aisus compares map citations with your working copy as you edit. A box shows when its code has moved, changed or gone missing. Choose <strong>Refresh Architecture</strong> to ask your agent to update the changed part.</p>
            <p className="guide-note">Checking citations uses no agent tokens. Refreshing a map asks your agent to generate an update.</p>
          </section>
          <section id="share">
            <h2>Share a map</h2>
            <p>Commit an accepted map with its repository to make it available for local checks and the aisus GitHub Action. The Action can comment on a pull request with touched boxes, stale citations and code the map does not cover.</p>
            <p>aisus cloud is optional. It receives maps and check results when you choose to upload them; source files stay on your machine or CI runner. <a href="/pricing">Compare the cloud plans</a> before setting up an upload.</p>
          </section>
        </article>
        <aside className="guide-aside" aria-label="On this page"><strong>On this page</strong>{sections.map((section) => <a key={section.href} href={section.href}>{section.label}</a>)}</aside>
      </div>
    </main>
  );
}
