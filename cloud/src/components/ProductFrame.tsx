"use client";
// The landing page's product picture (CLD-08): aisus in VS Code with a checkout service's map beside the
// code its boxes cite. Its Map, PR and Freshness tabs and its boxes switch what the picture shows. Screen
// readers get one short description, because the picture stands for the app.
import { useEffect, useRef, useState } from "react";

type Mode = "trace" | "pr" | "fresh";
type State = "fresh" | "moved" | "edited" | "new";
interface Box {
  name: string;
  path: string;
  icon: string;
  state: State;
  x: number;
  y: number;
  desc: string;
  file: string;
  range: [number, number];
}

const BOX: Record<string, Box> = {
  web: { name: "Web", path: "apps/web/", icon: "M3 4.5h18v15H3zM3 9h18", state: "fresh", x: 14, y: 172, desc: "The checkout page. It sends the cart to the API and shows the result.", file: "apps/web/checkout/page.tsx", range: [8, 22] },
  api: { name: "API", path: "src/api/", icon: "M8.5 4.5C6.6 4.5 6 5.5 6 7v2.6c0 1.2-.7 2-2 2.4 1.3.4 2 1.2 2 2.4V17c0 1.5.6 2.5 2.5 2.5M15.5 4.5c1.9 0 2.5 1 2.5 2.5v2.6c0 1.2.7 2 2 2.4-1.3.4-2 1.2-2 2.4V17c0 1.5-.6 2.5-2.5 2.5", state: "fresh", x: 282, y: 172, desc: "Validates a checkout, charges the payment, marks the cart paid and queues the receipt.", file: "src/api/handler.ts", range: [7, 22] },
  pay: { name: "Payments", path: "src/payments/", icon: "M3 5.5h18v13H3zM3 10h18M7 15h4", state: "moved", x: 550, y: 14, desc: "Charges once per checkout key through the gateway and records the payment.", file: "src/payments/charge.ts", range: [4, 20] },
  store: { name: "Store", path: "src/store/", icon: "M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8S16.1 3.2 12 3.2 4.5 4.5 4.5 6", state: "edited", x: 550, y: 172, desc: "Carts and their items in the database, and marking a cart paid.", file: "src/store/carts.ts", range: [3, 16] },
  queue: { name: "Queue", path: "src/queue/", icon: "M4 4h16v4.5H4zM4 10.5h16V15H4zM4 19.5h10", state: "fresh", x: 282, y: 330, desc: "A list of jobs, with up to five retries.", file: "src/queue/index.ts", range: [1, 12] },
  worker: { name: "Worker", path: "worker/", icon: "M6.5 6.5h11v11h-11zM10 3v3.5M14 3v3.5M10 17.5V21M14 17.5V21M3 10h3.5M3 14h3.5M17.5 10H21M17.5 14H21", state: "fresh", x: 550, y: 330, desc: "Takes jobs from the queue and mails a receipt for every paid cart.", file: "worker/receipts.ts", range: [4, 18] },
  refunds: { name: "Refunds", path: "src/refunds/", icon: "M4 5v4.5h4.5M4.8 9.5A8 8 0 1 1 4 13", state: "new", x: 282, y: 14, desc: "Pull request #482 adds refund.ts, and no box covers it yet. aisus suggests this box.", file: "src/refunds/refund.ts", range: [1, 12] },
};

const EDGES: [string, string, boolean?][] = [
  ["web", "api"],
  ["api", "pay"],
  ["pay", "store"],
  ["api", "queue"],
  ["queue", "worker"],
  ["worker", "store"],
  ["api", "refunds", true],
];

const MODES: Record<Mode, { tab: string; select: string; title: string; detail: string; on?: string[]; edges?: string[]; steps?: Record<string, number>; touched?: string[]; stale?: string[]; drift?: string[] }> = {
  trace: { tab: "Map", select: "api", title: "Checkout flow", detail: "Web to API to Payments to Store", on: ["web", "api", "pay", "store"], edges: ["web>api", "api>pay", "pay>store"], steps: { web: 1, api: 2, pay: 3, store: 4 } },
  pr: { tab: "PR #482", select: "pay", title: "#482 Add refunds", detail: "2 touched, 1 stale, 1 new box", edges: ["api>pay"], touched: ["api", "pay"], stale: ["store"] },
  fresh: { tab: "Freshness", select: "store", title: "2 of 6 boxes need a look", detail: "Checked on save, no tokens", drift: ["pay", "store"] },
};

