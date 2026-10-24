// IDE-01: the viewer in the IntelliJ plugin's JCEF browser. The plugin's page defines
// `window.aisusPost(json)` before the viewer's script, which hands a message to Kotlin through a
// JBCefJSQuery, and sets `window.aisusDark` from the IDE's theme. The plugin sends its messages by
// calling `window.aisusReceive(message)`.
import type { HostMessage, WebviewMessage } from "../../src/model/messages";
import { applyTokens, type Host } from "../bridge";
import { DARK, LIGHT } from "./standalone";

/** What the plugin's page puts on `window` for the host. */
export interface JcefWindow {
  aisusPost?: (json: string) => void;
  aisusReceive?: (message: HostMessage) => void;
  aisusDark?: boolean;
}

export function jcefHost(page: JcefWindow = window as unknown as JcefWindow, body: HTMLElement = document.body): Host {
  applyTokens(body, page.aisusDark === true ? DARK : LIGHT);
  return {
    post: (message: WebviewMessage) => page.aisusPost?.(JSON.stringify(message)),
    listen: (handler) => {
      page.aisusReceive = handler;
    },
  };
}
