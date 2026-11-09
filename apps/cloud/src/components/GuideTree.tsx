"use client";
// The left panel of the guide and the docs: the guide's pages, then the docs' pages in their groups. The page being
// read is marked. Each page's sections are in On this page on the right. On a phone the panel is one row that scrolls
// sideways, and it starts scrolled to the page being read.
import { useEffect, useRef } from "react";
import type { TreePage } from "../lib/docs";

const PAGES: TreePage[] = [
  { href: "/get-started", label: "Get Started" },
  { href: "/get-started/intellij", label: "Installation for IntelliJ IDEA" },
  { href: "/get-started/aisus-pr", label: "/aisus-pr" },
];

export function GuideTree({ current, docs }: { current: string; docs: { title: string; pages: TreePage[] }[] }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = panel.current;
    const here = row?.querySelector<HTMLElement>("a.active");
    if (row && here && row.scrollWidth > row.clientWidth) row.scrollLeft = here.offsetLeft - row.offsetLeft;
  }, []);
  const link = (page: TreePage) => {
    const here = page.href === current;
    return (
      <a key={page.href} className={here ? "active" : undefined} aria-current={here ? "page" : undefined} href={page.href}>
        {page.label}
      </a>
    );
  };
  return (
    <nav ref={panel} className="guide-sidebar" aria-label="Guide">
      <strong>Guide</strong>
      {PAGES.map(link)}
      <strong className="guide-heading-docs">Docs</strong>
      {docs.map((group) => (
        <div key={group.title} className="guide-group">
          <span className="guide-group-title">{group.title}</span>
          {group.pages.map(link)}
        </div>
      ))}
    </nav>
  );
}
