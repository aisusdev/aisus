// CLD-08: the signed-out landing page. Its words are the approved copy, and pricing shows the price texts of
// billing's configuration, or that this server gives every account everything when billing is off.
import type { ReactNode } from "react";
import type { BillingConfig } from "../../plans";
import { ProductFrame } from "./ProductFrame";

const BOX = { fill: "#14181d", stroke: "rgba(255,255,255,.18)" };

/** A box of the map, drawn without words. */
function Node({ x, y, w = 150, h = 64, tone }: { x: number; y: number; w?: number; h?: number; tone?: "on" | "edited" | "new" | "moved" }) {
  const stroke = tone === "on" ? "#c5f24a" : tone === "edited" ? "#f5b14c" : tone === "moved" ? "#7cc4ff" : tone === "new" ? "rgba(197,242,74,.7)" : BOX.stroke;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={tone === "new" ? "rgba(197,242,74,.05)" : BOX.fill} stroke={stroke} strokeWidth={tone ? 1.8 : 1.2} strokeDasharray={tone === "new" ? "6 5" : undefined} />
      <rect x={x + 14} y={y + 16} width="22" height="22" rx="6" fill="none" stroke={tone === "on" ? "rgba(197,242,74,.6)" : "rgba(255,255,255,.22)"} />
      <rect x={x + 46} y={y + 22} width={w - 76} height="9" rx="4.5" fill="rgba(255,255,255,.22)" />
      <rect x={x + 14} y={y + h - 16} width={w - 60} height="5" rx="2.5" fill="rgba(255,255,255,.1)" />
    </g>
  );
}

function Wire({ d, on, dashed }: { d: string; on?: boolean; dashed?: boolean }) {
  return <path d={d} fill="none" stroke={on ? "#c5f24a" : "rgba(255,255,255,.22)"} strokeWidth={on ? 1.8 : 1.4} strokeDasharray={dashed ? "5 5" : undefined} />;
}

/** Lines of code as bars, with the rows in `cited` lit. */
function Code({ x, y, rows, cited = [], tone = "#c5f24a", mark }: { x: number; y: number; rows: number[]; cited?: number[]; tone?: string; mark?: number }) {
  return (
    <g>
      <rect x={x} y={y} width="300" height={rows.length * 22 + 28} rx="14" fill="#0b0d10" stroke="rgba(255,255,255,.12)" />
      {rows.map((width, row) => {
        const lit = cited.includes(row);
        const top = y + 18 + row * 22;
        return (
          <g key={row}>
            {lit ? <rect x={x + 8} y={top - 6} width="284" height="22" rx="4" fill={tone === "#c5f24a" ? "rgba(197,242,74,.08)" : "rgba(255,107,107,.12)"} /> : null}
            <rect x={x + 18} y={top + 2} width="10" height="6" rx="3" fill={lit ? tone : "rgba(255,255,255,.12)"} opacity={lit ? 0.7 : 1} />
            <rect x={x + 40} y={top + 2} width={width} height="6" rx="3" fill={lit ? tone : "rgba(255,255,255,.14)"} />
            {mark === row ? <circle cx={x + 276} cy={top + 5} r="5" fill="#ff6b6b" /> : null}
          </g>
        );
      })}
    </g>
  );
}

