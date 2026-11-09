// CLD-08: the docs, rendered from the repository's README and docs/ in the guide's layout. The left panel holds the
// guide and the docs with the page being read open, and On this page lists the page's sections.
import { notFound } from "next/navigation";
import { GuideTree } from "../../../../components/GuideTree";
import { Markdown } from "../../../../components/Markdown";
import { docTree, loadDoc } from "../../../../lib/docs";

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const doc = slug.length > 1 ? null : loadDoc(slug[0] ?? "");
  if (!doc) notFound();
  return (
    <main className="guide-page docs-page">
      <div className="wrap guide-layout">
        <GuideTree current={doc.path} docs={docTree()} />
        <article className="guide-article">
          <header className="guide-intro">
            <h1>{doc.title}</h1>
            <p className="guide-updated"><a href={doc.source} rel="noopener noreferrer">View on GitHub ↗</a></p>
          </header>
          <Markdown blocks={doc.blocks} />
        </article>
        {doc.sections.length > 0 && (
          <aside className="guide-aside" aria-label="On this page">
            <strong>On this page</strong>
            {doc.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
          </aside>
        )}
      </div>
    </main>
  );
}
