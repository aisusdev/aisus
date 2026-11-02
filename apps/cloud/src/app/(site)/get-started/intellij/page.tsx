// The guide's IntelliJ page: install the aisus plugin from a release's zip, then open its tool window.
import { PluginsPicture } from "../../../../components/GuidePictures";
import { GuideTree } from "../../../../components/GuideTree";

// Change both together whenever the page's steps change.
const UPDATED = "2026-11-02";
const UPDATED_TEXT = "2 November 2026";

const STEPS = [
  { href: "#install-plugin", label: "Install the plugin" },
  { href: "#open", label: "Open the map" },
];

export default function IntellijPage() {
  return (
    <main className="guide-page">
      <div className="wrap guide-layout">
        <GuideTree current="/get-started/intellij" />
        <article className="guide-article">
          <header className="guide-intro">
            <h1>Installation for IntelliJ IDEA</h1>
            <p className="guide-updated">Last updated <time dateTime={UPDATED}>{UPDATED_TEXT}</time></p>
          </header>

          <section id="install-plugin">
            <h2><span className="guide-step">1</span>Install the plugin</h2>
            <p>The aisus plugin works in IntelliJ IDEA and the other JetBrains IDEs, version 2026.1 or newer.</p>
            <div className="steps-with-picture steps-panel">
              <ol className="steps">
                <li>Download the plugin&apos;s zip file. Keep it zipped.<a className="btn btn-primary steps-button" href="/install/intellij" data-umami-event="install-intellij">Download the IntelliJ release</a></li>
                <li>Open <b>Settings</b> with <kbd>⌘</kbd><kbd>,</kbd> on macOS, or <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> on Windows and Linux, and choose <b>Plugins</b>.</li>
                <li>Click <b>⚙</b> at the top of Plugins and choose <b>Install Plugin from Disk…</b>.</li>
                <li>Pick the zip file, then restart the IDE when it asks.</li>
              </ol>
              <PluginsPicture />
            </div>
          </section>

          <section id="open">
            <h2><span className="guide-step">2</span>Open the map</h2>
            <div className="steps-panel panel-body">
              <ol className="steps">
                <li>Open your repository in the IDE.</li>
                <li>Click <b>aisus</b> in the tool window bar on the right, or choose <b>View</b> › <b>Tool Windows</b> › <b>aisus</b>.</li>
              </ol>
            </div>
            <p>The tool window shows your repository&apos;s maps. To draw one, install your agent and the skills as <a href="/get-started#agent">Prepare your agent</a> on Get Started says.</p>
          </section>
        </article>
        <aside className="guide-aside" aria-label="On this page">
          <strong>On this page</strong>
          {STEPS.map((step) => <a key={step.href} href={step.href}>{step.label}</a>)}
        </aside>
      </div>
    </main>
  );
}