const VISUALS: Record<string, ReactNode> = {
  map: (
    <svg viewBox="0 0 760 340" aria-hidden="true">
      <Wire d="M170 92 C210 92 210 170 250 170" />
      <Wire d="M170 248 C210 248 210 170 250 170" on />
      <Node x={20} y={60} />
      <Node x={20} y={216} />
      <Node x={250} y={138} tone="on" />
      <circle cx="388" cy="138" r="11" fill="#f5b14c" />
      <Wire d="M400 170 C420 170 420 120 440 120" on />
      <Code x={440} y={40} rows={[150, 210, 120, 180, 230, 160, 90, 200, 140, 170]} cited={[2, 3, 4, 5]} />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 760 320" aria-hidden="true">
      <Wire d="M190 92 C240 92 240 160 290 160" on />
      <Wire d="M440 160 C490 160 490 70 540 70" on />
      <Wire d="M440 160 C490 160 490 250 540 250" />
      <Wire d="M190 240 C240 240 240 160 290 160" dashed />
      <Node x={40} y={60} />
      <Node x={290} y={128} tone="on" />
      <Node x={540} y={38} tone="on" />
      <Node x={540} y={218} tone="edited" />
      <Node x={40} y={208} tone="new" />
    </svg>
  ),
  ask: (
    <svg viewBox="0 0 760 300" aria-hidden="true">
      <rect x="30" y="40" width="250" height="84" rx="20" fill="#121519" stroke="rgba(255,255,255,.16)" />
      <rect x="56" y="70" width="170" height="8" rx="4" fill="rgba(255,255,255,.3)" />
      <rect x="56" y="90" width="110" height="8" rx="4" fill="rgba(255,255,255,.16)" />
      <rect x="30" y="160" width="290" height="100" rx="20" fill="rgba(197,242,74,.07)" stroke="rgba(197,242,74,.4)" />
      <rect x="56" y="190" width="200" height="8" rx="4" fill="rgba(197,242,74,.75)" />
      <rect x="56" y="210" width="230" height="8" rx="4" fill="rgba(197,242,74,.45)" />
      <rect x="56" y="230" width="140" height="8" rx="4" fill="rgba(197,242,74,.45)" />
      <Wire d="M320 210 C380 210 380 120 430 120" on />
      <Code x={430} y={30} rows={[150, 210, 120, 180, 230, 160, 90, 200, 140]} cited={[3, 4, 5]} />
    </svg>
  ),
  learn: (
    <svg viewBox="0 0 760 300" aria-hidden="true">
      <Code x={30} y={30} rows={[150, 210, 120, 180, 230, 160, 90, 200, 140]} cited={[5]} tone="#ff6b6b" mark={5} />
      <g>
        {[0, 1, 2].map((row) => (
          <g key={row}>
            <rect x="400" y={40 + row * 80} width="330" height="60" rx="16" fill="#121519" stroke={row < 2 ? "rgba(197,242,74,.4)" : "rgba(255,255,255,.14)"} />
            <circle cx="432" cy={70 + row * 80} r="12" fill={row < 2 ? "rgba(197,242,74,.15)" : "none"} stroke={row < 2 ? "#c5f24a" : "rgba(255,255,255,.25)"} />
            {row < 2 ? <path d={`M426 ${70 + row * 80} l4 4 8-8`} fill="none" stroke="#c5f24a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
            <rect x="460" y={64 + row * 80} width={[200, 160, 220][row]} height="8" rx="4" fill="rgba(255,255,255,.22)" />
          </g>
        ))}
      </g>
    </svg>
  ),
  rules: (
    <svg viewBox="0 0 760 300" aria-hidden="true">
      <Wire d="M190 92 C250 92 250 92 300 92" />
      <Wire d="M450 92 C510 92 510 92 570 92" />
      <path d="M190 220 C300 220 460 220 570 220" fill="none" stroke="#ff6b6b" strokeWidth="1.8" strokeDasharray="6 6" />
      <g stroke="#ff6b6b" strokeWidth="2.4" strokeLinecap="round">
        <path d="M370 206 l28 28M398 206 l-28 28" />
      </g>
      <Node x={40} y={60} />
      <Node x={300} y={60} />
      <Node x={570} y={60} />
      <g>
        <rect x="40" y="188" width="150" height="64" rx="12" fill="rgba(255,107,107,.16)" stroke="rgba(255,107,107,.5)" />
        <rect x="54" y="204" width="22" height="22" rx="6" fill="none" stroke="rgba(255,255,255,.22)" />
        <rect x="86" y="210" width="74" height="9" rx="4.5" fill="rgba(255,255,255,.22)" />
      </g>
      <g>
        <rect x="570" y="188" width="150" height="64" rx="12" fill="rgba(245,177,76,.1)" stroke="rgba(245,177,76,.35)" />
        <rect x="584" y="204" width="22" height="22" rx="6" fill="none" stroke="rgba(255,255,255,.22)" />
        <rect x="616" y="210" width="74" height="9" rx="4.5" fill="rgba(255,255,255,.22)" />
      </g>
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 760 300" aria-hidden="true">
      <rect x="20" y="30" width="280" height="240" rx="18" fill="#0d1013" stroke="rgba(255,255,255,.14)" />
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <rect key={row} x="50" y={70 + row * 30} width={[200, 150, 220, 120, 180, 140][row]} height="7" rx="3.5" fill="rgba(255,255,255,.14)" />
      ))}
      <g transform="translate(140 228)" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.8" strokeLinecap="round">
        <rect x="0" y="8" width="22" height="16" rx="4" />
        <path d="M5 8V5a6 6 0 0 1 12 0v3" />
      </g>
      <path d="M320 150 H430" stroke="#c5f24a" strokeWidth="1.8" strokeDasharray="5 6" />
      <path d="M424 143l9 7-9 7" fill="none" stroke="#c5f24a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="450" y="30" width="290" height="240" rx="18" fill="rgba(197,242,74,.05)" stroke="rgba(197,242,74,.4)" />
      <Wire d="M560 110 C590 110 590 80 620 80" on />
      <Wire d="M560 110 C590 110 590 150 620 150" on />
      <rect x="480" y="92" width="80" height="36" rx="8" fill={BOX.fill} stroke="#c5f24a" />
      <rect x="620" y="62" width="90" height="36" rx="8" fill={BOX.fill} stroke={BOX.stroke} />
      <rect x="620" y="132" width="90" height="36" rx="8" fill={BOX.fill} stroke="#f5b14c" />
      <rect x="480" y="200" width="230" height="7" rx="3.5" fill="rgba(197,242,74,.45)" />
      <rect x="480" y="222" width="160" height="7" rx="3.5" fill="rgba(255,255,255,.14)" />
    </svg>
  ),
};

