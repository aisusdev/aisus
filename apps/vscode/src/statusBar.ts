// UI-04: one right-aligned status bar item. "aisus" when idle, the run's clock while one goes,
// and the shown map's changed boxes once the change overlay reports them. A click opens the sidebar.
import * as vscode from "vscode";
import { statusText } from "@aisus/core/model/home";
import type { CloudStatus } from "@aisus/core/model/messages";
import type { Runs } from "./runs";

export class StatusItem implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem("aisus.status", vscode.StatusBarAlignment.Right, 100);
  private readonly listener: vscode.Disposable;
  private timer: NodeJS.Timeout | undefined;
  private changedBoxes = 0;

  constructor(private readonly runs: Runs) {
    this.item.name = "aisus";
    this.item.command = "aisus.home.focus";
    this.item.tooltip = "Open the aisus sidebar";
    this.listener = runs.onDidChange(() => this.update());
    this.update();
    this.item.show();
  }

  /** The text shown now, for the e2e tests. */
  get text(): string {
    return this.item.text;
  }

  /** Edited or missing boxes in the shown map (FRS-04 reports them). */
  set changed(count: number) {
    this.changedBoxes = count;
    this.update();
  }

  private update(): void {
    const card = this.runs.current;
    const runningSince = card?.status === "running" ? card.startedAt : null;
    const text = statusText({ runningSince, changed: this.changedBoxes }, new Date());
    this.item.text = text === "aisus" ? "$(type-hierarchy-sub) aisus" : text;
    if (runningSince !== null && this.timer === undefined) this.timer = setInterval(() => this.update(), 1000);
    if (runningSince === null && this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  dispose(): void {
    clearInterval(this.timer);
    this.listener.dispose();
    this.item.dispose();
  }
}

/**
 * CLD-19: a status bar item that shows only while aisus cloud can't be reached, so the outage shows
 * with the sidebar closed. A click opens the sidebar, whose cloud strip offers Try again.
 */
export class CloudWarningItem implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem("aisus.cloudWarning", vscode.StatusBarAlignment.Right, 99);
  private shown = false;

  constructor() {
    this.item.name = "aisus cloud";
    this.item.command = "aisus.home.focus";
    this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  }

  /** The text shown now, or `null` while hidden, for the e2e tests. */
  get text(): string | null {
    return this.shown ? this.item.text : null;
  }

  set status(status: CloudStatus) {
    this.shown = status.state === "unreachable";
    if (status.state !== "unreachable") {
      this.item.hide();
      return;
    }
    this.item.text = `$(cloud) ${status.host} unreachable`;
    this.item.tooltip = `aisus cloud can't be reached at ${status.host}. Open the aisus sidebar to try again.`;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
