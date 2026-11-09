// CLD-08: the documents the site publishes, read from the repository at request time.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releasesRepo } from "./install";
import { parseMarkdown, type Block, type Inline } from "./markdown";

/** Published pages: `slug` under /docs, the repository file it renders, and its group in the guide's panel. */
export const PUBLISHED_DOCS: readonly { slug: string; file: string; title: string; group: DocGroup }[] = [
  { slug: "", file: "README.md", title: "Overview", group: "Use aisus" },
  { slug: "github-action", file: "docs/github-action.md", title: "GitHub Action", group: "Use aisus" },
  { slug: "cloud", file: "docs/cloud.md", title: "aisus cloud", group: "Use aisus" },
  { slug: "contributing", file: "CONTRIBUTING.md", title: "Contributing", group: "Contribute" },
  { slug: "maintaining", file: "docs/maintaining.md", title: "Maintaining", group: "Contribute" },
  { slug: "architecture", file: "docs/architecture.md", title: "Architecture", group: "Contribute" },
];

export type DocGroup = "Use aisus" | "Contribute";

/** A page in the guide's panel, with the sections listed under it. */
export interface TreePage {
  href: string;
  label: string;
  steps: { id: string; label: string }[];
}

/** The docs' groups, each with its pages and their sections, in the panel's order. */
export function docTree(): { title: DocGroup; pages: TreePage[] }[] {
  const groups: { title: DocGroup; pages: TreePage[] }[] = [];
  for (const doc of PUBLISHED_DOCS) {
    const page = { href: pagePath(doc.slug), label: doc.title, steps: loadDoc(doc.slug)?.sections ?? [] };
    const group = groups.find((entry) => entry.title === doc.group);
    if (group) group.pages.push(page);
    else groups.push({ title: doc.group, pages: [page] });
  }
  return groups;
}

function pagePath(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

/** The folder of images the docs pages may show, served under /docs/media/. */
export const MEDIA_DIR = "docs/media";

/** A plain PNG or GIF file name, the kinds /docs/media/ serves. */
export const MEDIA_FILE = /^[a-z0-9][a-z0-9-]*\.(png|gif)$/;

/** The docs page a repository-relative markdown link points at, or `null` when it is not published. */
export function docPath(from: string, href: string): string | null {
  const path = resolvePath(from, href);
  const doc = PUBLISHED_DOCS.find((entry) => entry.file === path);
  return doc === undefined ? null : pagePath(doc.slug);
}

/** The address of a repository-relative image under docs/media/, or `null` for any other image. */
export function docImage(from: string, src: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("/")) return null;
  const path = resolvePath(from, src);
  const file = path.startsWith(`${MEDIA_DIR}/`) ? path.slice(MEDIA_DIR.length + 1) : "";
  return MEDIA_FILE.test(file) ? `/docs/media/${file}` : null;
}

/** A path relative to the file `from`, resolved against the repository root. */
function resolvePath(from: string, href: string): string {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const parts: string[] = [];
  for (const part of `${base}${href}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

/** The repository root: the cloud runs from apps/cloud/. */
export function repositoryRoot(): string {
  return join(process.cwd(), "../..");
}

export interface Doc {
  title: string;
  path: string;
  /** The file on GitHub. */
  source: string;
  /** The file's blocks without its first `#` heading, which the page's title replaces. */
  blocks: Block[];
  /** The `##` headings, for On this page and the panel. */
  sections: { id: string; label: string }[];
}

export function loadDoc(slug: string): Doc | null {
  const doc = PUBLISHED_DOCS.find((entry) => entry.slug === slug);
  if (!doc) return null;
  // The build traces the published files through outputFileTracingIncludes in next.config.ts.
  const text = readFileSync(join(/*turbopackIgnore: true*/ repositoryRoot(), doc.file), "utf8");
  const parsed = parseMarkdown(text, (href) => docPath(doc.file, href), (src) => docImage(doc.file, src));
  const top = parsed.findIndex((block) => block.kind === "heading" && block.level === 1);
  const blocks = top < 0 ? parsed : parsed.filter((_, index) => index !== top);
  const sections = blocks.flatMap((block) => (block.kind === "heading" && block.level === 2 ? [{ id: block.id, label: plain(block.spans) }] : []));
  return { title: doc.title, path: pagePath(slug), source: `https://github.com/${releasesRepo()}/blob/main/${doc.file}`, blocks, sections };
}

function plain(spans: Inline[]): string {
  return spans.map((span) => span.text).join("");
}