const EMBLEM = (
  <svg viewBox="0 0 430 470" aria-hidden="true">
    <defs>
      <linearGradient id="eS" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f1ffc4" />
        <stop offset=".4" stopColor="#c5f24a" />
        <stop offset="1" stopColor="#2fd6a8" stopOpacity=".7" />
      </linearGradient>
      <linearGradient id="eF" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1b2312" />
        <stop offset="1" stopColor="#0b0e0c" />
      </linearGradient>
      <filter id="eB" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="16" />
      </filter>
    </defs>
    <path d="M215 118 C215 80 92 92 92 58" fill="none" stroke="#c5f24a" strokeOpacity=".6" strokeWidth="1.6" />
    <path d="M215 372 C215 410 330 398 330 430" fill="none" stroke="#c5f24a" strokeOpacity=".6" strokeWidth="1.6" />
    <rect x="22" y="8" width="140" height="50" rx="12" fill="#0f1215" stroke="rgba(255,255,255,.16)" />
    <rect x="262" y="420" width="140" height="44" rx="12" fill="#0f1215" stroke="rgba(255,255,255,.16)" />
    <rect x="90" y="118" width="250" height="254" rx="26" fill="none" stroke="#c5f24a" strokeWidth="8" filter="url(#eB)" opacity=".75" />
    <rect x="90" y="118" width="250" height="254" rx="26" fill="url(#eF)" stroke="url(#eS)" strokeWidth="1.6" />
    <rect x="112" y="140" width="32" height="32" rx="9" fill="rgba(197,242,74,.12)" stroke="rgba(197,242,74,.55)" />
    <rect x="156" y="150" width="80" height="11" rx="5.5" fill="rgba(255,255,255,.7)" />
    <line x1="112" y1="190" x2="318" y2="190" stroke="rgba(255,255,255,.08)" />
    <rect x="104" y="226" width="222" height="70" rx="6" fill="rgba(197,242,74,.08)" />
    <rect x="104" y="226" width="2.5" height="70" rx="1.2" fill="#c5f24a" />
    {[206, 238, 254, 270, 286, 318, 338].map((y, row) => (
      <rect key={y} x={row === 0 || row > 4 ? 112 : 130} y={y} width={[112, 150, 104, 132, 76, 92, 60][row]} height="5" rx="2.5" fill={row > 0 && row < 5 ? "#c5f24a" : "rgba(255,255,255,.14)"} />
    ))}
  </svg>
);

function Section({ id, heading, children, visual }: { id: string; heading: string; children: ReactNode; visual?: ReactNode }) {
  return (
    <section className="sec" id={id}>
      <div className="wrap">
        <div className="sec-head">
          <h2 className="h2">{heading}</h2>
          <div className="sub">{children}</div>
        </div>
        {visual ? <div className="vis">{visual}</div> : null}
      </div>
    </section>
  );
}