// Lines that start with "+|" are added by the pull request, and lines that start with "~|" changed since the map.
const SRC: Record<string, string> = {
  "apps/web/checkout/page.tsx": `"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Checkout(p: Props) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    const res = await api.post("/checkout", {
      cartId: p.cartId,
      method: "card",
    });
    setBusy(false);
    location.assign(\`/orders/\${res.body.orderId}\`);
  }

  return (
    <Button onClick={pay} disabled={busy}>
      Pay now
    </Button>
  );
}`,
  "src/api/handler.ts": `import { charge } from "../payments/charge";
import { carts } from "../store/carts";
import { enqueue } from "../queue";
+|import { refund } from "../refunds/refund";

export async function checkout(req: Req) {
  const { cartId, method } = req.body;
  const cart = await carts.get(cartId);
  if (!cart || cart.items.length === 0) {
    return reply(404, "empty cart");
  }

  const payment = await charge({
    amount: cart.total,
    method,
    key: \`checkout:\${cart.id}\`,
  });

  await carts.markPaid(cart.id, payment.id);
  await enqueue("receipt.send", { cartId: cart.id });
  return reply(201, { orderId: cart.id });
}`,
  "src/payments/charge.ts": `import { gateway } from "./gateway";
import { db } from "../store/db";

export async function charge(c: Charge) {
  const seen = await db.payments.byKey(c.key);
  if (seen) return seen;

  const intent = await gateway.intents.create({
    amount: c.amount,
    method: c.method,
  });

  return db.payments.insert({
    id: intent.id,
    key: c.key,
    amount: c.amount,
+|    refundable: true,
    createdAt: new Date(),
  });
}`,
  "src/store/carts.ts": `import { db } from "./db";

export const carts = {
  async get(id: string) {
    const row = await db.carts.find(id);
    if (!row) return null;
    const items = await db.items.where({ cartId: id });
~|    return { ...row, items, total: sum(items) };
  },

  async markPaid(id: string, paymentId: string) {
    await db.carts.update(id, {
      status: "paid",
      paymentId,
~|      paidAt: new Date(),
    });
  },
};`,
  "src/queue/index.ts": `export async function enqueue(name: string, data: unknown) {
  const job = { name, data, attempts: 0 };
  await jobs.push(JSON.stringify(job));
}

export async function next() {
  const raw = await jobs.pop(5);
  return raw ? JSON.parse(raw) : null;
}

export async function retry(job: Job) {
  if (++job.attempts > 5) return;
  await jobs.push(JSON.stringify(job));
}`,
  "worker/receipts.ts": `import { next, retry } from "../src/queue";
import { mail } from "./mail";

// Sends a receipt for every paid cart.
export async function run() {
  for (;;) {
    const job = await next();
    if (!job || job.name !== "receipt.send") continue;
    try {
      const cart = await carts.get(job.data.cartId);
      await mail.send({ to: cart.email, template: "receipt" });
    } catch {
      await retry(job);
    }
  }
}`,
  "src/refunds/refund.ts": `+|import { gateway } from "../payments/gateway";
+|import { db } from "../store/db";
+|
+|export async function refund(req: Req) {
+|  const payment = await db.payments.get(req.body.paymentId);
+|  if (!payment?.refundable) {
+|    return { status: 409, body: "not refundable" };
+|  }
+|  await gateway.refunds.create({ paymentId: payment.id });
+|  await db.payments.update(payment.id, { refundable: false });
+|  return { status: 200, body: { paymentId: payment.id } };
+|}`,
};

const NODE_W = 164;
const NODE_H = 104;
const KEYWORDS = "import|from|export|default|async|await|function|const|let|return|if|else|new|type|throw|try|catch|for|continue|class|true|false|null|as";
const TOKEN = new RegExp(`(\\/\\/.*$)|("(?:[^"\\\\]|\\\\.)*"|\`(?:[^\`\\\\]|\\\\.)*\`)|\\b(${KEYWORDS})\\b|\\b(\\d+)\\b|([A-Za-z_$][\\w$]*)(?=\\s*\\()|(<\\/?[A-Za-z][\\w.]*)`, "g");

function highlight(line: string): { cls: string; text: string }[] {
  const out: { cls: string; text: string }[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ cls: "", text: line.slice(last, at) });
    out.push({ cls: match[1] ? "c" : match[2] ? "s" : match[3] ? "k" : match[4] ? "n" : match[5] ? "f" : "t", text: match[0] });
    last = at + match[0].length;
  }
  if (last < line.length) out.push({ cls: "", text: line.slice(last) });
  return out;
}

