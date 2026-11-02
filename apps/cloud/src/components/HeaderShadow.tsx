"use client";
// The header, on the site and in the cloud, shows its shadow once the page has scrolled away from the top.
import { useEffect } from "react";

export function HeaderShadow() {
  useEffect(() => {
    const header = document.querySelector(".site-header, .cloud-header");
    if (!header) return;
    const update = () => header.classList.toggle("scrolled", window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return null;
}
