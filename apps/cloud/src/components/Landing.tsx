// The homepage (docs/design/homepage.md): the hero, the tools aisus works with, the feature demos and the FAQ.
// Signed in, its sign-in button opens the cloud (CLD-20).
import { CLOUD, signInPath } from "../lib/paths";
import { FeatureTabs } from "./FeatureTabs";

// Each tool shows a tile with its initials until its owner's terms allow its official mark here.
const TOOLS = [
  { name: "VS Code", initials: "VS" },
  { name: "Cursor", initials: "Cu" },
  { name: "IntelliJ", initials: "IJ" },
  { name: "Claude Code", initials: "CC" },
  { name: "Codex", initials: "Cx" },
  { name: "Devin", initials: "Dv" },
  { name: "GitHub", initials: "GH" },
];

const FAQ = [
  { question: "How do I start using aisus?", answer: "Install the extension in VS Code or Cursor, click the aisus icon in the Activity Bar and press Generate. The setup checklist names anything missing." },
  { question: "Which coding agents does it work with?", answer: "aisus runs Claude Code, Codex and Devin. For Copilot, Gemini CLI and OpenCode it copies a prompt for you to paste." },
  { question: "Does my code leave my machine?", answer: "Source files stay on your machine or CI runner. aisus cloud keeps only the maps and pull request reports you publish." },
  { question: "What does checking a map cost?", answer: "Nothing. aisus compares every box with the code it cites without spending a token. Your agent spends tokens only when it draws or refreshes a map." },
  { question: "Can I use it in IntelliJ?", answer: "Yes. Add the skills and run them in Claude Code or Codex, and each box opens its code in your JetBrains IDE." },
  { question: "Is aisus free?", answer: "The extension, skills, CLI and pull request comment are free. A cloud plan adds map pages, history and team access on the web." },
];

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="home">
      <section className="home-hero">
        <h1>See your codebase as a map</h1>
        <p>Coding agents write more code than a person can follow. aisus draws your repository as a map whose boxes open the code they cite.</p>
        <div className="cta">
          <a className="btn btn-primary" href="/get-started" data-umami-event="get-started">Get Started</a>
          {signedIn
            ? <a className="btn" href={CLOUD}>Open cloud</a>
            : <a className="btn" href={signInPath()} data-umami-event="sign-in">Sign in</a>}
        </div>
      </section>

      <section className="works" aria-label="Works with">
        <p>Works with</p>
        <ul>
          {TOOLS.map((tool) => (
            <li key={tool.name}><span className="tool-tile" aria-hidden="true">{tool.initials}</span>{tool.name}</li>
          ))}
        </ul>
      </section>

      <FeatureTabs />

      <section className="faq" id="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">FAQ</h2>
        <div className="faq-list">
          {FAQ.map((item) => (
            <details key={item.question} name="faq">
              <summary>
                {item.question}
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