function Buttons() {
  return (
    <div className="cta">
      <a className="btn btn-primary" href="/install" data-umami-event="install">
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
        </svg>
        Download for VS Code
      </a>
      <a className="btn" href="/signin" data-umami-event="sign-in">
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            stroke="none"
            d="M12 .6C5.7.6.6 5.7.6 12c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.2-1.3-5.2-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.1v3.2c0 .3.2.7.8.6A11.4 11.4 0 0 0 23.4 12C23.4 5.7 18.3.6 12 .6Z"
          />
        </svg>
        Sign in with GitHub
      </a>
    </div>
  );
}

/** The pricing paragraph: the plans' prices from billing's configuration, or this server's offer when billing is off. */
export function pricingText(billing: BillingConfig | null): string {
  const free = "The extension, the skills, the CLI and the Action's comment are free.";
  if (billing === null) return `${free} This server gives every account everything in aisus cloud.`;
  const { pro, team } = billing.priceTexts;
  return [
    free,
    `Pro ${pro ? `costs ${pro}` : "is"} for your own repositories.`,
    `Team ${team ? `costs ${team}` : "is"} for an organization, with the team dashboard.`,
    "Enterprise runs aisus cloud on your own servers.",
  ].join(" ");
}

export function Landing({ billing }: { billing: BillingConfig | null }) {
  return (
    <main>
      <section className="hero">
        <div className="glow" aria-hidden="true" />
        <div className="wrap">
          <h1 className="h1">
            <span>Trade some of your agent&apos;s output</span>{" "}
            <span className="l2">for understanding.</span>
          </h1>
          <p className="lead">Coding agents write more code than a person can follow. aisus is a toolkit for sustainable development. It helps you keep up with the code you ship.</p>
          <Buttons />
        </div>
      </section>
      <section className="stage" id="product">
        <div className="frame">
          <div className="frame-in">
            <ProductFrame />
          </div>
        </div>
      </section>
      <Section id="map" heading="The map is the main tool." visual={VISUALS["map"]}>
        <p>Press Generate in VS Code or Cursor. Claude Code, Codex or Devin draws your repository as boxes that open the code they cite.</p>
        <p>Each time you save, aisus checks every box against its code at zero tokens. Changed boxes get a badge. Refresh redraws only what changed.</p>
      </Section>
      <Section id="review" heading="See what a change touches." visual={VISUALS["review"]}>
        <p>Review in your editor lists the boxes your branch touches, the boxes it leaves stale and the new code no box covers. The GitHub Action posts the same report on each pull request.</p>
      </Section>
      <Section id="ask" heading="Ask the map a question." visual={VISUALS["ask"]}>
        <p>Your agent answers from the map. Each answer links to the lines behind it.</p>
      </Section>
      <Section id="learn" heading="Practise on your own code." visual={VISUALS["learn"]}>
        <p>
          Before you merge, your agent asks three questions about the change and grades your answers privately. In a bug hunt, the agent hides a bug in each step of your task for you to find. A guided tour
          opens code at each stop and asks a question.
        </p>
        <p>A practice log on your machine keeps your results.</p>
      </Section>
      <Section id="rules" heading="Keep the structure you chose." visual={VISUALS["rules"]}>
        <p>Right-click an arrow to forbid that dependency. An import that breaks the rule is marked in your editor and the pull request check. Hotspots tint each box by how often its code changes.</p>
      </Section>
      <Section id="cloud" heading="Share maps with your team." visual={VISUALS["cloud"]}>
        <p>aisus cloud puts your maps and pull request reports on the web. Your code stays on your machine and your CI runner.</p>
      </Section>
      <Section id="pricing" heading="You pay only for aisus cloud.">
        <p className="pricing">{pricingText(billing)}</p>
      </Section>
      <section className="wrap" id="start">
        <div className="final">
          <div>
            <h2 className="h2">
              Open your repository <span className="lime">as a map.</span>
            </h2>
            <div className="sub">
              <p>Install the extension and press Generate. Then click a box.</p>
            </div>
            <Buttons />
          </div>
          {EMBLEM}
        </div>
      </section>
    </main>
  );
}
