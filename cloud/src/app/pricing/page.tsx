// Public plan comparison. Billing configuration remains the source of displayed prices.
import { billingConfig } from "../../../plans";

export default function PricingPage() {
  const billing = billingConfig();
  const pro = billing?.priceTexts.pro;
  const team = billing?.priceTexts.team;
  return (
    <main className="pricing-page">
      <section className="wrap pricing-intro">
        <h1>Pay for cloud when your maps need a home.</h1>
        <p>The extension, skills, CLI and Action comment are free. Choose a cloud plan when you want map pages, history and team access on the web.</p>
      </section>
      <section className="wrap pricing-plans" aria-label="Plans">
        <article className="plan" id="free">
          <h2>Free</h2>
          <p className="plan-price">No cost</p>
          <p>Make and inspect maps locally. Add the Action's architecture comment to a pull request.</p>
          <ul><li>Extension, skills and CLI</li><li>Local citation and change checks</li><li>Pull request comment</li></ul>
          <a className="btn" href="/install" data-umami-event="install">Download aisus</a>
        </article>
        <article className="plan plan-featured" id="pro">
          <h2>Pro</h2>
          <p className="plan-price">{pro ?? (billing ? "Price at checkout" : "Included here")}</p>
          <p>Keep the maps of your own repositories, public and private, in aisus cloud.</p>
          <ul><li>Full map history</li><li>Pull request pages</li><li>Read-only share links</li></ul>
          <a className="btn btn-primary" href="/settings">See account plans</a>
        </article>
        <article className="plan" id="team">
          <h2>Team</h2>
          <p className="plan-price">{team ?? (billing ? "Price at checkout" : "Included here")}</p>
          <p>Keep an organization’s maps available to its members, with a team dashboard.</p>
          <ul><li>Organization repositories</li><li>Full history and pull request pages</li><li>Team dashboard and share links</li></ul>
          <a className="btn" href="/settings">See account plans</a>
        </article>
        <article className="plan" id="enterprise">
          <h2>Enterprise</h2>
          <p className="plan-price">Self-hosted</p>
          <p>Run aisus cloud on your own servers with the same map and team features.</p>
          <ul><li>Self-hosted deployment</li><li>Organization maps</li><li>Team dashboard and history</li></ul>
          <a className="text-link" href="https://github.com/aisusdev/aisus">View the repository ↗</a>
        </article>
      </section>
      <section className="wrap pricing-detail">
        {billing === null ? (
          <p>This server gives every account everything in aisus cloud.</p>
        ) : (
          <p>Pro {pro ? `costs ${pro}` : "is available"} for your own repositories. Team {team ? `costs ${team}` : "is available"} for an organization, with the team dashboard. Sign in and open Settings to see the plans available for accounts whose repositories you own.</p>
        )}
        <p>Source files stay on your machine or CI runner. <a href="/privacy">Read what the cloud stores</a>.</p>
      </section>
    </main>
  );
}
