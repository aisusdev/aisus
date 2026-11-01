"use client";
// A JSON block as it reads in VS Code's Light Modern theme, with a button at its top right that copies the whole text.
import { useEffect, useState, type ReactNode } from "react";

// A string with its colon is a key. Anything else is a string, a literal or a number.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;

function colour(json: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const token = new RegExp(TOKEN.source, "g");
  let last = 0;
  for (let match = token.exec(json); match; match = token.exec(json)) {
    if (match.index > last) parts.push(json.slice(last, match.index));
    const [text, string, colon, literal] = match;
    if (string !== undefined && colon !== undefined) {
      parts.push(<span key={match.index} className="tk-key">{string}</span>, colon);
    } else {
      const kind = string !== undefined ? "tk-str" : literal !== undefined ? "tk-s" : "tk-n";
      parts.push(<span key={match.index} className={kind}>{text}</span>);
    }
    last = match.index + text.length;
  }
  if (last < json.length) parts.push(json.slice(last));
  return parts;
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  // A browser that refuses the clipboard API copies from a hidden text area instead.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      const area = document.createElement("textarea");
      area.value = code;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const done = document.execCommand("copy");
      area.remove();
      setCopied(done);
    }
  };
  return (
    <div className="code-block">
      <button type="button" className="copy-code" aria-label={copied ? "Copied" : `Copy ${label}`} onClick={copy}>
        {copied
          ? <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="12" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" /></svg>}
      </button>
      <pre><code>{colour(code)}</code></pre>
    </div>
  );
}
