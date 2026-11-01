// The public site's header and footer. Signed out, Sign in opens /cloud/signin. Signed in, Open cloud opens /cloud (CLD-20).
import type { ReactNode } from "react";
import { currentUser } from "../../auth";
import { HeaderShadow } from "../../components/HeaderShadow";
import { CLOUD, signInPath } from "../../lib/paths";
import { GALLERY_ENABLED } from "../../lib/siteFeatures";

const MARKETPLACE = "https://marketplace.visualstudio.com/items?itemName=aisus.aisus";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  ...(GALLERY_ENABLED ? [{ href: "/gallery", label: "Gallery" }] : []),
  { href: "/#faq", label: "FAQ" },
];

function Brand() {
  return (
    <a className="brand brand-wordmark" href="/" aria-label="aisus home">
      <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8.5" y="2.5" width="7" height="5" rx="1" />
        <rect x="2.5" y="16.5" width="7" height="5" rx="1" />
        <rect x="14.5" y="16.5" width="7" height="5" rx="1" />
        <path d="M12 7.5v4.5M6 16.5V12h12v4.5" />
      </svg>
      <img src="/aisus-wordmark.png" alt="aisus" width="160" height="55" />
    </a>
  );
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const account = user ? <a href={CLOUD}>Open cloud</a> : <a href={signInPath()}>Sign in</a>;
  return (
    <div className="site-page">
      <header className="site-header">
        <div className="wrap header-inner">
          <Brand />
          <nav className="nav" aria-label="Main">
            {LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <div className="top-r">
            <span className="account">{account}</span>
            <a className="btn btn-primary btn-sm" href="/get-started" data-umami-event="get-started">Get Started</a>
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
      <HeaderShadow />
      <div id="page-content">{children}</div>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-about">
            <Brand />
            <p>A map of the code you can check for yourself.</p>
          </div>
          <nav className="footer-links" aria-label="Product">
            <strong>Product</strong>
            <a href="/#features">Features</a>
            <a href="/get-started">Get Started</a>
            <a href="/pricing">Pricing</a>
            {GALLERY_ENABLED && <a href="/gallery">Gallery</a>}
            <a href="/#faq">FAQ</a>
          </nav>
          <nav className="footer-links" aria-label="Project">
            <strong>Project</strong>
            <a href={MARKETPLACE}>VS Code extension ↗</a>
            <a href="https://github.com/aisusdev/aisus">GitHub ↗</a>
            <a href="/privacy">Privacy</a>
          </nav>
          <nav className="footer-links" aria-label="Follow">
            <strong>Follow</strong>
            <a href="https://www.instagram.com/aisus.dev/">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle className="dot" cx="17.3" cy="6.7" r=".6" /></svg>
              Instagram
            </a>
            <a href="https://www.youtube.com/@aisusdotdev">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="4" /><path className="dot" d="M10 9.2v5.6l4.8-2.8z" /></svg>
              YouTube
            </a>
          </nav>
        </div>
        <div className="wrap footer-base">
          <span>© {new Date().getFullYear()} aisus</span>
          <span>Third-party product names and marks belong to their respective owners.</span>
        </div>
      </footer>
    </div>
  );
}
