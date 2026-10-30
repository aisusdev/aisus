// CLD-20: the signed-in cloud's header. Signed in it links to the repositories and settings and shows who is
// signed in. Signed out, as on the sign-in page and a public repository's map, it links back to the site.
import type { ReactNode } from "react";
import { currentUser } from "../../auth";
import { CloudNav } from "../../components/CloudNav";
import { CLOUD, signInPath } from "../../lib/paths";
import "./cloud.css";

export default async function CloudLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <header className="cloud-header">
        <a className="brand brand-wordmark" href={user ? CLOUD : "/"} aria-label="aisus cloud home">
          <img src="/aisus-wordmark.png" alt="aisus" width="120" height="41" />
          <span className="cloud-tag">cloud</span>
        </a>
        {user ? (
          <>
            <CloudNav />
            <div className="cloud-user account">
              <span className="avatar" aria-hidden="true">{user.login.slice(0, 1).toUpperCase()}</span>
              <span>{user.login}</span>
              <a href="/api/auth/signout">Sign out</a>
            </div>
          </>
        ) : (
          <nav className="cloud-nav cloud-nav--site" aria-label="Site">
            <a href="/#map">Features</a>
            <a href="/pricing">Pricing</a>
            <a href={signInPath()}>Sign in</a>
          </nav>
        )}
      </header>
      <div id="page-content" className="cloud-content">{children}</div>
    </>
  );
}
