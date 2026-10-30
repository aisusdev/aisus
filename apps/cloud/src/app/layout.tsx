// Every page shares the document, the styles and the visit counts. The public site and the signed-in
// cloud under /cloud each draw their own header (CLD-20).
import type { ReactNode } from "react";
import { STATS_HOOK, STATS_PATH, statsWebsite } from "../lib/stats";
import "./globals.css";
import "./site-redesign.css";

export const metadata = {
  title: "aisus cloud",
  description: "aisus maps a repository into an architecture diagram whose boxes open the code they cite.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const website = statsWebsite();
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#page-content">Skip to content</a>
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
