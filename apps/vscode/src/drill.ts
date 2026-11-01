// VWR-05: "Map This Box in Detail" in a box's menu runs Generate focused on the box, and the new map
// records the map and the box it came from. The box then opens its detail map, and the detail map
// shows the maps above it.
import { basename, dirname } from "node:path";
import * as vscode from "vscode";
import { confirmAndLaunch, type LaunchTask } from "./generate";
import { ArchitecturePanel } from "./panel";
import type { Runs } from "./runs";

/** Generate focused on box `box`, labelled `label`, of the map in run folder `parent`. */
export function drillTask(label: string, parent: string, box: string): LaunchTask {
  return { skill: "aisus-architecture", args: `${label.trim()} --parent ${parent} --box ${box}`, title: `${label.trim()} in detail` };
}

/** Runs Generate on the box of the shown map that the box menu names. */
export async function drillDownCommand(context: vscode.ExtensionContext, runs: Runs, box?: { componentId?: unknown }): Promise<void> {
  const panel = ArchitecturePanel.current;
  const component = panel?.components().find((entry) => entry.id === box?.componentId);
  if (!panel || !component || panel.file === "") return;
  await confirmAndLaunch(context, runs, panel.root, drillTask(component.label, basename(dirname(panel.file)), component.id));
}

/** Opens the detail map of the box the box menu names. */
export function openDetailCommand(box?: { componentId?: unknown }): void {
  if (typeof box?.componentId === "string") ArchitecturePanel.current?.openDetail(box.componentId);
}
