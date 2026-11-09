// PATH lookup shared by the agent launchers and git (SAF-04, SAF-07). Only absolute PATH
// entries count, so a binary inside the opened repository is never picked up.
import { accessSync, constants, statSync } from "node:fs";
import { join, posix, win32 } from "node:path";

function isExecutableFile(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first executable `cli` on `env.PATH`, or `undefined`. On Windows a file counts only with
 * one of `env.PATHEXT`'s extensions, because Windows cannot run a file without one, such as the
 * shell script npm installs beside `claude.cmd`. Relative entries such as `.` or `bin` are
 * skipped, so a binary inside the opened repository is never picked up (SAF-04).
 */
export function findOnPath(cli: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string | undefined {
  const pathValue = env["PATH"] ?? env["Path"] ?? "";
  const extensions = platform === "win32" ? (env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  const absolute = platform === "win32" ? win32.isAbsolute : posix.isAbsolute;
  for (const dir of pathValue.split(platform === "win32" ? win32.delimiter : posix.delimiter)) {
    if (!absolute(dir)) continue;
    for (const extension of extensions) {
      const candidate = join(dir, cli + extension);
      if (isExecutableFile(candidate, platform)) return candidate;
    }
  }
  return undefined;
}
