"use client";
// The guide's left panel: its pages, each with the steps under it. The page being read starts open and the others
// start closed. A chevron opens or closes any page's steps, and a page without steps is a plain link.
import { useState } from "react";

const PAGES = [
  {
    href: "/get-started",
    label: "Get Started",
    steps: [
      { id: "install", label: "1. Installation" },
      { id: "agent", label: "2. Prepare your agent" },
      { id: "generate", label: "3. Generate a map" },
    ],
  },
  {
    href: "/get-started/intellij",
    label: "Installation for IntelliJ IDEA",
    steps: [
      { id: "install-plugin", label: "1. Install the plugin" },
      { id: "open", label: "2. Open the map" },
    ],
  },
  { href: "/get-started/aisus-pr", label: "/aisus-pr", steps: [] },
];

export function GuideTree({ current }: { current: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [current]: true }));
  return (
    <nav className="guide-sidebar" aria-label="Guide">
      <strong>Guide</strong>
      {PAGES.map((page) => {
        const here = page.href === current;
        const shown = Boolean(open[page.href]);
        const list = `steps-${page.href.replace(/\W+/g, "-")}`;
        const link = <a className={here ? "active" : undefined} aria-current={here ? "page" : undefined} href={page.href}>{page.label}</a>;
        if (page.steps.length === 0) {
          return <div key={page.href} className="guide-node"><div className="guide-row"><span className="guide-toggle-space" aria-hidden="true" />{link}</div></div>;
        }
        return (
          <div key={page.href} className="guide-node">
            <div className="guide-row">
              <button
                type="button"
                className="guide-toggle"
                aria-expanded={shown}
                aria-controls={list}
                aria-label={`${shown ? "Hide" : "Show"} the steps of ${page.label}`}
                onClick={() => setOpen({ ...open, [page.href]: !shown })}
              >
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              {link}
            </div>
            <div className="guide-children" id={list} hidden={!shown}>
              {page.steps.map((step) => <a key={step.id} className="guide-sub" href={here ? `#${step.id}` : `${page.href}#${step.id}`}>{step.label}</a>)}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
