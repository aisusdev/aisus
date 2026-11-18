// Opens a figure's live map in a dialog over the report when the figure is clicked. The dialog
// fills most of the window, and the map inside pans and zooms as in the aisus viewer. Close, a
// click beside the dialog or Escape closes it. Without this script, the figure's link opens the
// live map as its own page.

const dialog = document.createElement("dialog");
dialog.className = "figure-dialog";
const bar = document.createElement("div");
bar.className = "figure-dialog__bar";
const title = document.createElement("p");
title.className = "figure-dialog__title";
const close = document.createElement("button");
close.type = "button";
close.className = "figure-dialog__close";
close.textContent = "Close";
const frame = document.createElement("iframe");
frame.className = "figure-dialog__map";
bar.append(title, close);
dialog.append(bar, frame);
document.body.append(dialog);

function open(link) {
  const caption = link.closest("figure")?.querySelector("figcaption")?.textContent?.trim() ?? "";
  title.textContent = caption;
  dialog.setAttribute("aria-label", caption);
  frame.title = caption;
  frame.src = link.href;
  dialog.showModal();
  close.focus();
}

close.addEventListener("click", () => dialog.close());
// A click on the backdrop lands on the dialog element itself.
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
// The map stops when the dialog closes, and the next figure starts from a fresh view.
dialog.addEventListener("close", () => frame.removeAttribute("src"));
// The figure page asks to close when Escape is pressed inside the map.
window.addEventListener("message", (event) => {
  if (event.source === frame.contentWindow && event.data?.type === "aisus-close-figure") dialog.close();
});

document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest('figure a[href$=".html"]') : null;
  if (link === null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  open(link);
});
