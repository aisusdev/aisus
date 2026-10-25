// The signed-out landing page keeps the interactive map and product claims.
import { CommandPanel } from "./CommandPanel";
import { ProductFrame } from "./ProductFrame";

function Buttons() {
  return (
    <div className="cta">
      <a className="btn btn-primary" href="/install" data-umami-event="install">
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" /></svg>
        Download for VS Code
      </a>
      <a className="btn" href="/signin" data-umami-event="sign-in">
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" stroke="none" d="M12 .6C5.7.6.6 5.7.6 12c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.3-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.2-1.3-5.2-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.1v3.2c0 .3.2.7.8.6A11.4 11.4 0 0 0 23.4 12C23.4 5.7 18.3.6 12 .6Z" />
        </svg>
        Sign in with GitHub
      </a>
    </div>
  );
}

function CitationPreview() {
  return (
    <figure className="landing-preview citation-preview">
      <div className="landing-preview-bar"><strong>API</strong><span>src/api/handler.ts · lines 7–22</span></div>
      <div className="citation-preview-body">
        <p>The selected box opens the code behind its description.</p>
        <div className="citation-lines" aria-label="Checkout source example">
          <div><span>7</span><code>const {`{ cartId, method }`} = req.body;</code></div>
          <div><span>8</span><code>const cart = await carts.get(cartId);</code></div>
          <div className="citation-omitted"><span>…</span><code>…</code></div>
          <div><span>13</span><code>const payment = await charge({`{`}</code></div>
          <div><span>14</span><code>  amount: cart.total,</code></div>
          <div><span>15</span><code>  method,</code></div>
          <div><span>16</span><code>{`});`}</code></div>
        </div>
      </div>
      <figcaption>Interface preview · checkout example</figcaption>
    </figure>
  );
}

function ReviewPreview() {
  return (
    <figure className="landing-preview review-preview">
      <div className="landing-preview-bar"><strong>Pull request #482</strong><span>Add refunds</span></div>
      <div className="review-preview-body">
        <div className="review-preview-heading"><h3>What this change touches</h3><span>CHECKED</span></div>
        <div className="review-preview-row"><strong>Payments</strong><span>Box touched</span><em>Review</em></div>
        <div className="review-preview-row"><strong>Store</strong><span>Citation changed</span><em>Refresh</em></div>
        <div className="review-preview-row"><strong>Refunds</strong><span>New code without a box</span><em>Candidate</em></div>
        <p>Open the map to inspect each file and line.</p>
      </div>
      <figcaption>Interface preview · checkout example</figcaption>
    </figure>
  );
}

function CloudPreview() {
  return (
    <figure className="landing-preview cloud-preview">
      <div className="landing-preview-bar"><strong>Repository maps</strong><span>Sample team</span></div>
      <div className="cloud-preview-body">
        <div><strong>checkout-service</strong><span>main · map checked today</span><em>Current</em></div>
        <div><strong>payments-api</strong><span>main · 2 changed boxes</span><em>Review</em></div>
        <div><strong>web-client</strong><span>main · map checked yesterday</span><em>Current</em></div>
      </div>
      <figcaption>Interface preview · sample repositories</figcaption>
    </figure>
  );
}

export function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="wrap hero-grid">
          <h1 className="h1"><span>Trade some of your agent&apos;s output</span> <span className="l2">for understanding.</span></h1>
          <div className="hero-aside">
            <p className="lead">Coding agents write more code than a person can follow. aisus is a toolkit for sustainable development. It helps you keep up with the code you ship.</p>
            <Buttons />
          </div>
        </div>
      </section>
      <section className="stage" id="product">
        <div className="frame"><div className="frame-in"><ProductFrame /></div></div>
      </section>

      <section className="landing-section" id="map">
        <div className="wrap landing-story">
          <div className="landing-story-copy">
            <h2>The map is the main tool.</h2>
            <p>Press Generate in VS Code or Cursor. Claude Code, Codex or Devin draws your repository as boxes that open the code they cite.</p>
            <p>Each time you save, aisus checks every box against its code at zero tokens. Changed boxes get a badge. Refresh redraws only what changed.</p>
          </div>
          <CitationPreview />
        </div>
      </section>

      <section className="landing-section landing-section-muted" id="review">
        <div className="wrap landing-story landing-story-reverse">
          <div className="landing-story-copy">
            <h2>See what a change touches.</h2>
            <p>Review in your editor lists the boxes your branch touches, the boxes it leaves stale and the new code no box covers. The GitHub Action posts the same report on each pull request.</p>
          </div>
          <ReviewPreview />
        </div>
      </section>

      <section className="landing-band">
        <div className="wrap landing-band-grid">
          <div className="landing-band-intro"><h2>Use the map while you work.</h2><p>Follow the cited code through a change, then use it to ask, practise or set a rule.</p></div>
          <div className="landing-band-list">
            <article id="ask"><h3>Ask the map a question.</h3><p>Your agent answers from the map. Each answer links to the lines behind it.</p></article>
            <article id="learn"><h3>Practise on your own code.</h3><p>Before you merge, your agent asks three questions about the change and grades your answers privately. Bug hunts hide a bug in each step for you to find. Guided tours open code at each stop. A local practice log keeps the results.</p></article>
            <article id="rules"><h3>Keep the structure you chose.</h3><p>Right-click an arrow to forbid that dependency. An import that breaks the rule is marked in your editor and the pull request check. Hotspots tint each box by how often its code changes.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-cloud" id="cloud">
        <div className="wrap landing-story">
          <div className="landing-story-copy">
            <h2>Share maps with your team.</h2>
            <p>aisus cloud puts your maps and pull request reports on the web. Your code stays on your machine and your CI runner.</p>
            <a className="text-link" href="/pricing">Compare cloud plans ↗</a>
          </div>
          <CloudPreview />
        </div>
      </section>

      <section className="landing-close" id="start">
        <div className="wrap landing-close-grid">
          <div className="landing-close-copy">
            <h2>Open your repository as a map.</h2>
            <p>Install the extension and press Generate. Then click a box.</p>
            <Buttons />
          </div>
          <CommandPanel title="Agent skill" note="The focus is optional. Generate also runs from the editor.">
            <span className="terminal-comment"># Claude Code</span>{"\n"}
            /aisus-architecture checkout flow{"\n\n"}
            <span className="terminal-comment"># Codex</span>{"\n"}
            $aisus-architecture checkout flow
          </CommandPanel>
        </div>
      </section>
    </main>
  );
}
