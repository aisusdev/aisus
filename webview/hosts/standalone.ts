// VWR-01: the viewer outside VS Code, in the diagram page (RCH-01) and the cloud site. Tokens come
// from a light and a dark palette that follow the system setting.
import type { HostMessage, WebviewMessage } from "@aisus/core/model/messages";
import { applyTokens, type Host } from "../bridge";

const SHARED: Readonly<Record<string, string>> = {
  "--aisus-font-family": 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--aisus-font-size": "13px",
  "--aisus-mono-font-family": 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

export const LIGHT: Readonly<Record<string, string>> = {
  ...SHARED,
  "--aisus-background": "#ffffff",
  "--aisus-foreground": "#1f2328",
  "--aisus-muted": "#59636e",
  "--aisus-accent": "#0969da",
  "--aisus-blue": "#0969da",
  "--aisus-green": "#1a7f37",
  "--aisus-purple": "#8250df",
  "--aisus-yellow": "#9a6700",
  "--aisus-red": "#cf222e",
  "--aisus-orange": "#bc4c00",
  "--aisus-shadow": "rgba(31, 35, 40, 0.15)",
  "--aisus-border": "#d1d9e0",
  "--aisus-hover": "rgba(129, 139, 152, 0.15)",
  "--aisus-active": "rgba(129, 139, 152, 0.25)",
  "--aisus-widget-background": "#f6f8fa",
  "--aisus-widget-border": "#d1d9e0",
  "--aisus-tooltip-background": "#ffffff",
  "--aisus-tooltip-foreground": "#1f2328",
  "--aisus-tooltip-border": "#d1d9e0",
  "--aisus-link": "#0969da",
  "--aisus-link-active": "#0550ae",
  "--aisus-toggle-background": "#ddf4ff",
  "--aisus-toggle-foreground": "#0969da",
  "--aisus-button-background": "#1f883d",
  "--aisus-button-foreground": "#ffffff",
  "--aisus-button-hover": "#1a7f37",
};

export const DARK: Readonly<Record<string, string>> = {
  ...SHARED,
  "--aisus-background": "#0d1117",
  "--aisus-foreground": "#e6edf3",
  "--aisus-muted": "#9198a1",
  "--aisus-accent": "#4493f8",
  "--aisus-blue": "#4493f8",
  "--aisus-green": "#3fb950",
  "--aisus-purple": "#ab7df8",
  "--aisus-yellow": "#d29922",
  "--aisus-red": "#f85149",
  "--aisus-orange": "#db6d28",
  "--aisus-shadow": "rgba(1, 4, 9, 0.6)",
  "--aisus-border": "#3d444d",
  "--aisus-hover": "rgba(101, 108, 118, 0.2)",
  "--aisus-active": "rgba(101, 108, 118, 0.3)",
  "--aisus-widget-background": "#151b23",
  "--aisus-widget-border": "#3d444d",
  "--aisus-tooltip-background": "#151b23",
  "--aisus-tooltip-foreground": "#e6edf3",
  "--aisus-tooltip-border": "#3d444d",
  "--aisus-link": "#4493f8",
  "--aisus-link-active": "#79c0ff",
  "--aisus-toggle-background": "#121d2f",
  "--aisus-toggle-foreground": "#4493f8",
  "--aisus-button-background": "#238636",
  "--aisus-button-foreground": "#ffffff",
  "--aisus-button-hover": "#2ea043",
};

export interface StandaloneOptions {
  /** What the viewer's requests do outside VS Code, such as opening a source. */
  post(message: WebviewMessage): void;
  /** Messages delivered once the viewer listens, such as the embedded diagram. */
  messages: HostMessage[];
}

export function standaloneHost(options: StandaloneOptions): Host {
  const dark = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const apply = (): void => applyTokens(document.body, dark?.matches === true ? DARK : LIGHT);
  apply();
  dark?.addEventListener("change", apply);
  return {
    post: options.post,
    listen: (handler) => {
      for (const message of options.messages) queueMicrotask(() => handler(message));
    },
  };
}
