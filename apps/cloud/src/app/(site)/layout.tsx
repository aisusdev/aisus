// The public site's header and footer. Signed out, Sign in opens /cloud/signin. Signed in, Open cloud opens /cloud (CLD-20).
import type { ReactNode } from "react";
import { currentUser } from "../../auth";
import { GoArrow } from "../../components/GoArrow";
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

// The runner: the three-node map as a figure heading for the wordmark. The head is the root and the legs are its children.
function Brand() {
  return (
    <a className="brand brand-wordmark" href="/" aria-label="aisus home">
      <svg className="brand-icon" viewBox="17.75 2 118 118" aria-hidden="true">
        <g fill="none" stroke="#023422" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 12.5L120.25 27C106 26 85 31 77 44C74 50 73 57 73 63.4L61.5 63.5L62.5 13.5Z" fill="#477464" stroke="none" />
          <path d="M62.44 16.5Q62.5 13.5 65.5 13.45L117 12.55Q120 12.5 120.03 15.5L120.47 60Q120.5 63 117.5 63.03L64.5 63.47Q61.5 63.5 61.56 60.5Z" />
          <circle cx="105" cy="40" r="6" fill="#023422" stroke="none" />
          <path d="M114.5 49.5Q106 59 97 51" strokeWidth="6" />
          <path d="M22.5 67.5L33.33 67.33L33.17 95.17L22 95Z" fill="#477464" stroke="none" />
          <path d="M22.45 70.5Q22.5 67.5 25.5 67.45L52 67.05Q55 67 55.05 70L55.45 92.5Q55.5 95.5 52.5 95.46L25 95.04Q22 95 22.05 92Z" />
          <path d="M98 81.5L109 81.33L108.83 109.33L97.5 109.5Z" fill="#477464" stroke="none" />
          <path d="M97.95 84.5Q98 81.5 101 81.45L128 81.05Q131 81 131.05 84L131.45 106Q131.5 109 128.5 109.04L100.5 109.46Q97.5 109.5 97.55 106.5Z" />
          <path d="M104 63.25L114.5 81.25M84 63.25V81.25H55.25" />
        </g>
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
          <div className="header-centre">
            <nav className="nav" aria-label="Main">
              {LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
            </nav>
            <a className="btn btn-primary btn-sm" href="/get-started" data-umami-event="get-started">Get Started<GoArrow /></a>
          </div>
          <div className="top-r">
            <span className="account">{account}</span>
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
