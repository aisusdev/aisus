// The root layout: the site header, and no third-party scripts, fonts or analytics (CLD-08). With
// UMAMI_WEBSITE_ID set, the site's own Umami counts visits through the site's own /stats/ path.
import type { ReactNode } from "react";
import { currentUser } from "../auth";
import { STATS_HOOK, STATS_PATH, statsWebsite } from "../lib/stats";
import "./globals.css";

export const metadata = { title: "aisus cloud", description: "Architecture maps of your repositories. Maps, not code." };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const website = statsWebsite();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            aisus cloud
          </a>
          <nav>
            <a href="/docs">Docs</a>
            <a href="/gallery">Gallery</a>
            <a href="/privacy">Privacy</a>
          </nav>
          <span className="account">
            {user ? (
              <>
                <a href="/settings">{user.login}</a> · <a href="/api/auth/signout">Sign out</a>
              </>
            ) : (
              <a href="/signin">Sign in</a>
            )}
          </span>
        </header>
        {children}
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
