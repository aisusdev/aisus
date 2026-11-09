// Watches `<folder>/.aisus/sessions/` in every workspace folder for the lock and each run's
// `session.json`, and reloads the session panel (ADR 0034). Reuses the ChangeBatch debounce of the diagram watcher;
// no notifications — a learning session writes session.json every turn. When the lock goes,
// the session's hook entries go with it (spec v0.3 SAF-06). While the lock exists it is also
// checked once a second, because the watcher can miss its deletion on Linux (P-2).
import { existsSync } from "node:fs";
import { basename, join, sep } from "node:path";
import * as vscode from "vscode";
import { ACTIVE_FILE, SESSIONS_DIR } from "@aisus/core/model/session";
import { removeHooksWhenIdle } from "./hooksFiles";
import { onAction } from "./notify";
import { SessionPanel } from "./sessionPanel";
import { ChangeBatch, LockPoll, sessionPathOf } from "./watchLogic";

export class SessionWatcher implements vscode.Disposable {
  private readonly watchers = new Map<string, vscode.FileSystemWatcher[]>();
  private readonly lockPolls = new Map<string, LockPoll>();
  private readonly batch = new ChangeBatch((changes) => this.flush(changes));
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly folderListener: vscode.Disposable;

  /** Fires after a session changed, for the sidebar's session section. */
  readonly onDidChange = this.changed.event;

  constructor() {
    this.watch(vscode.workspace.workspaceFolders ?? []);
    this.folderListener = vscode.workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
      for (const folder of removed) {
        for (const watcher of this.watchers.get(folder.uri.toString()) ?? []) watcher.dispose();
        this.watchers.delete(folder.uri.toString());
        this.lockPolls.get(folder.uri.toString())?.dispose();
        this.lockPolls.delete(folder.uri.toString());
      }
      this.watch(added);
    });
  }

  private watch(folders: readonly vscode.WorkspaceFolder[]): void {
    for (const folder of folders) {
      const root = folder.uri.fsPath;
      const lock = join(root, SESSIONS_DIR, ACTIVE_FILE);
      const poll = new LockPoll(() => existsSync(lock), () => this.batch.add(lock, false));
      // The two folders are in the pattern, so their creation and deletion are seen even when
      // nothing inside them is.
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, `{.aisus,${SESSIONS_DIR},${SESSIONS_DIR}/**}`));
      const onEvent = (kind: "create" | "change" | "delete") => (uri: vscode.Uri): void => {
        const path = sessionPathOf(root, uri.fsPath, sep);
        if (path === undefined) return;
        poll.start();
        // A deleted folder takes the lock with it.
        if (path === "folder") {
          if (kind === "delete") this.batch.add(lock, false);
        } else this.batch.add(uri.fsPath, kind === "create");
      };
      watcher.onDidCreate(onEvent("create"));
      watcher.onDidChange(onEvent("change"));
      watcher.onDidDelete(onEvent("delete"));
      this.watchers.set(folder.uri.toString(), [watcher]);
      this.lockPolls.set(folder.uri.toString(), poll);
      poll.start();
    }
  }

  private flush(changes: ReadonlyMap<string, boolean>): void {
    for (const file of changes.keys()) {
      const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file));
      if (basename(file) !== "active" || folder === undefined) continue;
      try {
        removeHooksWhenIdle(folder.uri.fsPath);
      } catch (error) {
        const root = folder.uri.fsPath;
        onAction(vscode.window.showWarningMessage(`The learning session ended, but its Devin hooks could not be removed: ${(error as Error).message}`, "Try Again"), "Try Again", () => removeHooksWhenIdle(root));
      }
    }
    this.changed.fire();
    const panel = SessionPanel.current;
    if (panel === undefined) return;
    for (const file of changes.keys()) {
      const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file));
      if (folder !== undefined && folder.uri.fsPath === panel.root) {
        panel.reload();
        return;
      }
    }
  }

  dispose(): void {
    this.batch.dispose();
    this.changed.dispose();
    this.folderListener.dispose();
    for (const watchers of this.watchers.values()) for (const watcher of watchers) watcher.dispose();
    this.watchers.clear();
    for (const poll of this.lockPolls.values()) poll.dispose();
    this.lockPolls.clear();
  }
}
