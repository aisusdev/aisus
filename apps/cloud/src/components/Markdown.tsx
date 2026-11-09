// Renders parsed markdown as React elements; text is always text.
import type { ReactNode } from "react";
import type { Block, Inline } from "../lib/markdown";
import { MermaidDiagram } from "./MermaidDiagram";

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, index) => {
        switch (span.kind) {
          case "text":
            return span.text;
          case "code":
            return <code key={index}>{span.text}</code>;
          case "strong":
            return <strong key={index}>{span.text}</strong>;
          case "em":
            return <em key={index}>{span.text}</em>;
          case "link":
            return (
              <a key={index} href={span.href} {...(/^https?:/.test(span.href) ? { rel: "noopener noreferrer" } : {})}>
                {span.text}
              </a>
            );
        }
      })}
    </>
  );
}

// The page's title is its h1, so a `##` heading renders as h2 and a stray `#` heading as h2 too.
function heading(level: number, id: string, children: ReactNode) {
  const Tag = `h${Math.min(Math.max(level, 2), 6)}` as "h2";
  return (
    <Tag id={id} key={id}>
      {children}
    </Tag>
  );
}

export function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <div className="markdown">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return heading(block.level, block.id, <Spans spans={block.spans} />);
          case "paragraph":
            return (
              <p key={index}>
                <Spans spans={block.spans} />
              </p>
            );
          case "image":
            return <img key={index} src={block.src} alt={block.alt} />;
          case "list": {
            const items = block.items.map((item, at) => (
              <li key={at}>
                <Spans spans={item} />
              </li>
            ));
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
          case "code":
            if (block.lang === "mermaid") return <MermaidDiagram key={index} source={block.text} />;
            return (
              <pre key={index}>
                <code>{block.text}</code>
              </pre>
            );
          case "table":
            return (
              <table key={index}>
                <thead>
                  <tr>
                    {block.head.map((cell, at) => (
                      <th key={at}>
                        <Spans spans={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, at) => (
                    <tr key={at}>
                      {row.map((cell, col) => (
                        <td key={col}>
                          <Spans spans={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "quote":
            return (
              <blockquote key={index}>
                <Spans spans={block.spans} />
              </blockquote>
            );
          case "rule":
            return <hr key={index} />;
        }
      })}
    </div>
  );
}
