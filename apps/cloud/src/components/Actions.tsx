"use client";
// Owner actions on the settings pages (CLD-03, CLD-06, CLD-07, CLD-11): each asks first when it deletes, calls
// the API from this site, and reloads the page.
import { useRouter } from "next/navigation";
import { useState } from "react";

async function call(method: string, url: string, body?: unknown): Promise<Response> {
  return fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

export function DeleteButton({ url, label, confirmText, then = "reload" }: { url: string; label: string; confirmText: string; then?: "reload" | "home" | "signout" }) {
  return (
    <button
      type="button"
      className="button button--danger"
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        const response = await call("DELETE", url);
        if (!response.ok) {
          window.alert(((await response.json()) as { message?: string }).message ?? "Not deleted.");
          return;
        }
        if (then === "signout") window.location.href = "/api/auth/signout";
        else if (then === "home") window.location.href = "/settings";
        else window.location.reload();
      }}
    >
      {label}
    </button>
  );
}

export function PublicToggle({ url, value, allowed }: { url: string; value: boolean; allowed: boolean }) {
  return (
    <label>
      <input
        type="checkbox"
        checked={value}
        disabled={!allowed}
        onChange={async (event) => {
          await call("POST", url, { public: event.target.checked });
          window.location.reload();
        }}
      />{" "}
      Anyone can see this repository&apos;s maps
    </label>
  );
}

export function NewToken({ url }: { url: string }) {
  const [shown, setShown] = useState<string | null>(null);
  const [name, setName] = useState("ci");
  return (
    <div>
      <input aria-label="Token name" value={name} onChange={(event) => setName(event.target.value)} />{" "}
      <button
        type="button"
        className="button"
        onClick={async () => {
          const response = await call("POST", url, { name });
          if (response.ok) setShown(((await response.json()) as { token: string }).token);
        }}
      >
        Create upload token
      </button>
      {shown ? (
        <p>
          Copy it now; it will not be shown again: <code className="new-token">{shown}</code>
        </p>
      ) : null}
    </div>
  );
}

/** CLD-06: makes a share link that lasts the chosen days, and shows it once. */
export function NewShareLink({ url, days }: { url: string; days: readonly number[] }) {
  const [shown, setShown] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      {days.map((count) => (
        <button
          key={count}
          type="button"
          className="button"
          onClick={async () => {
            const response = await call("POST", url, { days: count });
            if (!response.ok) return;
            setShown(`${window.location.origin}${((await response.json()) as { url: string }).url}`);
            // The list of links is drawn on the server; refreshing it keeps the link shown here.
            router.refresh();
          }}
        >
          Share for {count} {count === 1 ? "day" : "days"}
        </button>
      ))}
      {shown ? (
        <p>
          Copy the link now. It will not be shown again: <code className="new-share">{shown}</code>
        </p>
      ) : null}
    </div>
  );
}

/** CLD-07: Upgrade to Pro, Upgrade to Team or Manage billing: asks the server for Stripe's page and goes there. */
export function PlanButton({ url, account, label, primary = false }: { url: string; account: string; label: string; primary?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={primary ? "button button--primary" : "button"}
        onClick={async () => {
          const response = await call("POST", url, { account });
          const body = (await response.json()) as { url?: string; message?: string };
          if (response.ok && body.url) window.location.href = body.url;
          else setError(body.message ?? "Stripe did not answer.");
        }}
      >
        {label}
      </button>
      {error ? <span className="muted"> {error}</span> : null}
    </>
  );
}

/** P-7: Skip for now. A year-long cookie keeps the first run away, and the home loads. */
export function SkipFirstRun({ cookie, label = "Skip for now" }: { cookie: string; label?: string }) {
  return (
    <button
      type="button"
      className="text-button"
      onClick={() => {
        document.cookie = `${cookie}=skipped; path=/; max-age=31536000; samesite=lax`;
        window.location.href = "/";
      }}
    >
      {label}
    </button>
  );
}

/** Copies `text`, or this site's address followed by `path`, and says so. */
export function CopyButton({ text, path, label }: { text?: string; path?: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text ?? `${window.location.origin}${path ?? ""}`);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/** P-7: opens the map of a public repository named as owner/name. */
export function OpenRepository() {
  const [name, setName] = useState("");
  return (
    <form
      className="open-repo"
      onSubmit={(event) => {
        event.preventDefault();
        const [owner, repo] = name.trim().replace(/^https:\/\/github\.com\//, "").split("/");
        if (owner && repo) window.location.href = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      }}
    >
      <label htmlFor="open-repo">Open another public repository</label>
      <div>
        <input id="open-repo" placeholder="owner/name" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="button">
          Open
        </button>
      </div>
    </form>
  );
}
