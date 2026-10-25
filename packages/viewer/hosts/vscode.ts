// VWR-01: the viewer inside a VS Code webview. Tokens follow the editor's theme variables, and
// messages go through the webview API.
import type { WebviewMessage } from "@aisus/core/model/messages";
import { applyTokens, type Host } from "../bridge";

declare function acquireVsCodeApi(): { postMessage(message: WebviewMessage): void };

/** Each `--aisus-*` token as the VS Code theme variable it follows. */
export const VSCODE_TOKENS: Readonly<Record<string, string>> = {
  "--aisus-background": "var(--vscode-editor-background)",
  "--aisus-foreground": "var(--vscode-foreground)",
  "--aisus-muted": "var(--vscode-descriptionForeground)",
  "--aisus-accent": "var(--vscode-focusBorder)",
  "--aisus-font-size": "var(--vscode-font-size)",
  "--aisus-mono-font-family": "var(--vscode-editor-font-family)",
  "--aisus-blue": "var(--vscode-charts-blue)",
  "--aisus-green": "var(--vscode-charts-green)",
  "--aisus-purple": "var(--vscode-charts-purple)",
  "--aisus-yellow": "var(--vscode-charts-yellow)",
  "--aisus-red": "var(--vscode-charts-red)",
  "--aisus-orange": "var(--vscode-charts-orange)",
  "--aisus-shadow": "var(--vscode-widget-shadow)",
  "--aisus-border": "var(--vscode-panel-border)",
  "--aisus-hover": "var(--vscode-toolbar-hoverBackground)",
  "--aisus-active": "var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground))",
  "--aisus-widget-background": "var(--vscode-editorWidget-background)",
  "--aisus-widget-border": "var(--vscode-editorWidget-border, var(--vscode-panel-border))",
  "--aisus-tooltip-background": "var(--vscode-editorHoverWidget-background)",
  "--aisus-tooltip-foreground": "var(--vscode-editorHoverWidget-foreground)",
  "--aisus-tooltip-border": "var(--vscode-editorHoverWidget-border)",
  "--aisus-link": "var(--vscode-textLink-foreground)",
  "--aisus-link-active": "var(--vscode-textLink-activeForeground)",
  "--aisus-toggle-background": "var(--vscode-inputOption-activeBackground, var(--vscode-toolbar-hoverBackground))",
  "--aisus-toggle-foreground": "var(--vscode-inputOption-activeForeground, var(--vscode-foreground))",
  "--aisus-button-background": "var(--vscode-button-background)",
  "--aisus-button-foreground": "var(--vscode-button-foreground)",
  "--aisus-button-hover": "var(--vscode-button-hoverBackground)",
};

export function vscodeHost(): Host {
  const api = acquireVsCodeApi();
  applyTokens(document.body, VSCODE_TOKENS);
  // Text is measured on a canvas, which needs the family itself rather than a variable.
  const family = getComputedStyle(document.body).getPropertyValue("--vscode-font-family").trim();
  document.body.style.setProperty("--aisus-font-family", family || "sans-serif");
  return {
    post: (message) => api.postMessage(message),
    listen: (handler) => window.addEventListener("message", (event) => handler(event.data)),
  };
}
