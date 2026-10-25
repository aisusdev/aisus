// The shared viewer (VWR-01) on a cloud page: the map's data in a JSON script, the viewer bundle,
// and the element it mounts in. Every string reaches the page as escaped JSON or text. The bundle
// starts after React has hydrated the page, so the map it draws stays in place.
import Script from "next/script";
import { escapeJson, type PageData } from "@aisus/core/model/page";

export function MapViewer({ data }: { data: PageData }) {
  return (
    <>
      <link rel="stylesheet" href="/viewer.css" />
      <div id="aisus-viewer" className="map-shell" />
      <script type="application/json" id="aisus-data" dangerouslySetInnerHTML={{ __html: escapeJson(JSON.stringify(data)) }} />
      <Script src="/viewer.js" strategy="afterInteractive" />
    </>
  );
}
