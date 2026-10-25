import type { ReactNode } from "react";

export function CommandPanel({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <div className="terminal-panel">
      <div className="terminal-panel-head"><span className="terminal-panel-status" aria-hidden="true" />{title}</div>
      <pre><code>{children}</code></pre>
      {note && <p className="terminal-panel-note">{note}</p>}
    </div>
  );
}
