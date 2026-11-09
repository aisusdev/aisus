// CLD-08: the documents the site publishes, read from the repository at request time.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown, type Block } from "./markdown";

/** Published pages: `slug` under /docs, the repository file it renders. */
export const PUBLISHED_DOCS: readonly { slug: string; file: string; title: string }[] = [
  { slug: "", file: "README.md", title: "Overview" },
  { slug: "architecture", file: "docs/architecture.md", title: "Architecture" },
  { slug: "github-action", file: "docs/github-action.md", title: "GitHub Action" },
  { slug: "contributing", file: "CONTRIBUTING.md", title: "Contributing" },
  { slug: "maintaining", file: "docs/maintaining.md", title: "Maintaining" },
];

/** The folder of images the docs pages may show, served under /docs/media/. */
export const MEDIA_DIR = "docs/media";

/** A plain PNG file name, the only kind /docs/media/ serves. */
export const MEDIA_FILE = /^[a-z0-9][a-z0-9-]*\.png$/;

/** The docs page a repository-relative markdown link points at, or `null` when it is not published. */
export function docPath(from: string, href: string): string | null {
  const path = resolvePath(from, href);
  const doc = PUBLISHED_DOCS.find((entry) => entry.file === path);
  return doc === undefined ? null : doc.slug === "" ? "/docs" : `/docs/${doc.slug}`;
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

export function loadDoc(slug: string): { title: string; blocks: Block[] } | null {
  const doc = PUBLISHED_DOCS.find((entry) => entry.slug === slug);
  if (!doc) return null;
  // The build traces the published files through outputFileTracingIncludes in next.config.ts.
  const text = readFileSync(join(/*turbopackIgnore: true*/ repositoryRoot(), doc.file), "utf8");
  return { title: doc.title, blocks: parseMarkdown(text, (href) => docPath(doc.file, href), (src) => docImage(doc.file, src)) };
}
