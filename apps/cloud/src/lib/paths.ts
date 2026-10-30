// CLD-20: every signed-in page sits under /cloud, and every account and repository page under
// /cloud/u/<owner>, so no account name meets a fixed path such as /cloud/settings.

export type AccountTab = "repositories" | "dashboard" | "people";

const part = encodeURIComponent;

export const CLOUD = "/cloud";
export const CLOUD_SETTINGS = "/cloud/settings";

/** The sign-in page, returning to `back` when it is a same-site path. */
export function signInPath(back?: string): string {
  return back === undefined ? "/cloud/signin" : `/cloud/signin?callbackUrl=${part(back)}`;
}

export function startPath(account?: string, done = false): string {
  return account === undefined ? "/cloud/start" : `/cloud/start/${part(account)}${done ? "/done" : ""}`;
}

export function accountPath(owner: string, tab: AccountTab = "repositories"): string {
  return `/cloud/u/${part(owner)}${tab === "repositories" ? "" : `?tab=${tab}`}`;
}

export function repoPath(owner: string, name: string): string {
  return `/cloud/u/${part(owner)}/${part(name)}`;
}

export function repoSettingsPath(owner: string, name: string): string {
  return `${repoPath(owner, name)}/settings`;
}

export function pullPath(owner: string, name: string, pull: number): string {
  return `${repoPath(owner, name)}/pull/${pull}`;
}

export function diagramPath(owner: string, name: string, pull: number, id: number): string {
  return `${pullPath(owner, name, pull)}/d/${id}`;
}
