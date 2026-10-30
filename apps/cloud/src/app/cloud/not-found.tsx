// CLD-20: a page under /cloud that the user may not open says so inside the cloud, the same way whether or not it exists.
import { CLOUD, signInPath } from "../../lib/paths";

export default function CloudNotFound() {
  return (
    <main className="page cloud-main cloud-main--narrow cloud-missing">
      <h1>Nothing here for you</h1>
      <p className="cloud-lede">This page does not exist in aisus cloud, or your GitHub account cannot open it.</p>
      <p className="cloud-actions">
        <a className="button button--primary" href={CLOUD}>
          Go to your repositories
        </a>
        <a className="button" href={signInPath()}>
          Sign in as someone else
        </a>
      </p>
    </main>
  );
}
