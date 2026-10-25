// CLD-08: signed out, `/` is the landing page. Signed in, it keeps the install steps and useful links.
import { currentUser } from "../auth";
import { Landing } from "../components/Landing";
import { releasesRepo } from "../lib/install";
import { GALLERY_ENABLED } from "../lib/siteFeatures";

export default async function Home() {
  const user = await currentUser();
  if (!user) return <Landing />;
  return (
    <main className="page">
      <h1>Architecture maps that keep up with your code</h1>
      <p>
        aisus draws your repository as an architecture map whose boxes open the code they cite, shows which boxes your pull requests touch, and tells you when the map has
        drifted from the code. aisus cloud shares those maps and checks with your team.
      </p>
      <h2>Install</h2>
      <p>
        <a className="button button--primary" href="/install" data-umami-event="install">
          Download for VS Code
        </a>
      </p>
      <p>
        Then choose <strong>Install from VSIX…</strong> in the Extensions view, click the aisus icon and press Generate. It works in Cursor and Devin Desktop too.
      </p>
      <p>
        Without VS Code, add the skills to Claude Code or Codex with <code>npx skills add {releasesRepo()}</code> and run <code>/aisus-architecture</code>.
      </p>
      <p>
        <a className="button" href="/settings">
          Settings
        </a>
        <a className="button" href="/get-started">
          Get Started
        </a>
        {GALLERY_ENABLED && <a className="button" href="/gallery">See public maps</a>}
      </p>
    </main>
  );
}
