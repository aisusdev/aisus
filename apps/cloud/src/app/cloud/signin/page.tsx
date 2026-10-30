// CLD-01 and CLD-20: sign in with GitHub. Only a same-site return path is followed, and /cloud is the default.
import { CLOUD } from "../../../lib/paths";
import { SignInButton } from "./SignInButton";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const back = callbackUrl !== undefined && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : CLOUD;
  return (
    <main className="signin">
      <section className="signin__pitch">
        <p className="signin__headline">
          Your maps, <em>shared with your team.</em>
        </p>
        <p>aisus cloud keeps every map your repositories publish, shows what each pull request changes on it, and opens to the people GitHub already lets in.</p>
      </section>
      <section className="signin__form">
        <div className="signin__box">
          <h1>Sign in to aisus cloud</h1>
          <p className="muted">aisus cloud follows your GitHub permissions.</p>
          <ul className="signin__roles">
            <li>
              <b>Read</b>
              <span>View a repository&apos;s maps.</span>
            </li>
            <li>
              <b>Write</b>
              <span>Work with its maps and pull requests.</span>
            </li>
            <li>
              <b>Admin</b>
              <span>Manage tokens, links, plans and data.</span>
            </li>
          </ul>
          <SignInButton callbackUrl={back} />
          <p className="muted">
            aisus asks GitHub for read:user and read:org. <a href="/privacy">Privacy</a>
          </p>
        </div>
      </section>
    </main>
  );
}
