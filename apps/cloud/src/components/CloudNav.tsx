"use client";
// CLD-20: the cloud header's links, marking the one for the page the user is on.
import { usePathname } from "next/navigation";
import { CLOUD, CLOUD_SETTINGS } from "../lib/paths";

export function CloudNav() {
  const path = usePathname();
  const settings = path === CLOUD_SETTINGS;
  return (
    <nav className="cloud-nav" aria-label="Cloud">
      <a href={CLOUD} aria-current={settings ? undefined : "page"}>Repositories</a>
      <a href={CLOUD_SETTINGS} aria-current={settings ? "page" : undefined}>Settings</a>
    </nav>
  );
}
