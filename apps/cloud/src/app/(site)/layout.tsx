// The public site's header and footer. Signed out, Sign in opens /cloud/signin. Signed in, Open cloud opens /cloud (CLD-20).
import type { ReactNode } from "react";
import { currentUser } from "../../auth";
import { CLOUD, signInPath } from "../../lib/paths";
import { GALLERY_ENABLED } from "../../lib/siteFeatures";

const LINKS = [
  { href: "/#map", label: "Features" },
  { href: "/get-started", label: "Get Started" },
  { href: "/pricing", label: "Pricing" },
  ...(GALLERY_ENABLED ? [{ href: "/gallery", label: "Gallery" }] : []),
];

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const account = user ? <a href={CLOUD}>Open cloud</a> : <a href={signInPath()}>Sign in</a>;
  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand brand-wordmark" href="/" aria-label="aisus home">
            <img src="/aisus-wordmark.png" alt="aisus" width="160" height="55" />
          </a>
          <nav className="nav" aria-label="Main">
            {LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <div className="top-r">
            <span className="account">{account}</span>
            <a className="btn btn-primary btn-sm" href="/install" data-umami-event="install">Download</a>
            <details className="menu">
              <summary aria-label="Menu"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></summary>
              <nav aria-label="Menu">
                {LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
                <a href="/privacy">Privacy</a>
                {account}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <div id="page-content">{children}</div>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-about">
            <a className="brand brand-wordmark" href="/" aria-label="aisus home"><img src="/aisus-wordmark.png" alt="aisus" width="160" height="55" /></a>
            <p>A map of the code you can check for yourself.</p>
          </div>
          <div className="footer-links"><strong>Explore</strong><a href="/#map">Features</a><a href="/get-started">Get Started</a><a href="/pricing">Pricing</a>{GALLERY_ENABLED && <a href="/gallery">Gallery</a>}</div>
          <div className="footer-links"><strong>Project</strong><a href="https://github.com/aisusdev/aisus">GitHub ↗</a><a href="/privacy">Privacy</a></div>
          <div className="footer-last"><span>Built for developers who read the code they ship.</span><small>Third-party product names and marks belong to their respective owners.</small></div>
        </div>
      </footer>
    </>
  );
}
