// The `aisus.skillScope` setting (SET-01).
import * as vscode from "vscode";
import type { SkillScope } from "@aisus/core/install/skillFiles";

/** Where skills install: `project` (the default, the repository's own folders) or `user`. */
export function configuredScope(): SkillScope {
  return vscode.workspace.getConfiguration("aisus").get<SkillScope>("skillScope", "project") === "user" ? "user" : "project";
}
