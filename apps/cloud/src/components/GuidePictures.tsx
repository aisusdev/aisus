// The guide's pictures: VS Code in its Light Modern colours and a JetBrains IDE's Settings, with pink numbers that
// match the steps beside them. Screen readers get one description each, because a picture stands for the editor.
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

export function PluginsPicture() {
  return (
    <figure className="guide-shot" role="img" aria-label="The Plugins page of a JetBrains IDE's Settings, with the gear menu open and Install Plugin from Disk… selected">
      <div className="fd fd-window ij-window">
        <div className="fd-titlebar"><i className="r" /><i className="y" /><i className="g" /><span>Settings</span></div>
        <div className="fd-body">
          <div className="ij-tree">
            <div className="ij-search">Search</div>
            <span>Appearance &amp; Behavior</span>
            <span>Keymap</span>
            <span>Editor</span>
            <span className="on">Plugins<Num n={2} /></span>
            <span>Version Control</span>
            <span>Tools</span>
          </div>
          <div className="ij-main">
            <div className="ij-head">
              <span className="ij-tab">Marketplace</span>
              <span className="ij-tab on">Installed</span>
              <span className="ij-gear">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>
                <Num n={3} />
              </span>
            </div>
            <div className="gs-row"><span className="gs-tile" /><span className="gs-lines"><i /><i /></span></div>
            <div className="gs-row"><span className="gs-tile" /><span className="gs-lines"><i /><i /></span></div>
            <div className="ij-menu">
              <span>Manage Plugin Repositories…</span>
              <span>HTTP Proxy Settings…</span>
              <hr />
              <span className="on">Install Plugin from Disk…<Num n={4} /></span>
              <hr />
              <span>Disable All Downloaded Plugins</span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Pull request #10 on the aisus repository, with the comment /aisus-pr left on it and the diagram it drew. */
export function PullRequestPicture() {
  return (
    <figure className="guide-shot" role="img" aria-label="Pull request #10 on the aisus repository, with the comment /aisus-pr left on it: the diagram of the change, a link to its page in aisus cloud, and the commit it was drawn from">
      <div className="fd fd-window">
        <div className="fd-titlebar"><i className="r" /><i className="y" /><i className="g" /><span>github.com/aisusdev/aisus/pull/10</span></div>
        <div className="fd-pr pr-page">
          <div className="fd-pr-title">PRC-07: pull request diagrams from the aisus-pr skill <span>#10</span></div>
          <div className="fd-pr-meta"><span className="fd-open">Open</span>7 commits into main from prc-07</div>
          <div className="fd-comment on">
            <div className="fd-comment-head"><span className="fd-avatar" /><b>xplus2g4</b> commented</div>
            <div className="fd-comment-body">
              <div className="pr-diagram">
                <img src="/aisus-pr-10.png" alt="" width="1126" height="1100" />
                <Num n={1} />
              </div>
              <div className="fd-legend-foot">
                <span className="pr-mark fd-link">Open in aisus cloud<Num n={2} /></span> · <span className="pr-mark">drawn from <code>d59fc01</code><Num n={3} /></span> by /aisus-pr
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
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
