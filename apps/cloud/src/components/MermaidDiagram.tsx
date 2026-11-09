"use client";
// Draws a Mermaid diagram in the browser (ADR 0075). The library loads only when a diagram is on the page, from this
// site. The source shows as a code block until the diagram is drawn, and stays if drawing fails. The strict security
// level leaves scripts and click handlers out of the drawing.
import { useEffect, useId, useState } from "react";

export function MermaidDiagram({ source }: { source: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: '"Avenir Next", Avenir, "Helvetica Neue", system-ui, sans-serif',
          // Diagrams keep their natural size, and a wide one scrolls inside its box rather than shrinking its text.
          flowchart: { useMaxWidth: false },
          sequence: { useMaxWidth: false },
          themeVariables: {
            primaryColor: "#eaf0e8",
            primaryBorderColor: "#477646",
            primaryTextColor: "#142b22",
            lineColor: "#4f6055",
            secondaryColor: "#f7f9f4",
            tertiaryColor: "#ffffff",
            clusterBkg: "#f7f9f4",
            clusterBorder: "#b8c6b5",
            edgeLabelBackground: "#ffffff",
          },
        });
        const drawn = await mermaid.render(id, source);
        if (live) setSvg(drawn.svg);
      } catch {
        // The source stays on the page.
      }
    })();
    return () => {
      live = false;
    };
  }, [id, source]);
  if (svg === null) {
    return (
      <pre>
        <code>{source}</code>
      </pre>
    );
  }
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
