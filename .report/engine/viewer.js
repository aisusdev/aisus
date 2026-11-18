// The report's aisus viewing engine: the aisus map viewer in a figure page. It reads the map from
// the page's data script and draws it in the light palette with the report's typeface. A clicked
// box or message opens its cited lines on GitHub. `window.aisus.image(format)` returns the drawn
// map as the viewer's Save Image output, or null until the map is drawn. diagrams.mjs bundles this
// file into aisus-viewer.js.
import { openLink } from "@aisus/core/model/openLinks";
import { readDiagram } from "@aisus/core/model/tolerant";
import { applyTokens, useHost } from "@aisus/viewer/bridge";
import { LIGHT } from "@aisus/viewer/hosts/standalone";
import { startViewer } from "@aisus/viewer/viewer";

const FONT = '"Avenir Next", "Helvetica Neue", system-ui, sans-serif';

const data = JSON.parse(document.getElementById("aisus-data")?.textContent ?? "{}");
const context = { root: null, project: null, repository: data.repository ?? null };
const read = readDiagram(data.doc);
const components = read.ok ? read.diagram.components : [];

/** Image requests waiting for the viewer's answer, by request number. */
const waiting = new Map();
let nextRequest = 0;
let send = () => {};

applyTokens(document.body, { ...LIGHT, "--aisus-font-family": FONT });
useHost({
  post(message) {
    if (message.type === "openSource") {
      const source = components.find((component) => component.id === message.componentId)?.sources[message.index];
      const link = source === undefined ? null : openLink("github", source, context);
      if (link !== null) window.open(link, "_blank", "noopener");
    }
    if (message.type === "image") {
      waiting.get(message.request)?.(message.data);
      waiting.delete(message.request);
    }
  },
  listen(handler) {
    send = handler;
    queueMicrotask(() => handler({ type: "load", doc: data.doc, file: data.title }));
  },
});
startViewer();

window.aisus = {
  image(format = "svg") {
    return new Promise((resolve) => {
      const request = nextRequest++;
      waiting.set(request, resolve);
      send({ type: "image", request, format });
    });
  },
};
