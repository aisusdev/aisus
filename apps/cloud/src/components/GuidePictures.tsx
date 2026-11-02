// The Get Started page's two pictures: VS Code in its Light Modern colours, with pink numbers that match the steps
// beside them. Screen readers get one description each, because a picture stands for the editor.
import type { ReactNode } from "react";

function Num({ n }: { n: number }) {
  return <span className="gs-num" aria-hidden="true">{n}</span>;
}

function Window({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="guide-shot" role="img" aria-label={label}>
      <div className="fd fd-window">
        <div className="fd-titlebar"><i className="r" /><i className="y" /><i className="g" /><span>aisus</span></div>
        <div className="fd-body">{children}</div>
      </div>
    </figure>
  );
}

const MAP_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="8.5" y="2.5" width="7" height="5" rx="1" />
    <rect x="2.5" y="16.5" width="7" height="5" rx="1" />
    <rect x="14.5" y="16.5" width="7" height="5" rx="1" />
    <path d="M12 7.5v4.5M6 16.5V12h12v4.5" />
  </svg>
);
const FILES_ICON = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5" /></svg>;
const SEARCH_ICON = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></svg>;
const EXTENSIONS_ICON = <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="7" height="7" /><rect x="10" y="11" width="7" height="7" /><rect x="3" y="4" width="7" height="7" /><rect x="13.5" y="2.5" width="7" height="7" transform="rotate(45 17 6)" /></svg>;

export function VsixPicture() {
  return (
    <Window label="The Extensions view in VS Code, with its ⋯ menu open and Install from VSIX… selected">
      <div className="fd-activity">
        {FILES_ICON}
        {SEARCH_ICON}
        <span className="on">{EXTENSIONS_ICON}</span>
        {MAP_ICON}
      </div>
      <div className="gs-side">
        <div className="gs-side-head"><span>EXTENSIONS</span><span className="gs-more">⋯<Num n={2} /></span></div>
        <div className="gs-search">Search Extensions in Marketplace</div>
        <div className="gs-group">INSTALLED</div>
        <div className="gs-row"><span className="gs-tile" /><span className="gs-lines"><i /><i /></span></div>
        <div className="gs-row"><span className="gs-tile" /><span className="gs-lines"><i /><i /></span></div>
        <div className="gs-menu">
          <span>Enable All Extensions</span>
          <span>Disable All Extensions</span>
          <hr />
          <span className="on">Install from VSIX…<Num n={3} /></span>
          <hr />
          <span>Show Running Extensions</span>
        </div>
      </div>
    </Window>
  );
}

export function GeneratePicture() {
  return (
    <Window label="The aisus sidebar in VS Code, with checkout flow typed as the focus, the Generate button, and the agent picker listing Claude Code, Codex and Devin">
      <div className="fd-activity">
        {FILES_ICON}
        {SEARCH_ICON}
        <span className="on">{MAP_ICON}<Num n={1} /></span>
      </div>
      <div className="gs-side">
        <div className="gs-side-head"><span>AISUS</span></div>
        <div className="gs-input">checkout flow<Num n={2} /></div>
        <div className="gs-button">Generate<Num n={3} /></div>
        <div className="gs-links"><span>Copy prompt for…</span><span>Draw a sequence map</span></div>
        <div className="gs-group">MAPS</div>
        <div className="gs-map">Architecture</div>
        <div className="gs-map">Payments flow</div>
        <div className="gs-pick">
          <div className="gs-pick-input">Choose an agent</div>
          <span className="on">Claude Code<Num n={4} /></span>
          <span>Codex</span>
          <span>Devin</span>
        </div>
      </div>
    </Window>
  );
}
