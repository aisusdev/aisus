// The public and signed-in pages share one header and footer. The product map keeps its own viewer theme.
import type { ReactNode } from "react";
import { currentUser } from "../auth";
import { GALLERY_ENABLED } from "../lib/siteFeatures";
import { STATS_HOOK, STATS_PATH, statsWebsite } from "../lib/stats";
import "./globals.css";
import "./site-redesign.css";

export const metadata = {
  title: "aisus cloud",
  description: "aisus maps a repository into an architecture diagram whose boxes open the code they cite.",
};

const LINKS = [
  { href: "/#map", label: "Features" },
  { href: "/get-started", label: "Get Started" },
  { href: "/pricing", label: "Pricing" },
  ...(GALLERY_ENABLED ? [{ href: "/gallery", label: "Gallery" }] : []),
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const website = statsWebsite();
  const account = user ? (
    <>
      <a href="/settings">{user.login}</a>
      <a href="/api/auth/signout">Sign out</a>
    </>
  ) : (
    <a href="/signin">Sign in</a>
  );
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#page-content">Skip to content</a>
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
        {website && (
          <>
            <script dangerouslySetInnerHTML={{ __html: STATS_HOOK }} />
            <script defer src={`${STATS_PATH}/script.js`} data-website-id={website} data-before-send="aisusStats" data-exclude-search="true" data-do-not-track="true" />
          </>
        )}
      </body>
    </html>
  );
}