function edgePath(from: Box, to: Box): string {
  const ax = from.x + NODE_W / 2;
  const ay = from.y + NODE_H / 2;
  const bx = to.x + NODE_W / 2;
  const by = to.y + NODE_H / 2;
  if (Math.abs(bx - ax) > Math.abs(by - ay) * 1.2) {
    const sx = bx > ax ? 1 : -1;
    const x1 = sx > 0 ? from.x + NODE_W : from.x;
    const x2 = sx > 0 ? to.x : to.x + NODE_W;
    const k = Math.max(26, Math.abs(x2 - x1) / 2);
    return `M${x1},${ay} C${x1 + sx * k},${ay} ${x2 - sx * k},${by} ${x2},${by}`;
  }
  const sy = by > ay ? 1 : -1;
  const y1 = sy > 0 ? from.y + NODE_H : from.y;
  const y2 = sy > 0 ? to.y : to.y + NODE_H;
  const k = Math.max(20, Math.abs(y2 - y1) / 2);
  return `M${ax},${y1} C${ax},${y1 + sy * k} ${bx},${y2 - sy * k} ${bx},${y2}`;
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const STATE_TEXT: Record<State, string> = {
  fresh: "Fresh. The cited lines match the map.",
  moved: "Moved. The cited lines moved and still open.",
  edited: "Edited. 2 cited lines changed since the map.",
  new: "No box yet. #482 adds this file.",
};

export function ProductFrame() {
  const [mode, setMode] = useState<Mode>("trace");
  const [sel, setSel] = useState("api");
  const [view, setView] = useState<"code" | "box">("code");
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLDivElement>(null);
  const M = MODES[mode];
  const box = BOX[sel]!;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const fit = (): void => setZoom(Math.min(1, (element.clientWidth - 24) / 716, (element.clientHeight - 64) / 442));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const lines = SRC[box.file]!.split("\n");
  const flag = mode === "pr" ? "+|" : mode === "fresh" ? "~|" : null;

  useEffect(() => {
    const element = code.current;
    if (!element) return;
    const first = flag ? lines.findIndex((line) => line.startsWith(flag)) + 1 : 0;
    const top = Math.max(1, (first > 0 ? Math.min(first, box.range[0]) : box.range[0]) - 2);
    element.scrollTop = (top - 1) * 20;
  }, [sel, mode, view, flag, lines, box.range]);

  function pick(next: Mode): void {
    setMode(next);
    setSel(MODES[next].select);
  }

  const visible = Object.keys(BOX).filter((id) => id !== "refunds" || mode === "pr");
  const parts = box.file.split("/");
  const prefix = mode === "pr" && M.touched?.includes(sel) ? "Touched by #482. " : mode === "pr" && M.stale?.includes(sel) ? "Left stale by #482. " : "";

  return (
    <div className="pf" role="img" aria-label="The aisus map of a checkout service in VS Code, beside the code its selected box cites.">
      <div className="pf-bar">
        <div className="pf-crumbs">
          <span>acme</span>
          <span>/</span>
          <b>checkout-service</b>
          <span className="pf-chip">main</span>
        </div>
        <div className="pf-meta">
          <span>
            <i className="pf-dot" />
            Checked 2 min ago
          </span>
          <span>6 boxes, 9 citations</span>
        </div>
      </div>
      <div className="pf-body">
        <div className="pf-canvas" ref={canvas}>
          <div className="pf-banner">
            <b>{M.title}</b>
            {M.detail}
          </div>
          <div className="pf-seg pf-vseg">
            {(Object.keys(MODES) as Mode[]).map((id) => (
              <button key={id} type="button" tabIndex={-1} aria-pressed={mode === id} onClick={() => pick(id)}>
                {MODES[id].tab}
              </button>
            ))}
          </div>
          <div className="pf-world" style={{ ["--z" as string]: zoom.toFixed(3) }}>
            <svg className="pf-edges" aria-hidden="true">
              <defs>
                <marker id="pf-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M1 1.5 9 5 1 8.5z" fill="rgba(255,255,255,.42)" />
                </marker>
                <marker id="pf-ar-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M1 1.5 9 5 1 8.5z" fill="#c5f24a" />
                </marker>
              </defs>
              {EDGES.filter(([, , ghost]) => !ghost || mode === "pr").map(([from, to, ghost]) => {
                const on = M.edges?.includes(`${from}>${to}`) ?? false;
                const dim = (mode === "trace" && !on) || mode === "fresh";
                return <path key={`${from}>${to}`} d={edgePath(BOX[from]!, BOX[to]!)} className={ghost ? "ghost" : on ? "on" : dim ? "dim" : ""} markerEnd={on || ghost ? "url(#pf-ar-on)" : "url(#pf-ar)"} />;
              })}
            </svg>
            {visible.map((id) => {
              const b = BOX[id]!;
              const dim = (mode === "trace" && !M.on?.includes(id)) || (mode === "fresh" && !M.drift?.includes(id));
              const badge = mode === "pr" ? (M.touched?.includes(id) ? "touched" : M.stale?.includes(id) ? "stale" : id === "refunds" ? "new box" : null) : null;
              const classes = ["pf-node", id === sel ? "sel" : "", dim ? "dim" : "", mode === "fresh" && M.drift?.includes(id) ? "drift" : "", b.state === "new" ? "ghost" : ""].filter(Boolean).join(" ");
              return (
                <button key={id} type="button" tabIndex={-1} className={classes} data-state={b.state} style={{ left: b.x, top: b.y }} onClick={() => setSel(id)} onMouseEnter={() => setSel(id)}>
                  {mode === "trace" && M.steps?.[id] ? <span className="pf-step">{M.steps[id]}</span> : null}
                  {badge ? <span className={`pf-badge ${badge === "stale" ? "stale" : badge === "new box" ? "new" : ""}`}>{badge}</span> : null}
                  <span className="pf-n-head">
                    <span className="pf-n-ico">
                      <Icon d={b.icon} />
                    </span>
                    <span className="pf-n-name">{b.name}</span>
                  </span>
                  <span className="pf-n-path">{b.path}</span>
                  <span className="pf-n-foot">
                    <span className="pf-st">
                      <i />
                      {b.state === "new" ? "no box yet" : b.state}
                    </span>
                    <span>1 file</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pf-legend">
            <span>
              <i style={{ background: "var(--accent)" }} />
              fresh
            </span>
            <span>
              <i style={{ background: "var(--moved)" }} />
              moved
            </span>
            <span>
              <i style={{ background: "var(--edited)" }} />
              edited
            </span>
            <span>
              <i style={{ background: "var(--missing)" }} />
              missing
            </span>
          </div>
        </div>
        <div className="pf-panel">
          <div className="pf-p-head">
            <div className="pf-seg">
              <button type="button" tabIndex={-1} aria-pressed={view === "code"} onClick={() => setView("code")}>
                <Icon d="m9 7.5-4.5 4.5L9 16.5M15 7.5l4.5 4.5-4.5 4.5" />
                Code
              </button>
              <button type="button" tabIndex={-1} aria-pressed={view === "box"} onClick={() => setView("box")}>
                <Icon d="M4 5h16v14H4zM8 10h8M8 14h5" />
                Box
              </button>
            </div>
            <div className="pf-loc">
              <span className="pf-crumb">
                {parts.slice(0, -1).join(" / ")} / <b>{parts.at(-1)}</b>
              </span>
              <span className="pf-range">
                L{box.range[0]}–{box.range[1]}
              </span>
            </div>
          </div>
          {view === "code" ? (
            <>
              <div className="pf-tabs">
                <span className="pf-tab on">
                  <Icon d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" />
                  {parts.at(-1)}
                </span>
              </div>
              <div className="pf-code" ref={code}>
                {lines.map((raw, index) => {
                  const n = index + 1;
                  const mark = raw.startsWith("+|") ? "pr" : raw.startsWith("~|") ? "ed" : "";
                  const line = mark ? raw.slice(2) : raw;
                  const cite = n >= box.range[0] && n <= box.range[1];
                  const shown = (mark === "pr" && mode === "pr") || (mark === "ed" && mode === "fresh");
                  return (
                    <div key={n} className={`pf-ln${cite ? " cite" : ""}${shown ? ` ${mark}` : ""}`}>
                      <span className="g">{n}</span>
                      <span className="m">{mark === "pr" ? "+" : mark === "ed" ? "~" : " "}</span>
                      <code>
                        {highlight(line).map((token, at) =>
                          token.cls ? (
                            <span key={at} className={token.cls}>
                              {token.text}
                            </span>
                          ) : (
                            token.text
                          ),
                        )}
                        {line === "" ? " " : null}
                      </code>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="pf-bx">
              <div className="pf-bx-h">
                <span className="pf-n-ico">
                  <Icon d={box.icon} />
                </span>
                <div>
                  <b>{box.name}</b>
                  <small>{box.path}</small>
                </div>
              </div>
              <p className="pf-bx-d">{box.desc}</p>
              <h5>Cites {box.range[1] - box.range[0] + 1} lines</h5>
              <ul>
                <li>
                  {box.file}
                  <em>
                    L{box.range[0]}–{box.range[1]}
                  </em>
                </li>
              </ul>
            </div>
          )}
          <div className="pf-foot" data-state={box.state}>
            <span className="pf-st">
              <i />
              {prefix}
              {STATE_TEXT[box.state]}
            </span>
            <span className="pf-open">Open in VS Code</span>
          </div>
        </div>
      </div>
    </div>
  );
}
