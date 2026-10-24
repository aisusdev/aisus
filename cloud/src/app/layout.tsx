// The root layout: the site header and footer, and no third-party scripts, fonts or analytics (CLD-08). With
// UMAMI_WEBSITE_ID set, the site's own Umami counts visits through the site's own /stats/ path.
import type { ReactNode } from "react";
import { currentUser } from "../auth";
import { STATS_HOOK, STATS_PATH, statsWebsite } from "../lib/stats";
import "./globals.css";

export const metadata = { title: "aisus cloud", description: "aisus is a toolkit for sustainable development. Its main tool is a map whose boxes open the code they cite." };

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2.5" y="5.5" width="15" height="17" rx="4.5" fill="none" stroke="#f2f4f1" strokeWidth="2.2" />
      <path d="M6.8 11h6.4M6.8 15.5h3.8" stroke="#f2f4f1" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17.5 14h3.3" stroke="#c5f24a" strokeWidth="2.2" />
      <circle cx="23.2" cy="14" r="3" fill="#c5f24a" />
    </svg>
  );
}

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/gallery", label: "Gallery" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
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
        <header className="site-header">
          <div className="wrap">
            <a className="brand" href="/" aria-label="aisus cloud home">
              <Mark />
              aisus <small>cloud</small>
            </a>
            <nav className="nav" aria-label="Main">
              {LINKS.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="top-r">
              <span className="account">{account}</span>
              <a className="btn btn-primary btn-sm" href="/install" data-umami-event="install">
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
                </svg>
                Download
              </a>
              <details className="menu">
                <summary aria-label="Menu">
                  <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </summary>
                <nav aria-label="Menu">
                  {LINKS.map((link) => (
                    <a key={link.href} href={link.href}>
                      {link.label}
                    </a>
                  ))}
                  {account}
                </nav>
              </details>
            </div>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
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
