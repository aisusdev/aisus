// The guide's /aisus-pr page: what the skill leaves on a pull request, what it needs, and how to run it.
import { CodeBlock } from "../../../../components/CodeBlock";
import { PullRequestPicture } from "../../../../components/GuidePictures";
import { SkillCommand } from "../../../../components/GuideTabs";
import { GuideTree } from "../../../../components/GuideTree";

// Change both together whenever the page's steps change.
const UPDATED = "2026-11-02";
const UPDATED_TEXT = "2 November 2026";

const SECTIONS = [
  { href: "#what", label: "What it does" },
  { href: "#before", label: "Before you start" },
  { href: "#run", label: "Run it" },
  { href: "#question", label: "Ask it a question" },
  { href: "#lands", label: "What lands on the pull request" },
  { href: "#stops", label: "If it stops" },
];

export default function AisusPrPage() {
  return (
    <main className="guide-page">
      <div className="wrap guide-layout">
        <GuideTree current="/get-started/aisus-pr" />
        <article className="guide-article">
          <header className="guide-intro">
            <h1>Explain a PR with /aisus-pr</h1>
            <p className="guide-updated">Last updated <time dateTime={UPDATED}>{UPDATED_TEXT}</time></p>
          </header>

          <section id="what">
            <h2><span className="guide-step">1</span>What it does</h2>
            <p>/aisus-pr draws a diagram of the pull request you have checked out and posts it as a comment on that pull request. Reviewers see which parts of the code the change touches before they read a line of it.</p>
            <div className="steps-with-picture steps-panel">
              <ol className="steps">
                <li>The diagram, drawn from the pull request&apos;s own code.</li>
                <li>Its page in aisus cloud, where each box opens the code it cites.</li>
                <li>The commit it was drawn from, so a later push shows the diagram may be out of date.</li>
              </ol>
              <PullRequestPicture />
            </div>
            <p>This is the comment it left on pull request #10 of the aisus repository.</p>
          </section>

          <section id="before">
            <h2><span className="guide-step">2</span>Before you start</h2>
            <div className="steps-panel panel-body">
              <ol className="steps">
                <li>The aisus skills are installed. The extension adds them, or <a href="/get-started#skills">install the skills alone</a>.</li>
                <li>The GitHub CLI, <code>gh</code>, is installed and signed in. Run <code>gh auth status</code> to check.</li>
                <li>The repository has a main map. <a href="/get-started#generate">Generate one</a> with the focus left empty.</li>
                <li>An upload token for the repository is set, as below.</li>
              </ol>
            </div>
            <h3 id="token">Set an upload token</h3>
            <p>/aisus-pr stores the diagram in aisus cloud so the comment can show it, and the token proves you may publish for this repository.</p>
            <div className="steps-panel panel-body">
              <ol className="steps">
                <li>Sign in at aisus.dev and open the repository.</li>
                <li>Open <b>Settings</b> and choose <b>Create upload token</b>.</li>
                <li>In the terminal where your agent runs, set the cloud&apos;s address and the token.</li>
              </ol>
              <CodeBlock code="export AISUS_CLOUD_URL=https://aisus.dev" label="the cloud address" language="shell" />
              <CodeBlock code="export AISUS_TOKEN=<your token>" label="the token line" language="shell" />
            </div>
            <p>Keep the token out of the repository. Revoke it in the repository&apos;s Settings if it leaks.</p>
          </section>

          <section id="run">
            <h2><span className="guide-step">3</span>Run it</h2>
            <p>Check out the pull request&apos;s branch, for example with <code>gh pr checkout 10</code>. Then start your agent in the repository and run the command. Without instructions, the diagram is your main map with the boxes the pull request touches marked.</p>
            <SkillCommand skill="aisus-pr" args="" />
          </section>

          <section id="question">
            <h2><span className="guide-step">4</span>Ask it a question</h2>
            <p>Add instructions after the command, up to 500 characters. Your agent then draws a new diagram of at most 15 boxes that answers them, instead of the main map.</p>
            <SkillCommand skill="aisus-pr" args="show how tours reach the viewer" />
          </section>

          <section id="lands">
            <h2><span className="guide-step">5</span>What lands on the pull request</h2>
            <p>One comment. It quotes your instructions when you gave some, then shows the diagram, a link to its page in aisus cloud and the commit it was drawn from.</p>
            <p>A box filled in green is code the pull request changed. A pale green box uses changed code. A dashed box marked NEW is code the pull request adds, and a dashed arrow is a new import.</p>
          </section>

          <section id="stops">
            <h2><span className="guide-step">6</span>If it stops</h2>
            <p>/aisus-pr posts nothing when something is missing, and says what it needs.</p>
            <div className="steps-panel panel-body stops">
              <dl>
                <dt>No pull request for this branch</dt>
                <dd>Check out the pull request&apos;s own branch, then run it again.</dd>
                <dt>There is no main map to show the changes on</dt>
                <dd>Generate a map with the focus left empty, or ask it a question instead.</dd>
                <dt>Publishing needs AISUS_CLOUD_URL or AISUS_TOKEN</dt>
                <dd>Set both, as in Set an upload token. A token from another repository, or a revoked one, is turned down the same way.</dd>
                <dt>The upload would be refused, so nothing was sent</dt>
                <dd>It lists what would be refused, such as a value that looks like a secret. Remove it from the map, then run it again.</dd>
              </dl>
            </div>
            <p>For a report on every pull request without running anything, add the <a href="https://github.com/aisusdev/aisus#github-action">aisus GitHub Action</a> to the repository.</p>
          </section>
        </article>
        <aside className="guide-aside" aria-label="On this page">
          <strong>On this page</strong>
          {SECTIONS.map((section) => <a key={section.href} href={section.href}>{section.label}</a>)}
        </aside>
      </div>
    </main>
  );
}
