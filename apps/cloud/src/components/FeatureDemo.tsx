"use client";
// The homepage's feature demos (docs/design/homepage.md): aisus in VS Code's Light Modern theme, replaying four
// scenes drawn from aisus's own code on a 900 ms beat. A visitor who prefers reduced motion sees each scene's
// last frame without the cursor. Screen readers get one description per scene, because the demo stands for the app.
import { useEffect, useState, type ReactNode } from "react";

/** How many beats each scene takes before it loops: the map, the tour, the sequence and /aisus-pr. */
export const SCENE_FRAMES = [13, 14, 12, 14];
export const BEAT_MS = 900;

const ACCENT = "#005fb8";
const ORANGE = "#d18616";
const PURPLE = "#652d90";

const DESCRIPTIONS = [
  "aisus in VS Code. Clicking boxes on a map of the aisus repository opens the code each box cites, and an edit marks its box as changed.",
  "A guided tour of the aisus map. Each stop highlights a box, opens its code and asks a question.",
  "A sequence diagram of generating a map, from the sidebar through the agent and the validator to the viewer.",
  "Running /aisus-pr in the terminal posts a diagram of the pull request as a comment on it.",
];

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Source lines mark tokens as [[class:text]], coloured as VS Code's Light Modern theme colours them.
interface SourceFile { tab: string; icon: string; iconColor: string; crumbs: string; plain?: boolean; lines: Record<number, string> }

const GENERATE: SourceFile = {
  tab: "generate.ts", icon: "TS", iconColor: "#3178c6", crumbs: "apps › vscode › src › generate.ts",
  lines: {
    149: "[[k:export]] [[s:async function]] [[f:generateArchitectureCommand]](context: [[t:vscode]].[[t:ExtensionContext]], runs: [[t:Runs]]): [[t:Promise]]<[[s:void]]> {",
    150: "  [[s:const]] folder = [[k:await]] [[f:pickRepoRoot]]();",
    151: "  [[k:if]] (!folder) [[k:return]];",
    152: '  [[s:const]] focus = [[k:await]] vscode.window.[[f:showInputBox]]({ prompt: [[str:"Focus (optional)"]] });',
    153: "  [[k:if]] (focus === [[s:undefined]]) [[k:return]];",
    154: "  [[k:await]] [[f:confirmAndLaunch]](context, runs, folder.uri.fsPath, [[f:generateTask]](focus));",
    155: "}",
    156: "",
    157: "[[c:/**]]",
    158: "[[c: * `aisus: Generate Sequence Diagram`: the flow, which is required and asked for unless the sidebar]]",
    159: "[[c: * passed one, then the agent and notes as {@link confirmAndLaunch} asks.]]",
    160: "[[c: */]]",
  },
};

const TOUR: SourceFile = {
  tab: "tour.ts", icon: "TS", iconColor: "#3178c6", crumbs: "packages › viewer › tour.ts › TourPlayer",
  lines: {
    55: "[[c:  /** Starts at the first stop. */]]",
    56: "  [[f:play]](): [[s:void]] {",
    57: "    [[k:if]] ([[s:this]].stops.length === [[n:0]]) [[k:return]];",
    58: "    [[s:this]].[[f:go]]([[n:0]]);",
    59: "  }",
    60: "",
    61: "[[c:  /** Marks the current stop's box again, after the map is drawn anew. */]]",
    62: "  [[f:reapply]](): [[s:void]] {",
    63: "    [[s:this]].[[f:mark]]([[s:this]].index === [[s:null]] ? [[s:null]] : ([[s:this]].stops[[[s:this]].index]?.component ?? [[s:null]]));",
    64: "  }",
    65: "",
    66: "  [[s:private]] [[f:go]](index: [[t:number]]): [[s:void]] {",
    67: "    [[s:this]].index = index;",
    68: "    [[s:this]].revealed = [[s:false]];",
    69: "    [[s:this]].[[f:render]]();",
    70: '    [[s:this]].[[f:post]]({ type: [[str:"tourStop"]], index });',
    71: "  }",
  },
};

const CHECK: SourceFile = {
  tab: "check.ts", icon: "TS", iconColor: "#3178c6", crumbs: "packages › core › model › check.ts › runCheck",
  lines: {
    99: "[[k:export]] [[s:function]] [[f:runCheck]](options: [[t:CheckOptions]]): [[t:CheckOutcome]] {",
    100: "  [[s:const]] { root, base, head } = options;",
    101: '  [[k:if]] (!REVISION_PATTERN.[[f:test]](base) || (head !== [[s:undefined]] && !REVISION_PATTERN.[[f:test]](head))) [[k:return]] { ok: [[s:false]], reason: [[str:"--base and --head take revisions such as origin/main or HEAD."]] };',
    102: "  [[s:const]] config = [[f:loadConfig]](root);",
    103: "  [[k:if]] (!config.ok) [[k:return]] config;",
    104: "  [[s:const]] run = options.map ?? config.config.map ?? [[f:mainMap]](root);",
    105: '  [[k:if]] (run === [[s:null]]) [[k:return]] { ok: [[s:false]], reason: [[str:`No map to check against. Generate one with an empty focus, or name one with --map or "map" in ${CONFIG_FILE}.`]] };',
    106: "  [[s:const]] runDir = [[f:join]](root, MAP_DIR, run);",
    107: "  [[s:let]] diagram: [[t:ViewDiagram]];",
    108: "  [[k:try]] {",
    109: '    [[s:const]] read = [[f:readDiagram]](JSON.[[f:parse]]([[f:readFileSync]]([[f:join]](runDir, CANDIDATE_FILE), [[str:"utf8"]])));',
  },
};

/** The demo's one edit: line 104 of check.ts gains an argument, so the Core box no longer matches the map. */
const CHECK_EDIT = { line: 104, code: "  [[s:const]] run = options.map ?? config.config.map ?? [[f:mainMap]](root, base);" };

const VIEWER_CSS: SourceFile = {
  tab: "viewer.css", icon: "#", iconColor: "#519aba", crumbs: "apps › cloud › public › viewer.css › .tour", plain: true,
  lines: {
    1032: "[[cs:.tour]] {",
    1033: "  [[cp:position]]: [[cv:absolute]];",
    1034: "  [[cp:left]]: [[n:8px]];",
    1035: "  [[cp:bottom]]: [[n:48px]];",
    1036: "  [[cp:max-width]]: [[f:min]]([[n:360px]], [[f:calc]]([[n:100%]] - [[n:32px]]));",
    1037: "  [[cp:max-height]]: [[n:60%]];",
    1038: "  [[cp:overflow]]: [[cv:auto]];",
    1039: "  [[cp:padding]]: [[n:8px]] [[n:12px]];",
    1040: "  [[cp:background]]: [[f:var]](--aisus-widget-background);",
    1041: "  [[cp:border]]: [[n:1px]] [[cv:solid]] [[f:var]](--aisus-widget-border);",
    1042: "  [[cp:border-radius]]: [[n:4px]];",
    1043: "  [[cp:box-shadow]]: [[n:0]] [[n:2px]] [[n:8px]] [[f:var]](--aisus-shadow);",
    1044: "  [[cp:overflow-wrap]]: [[cv:anywhere]];",
    1045: "}",
  },
};

const SKILL: SourceFile = {
  tab: "SKILL.md", icon: "M↓", iconColor: "#519aba", crumbs: "skills › aisus-architecture › SKILL.md › 6. Validate and repair", plain: true,
  lines: {
    68: "[[mh:## 6. Validate and repair]]",
    69: "",
    70: "Run, from the repository root:",
    71: "",
    72: "[[mc:```sh]]",
    73: "node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <draft>",
    74: "[[mc:```]]",
    75: "",
    76: "with [[mc:`<draft>`]] replaced by the [[mc:`draft`]] path from step 2. It prints one JSON object with [[mc:`status`]].",
  },
};

function Code({ code }: { code: string }) {
  const parts: ReactNode[] = [];
  const token = /\[\[(\w+):(.*?)\]\]/g;
  let last = 0;
  for (let match = token.exec(code); match; match = token.exec(code)) {
    if (match.index > last) parts.push(code.slice(last, match.index));
    parts.push(<span key={match.index} className={`tk-${match[1]}`}>{match[2]}</span>);
    last = match.index + match[0].length;
  }
  if (last < code.length) parts.push(code.slice(last));
  return <>{parts.length ? parts : " "}</>;
}

function Editor({ file, from, to, selected, edit }: { file: SourceFile; from: number; to: number; selected: [number, number]; edit?: { line: number; code: string } }) {
  const numbers: number[] = [];
  for (let n = from; n <= to; n++) numbers.push(n);
  return (
    <div className="fd-editor">
      <div className="fd-tabs">
        <span className="fd-tab"><b className="fd-file-icon" style={{ color: file.iconColor }}>{file.icon}</b>{file.tab}{edit ? " ●" : ""}</span>
      </div>
      <div className="fd-crumbs">{file.crumbs}</div>
      <div className={file.plain ? "fd-code fd-code-plain" : "fd-code"}>
        {numbers.map((n) => {
          const edited = edit?.line === n;
          const classes = ["fd-text"];
          if (n >= selected[0] && n <= selected[1]) classes.push("sel");
          if (edited) classes.push("changed");
          return (
            <div key={n} className="fd-line">
              <span className="fd-gutter">{n}</span>
              <span className={classes.join(" ")}><Code code={edited ? edit.code : (file.lines[n] ?? "")} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8.5" y="2.5" width="7" height="5" rx="1" />
      <rect x="2.5" y="16.5" width="7" height="5" rx="1" />
      <rect x="14.5" y="16.5" width="7" height="5" rx="1" />
      <path d="M12 7.5v4.5M6 16.5V12h12v4.5" />
    </svg>
  );
}

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fd-pane">
      <div className="fd-tabs"><span className="fd-tab"><MapIcon />{title}</span></div>
      <div className="fd-canvas">{children}</div>
    </div>
  );
}

function SvgCursor({ x, y, click, hidden }: { x: number; y: number; click: boolean; hidden: boolean }) {
  if (hidden) return null;
  return (
    <g className="fd-svg-cursor" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <circle className={click ? "fd-svg-ring on" : "fd-svg-ring"} cx="2" cy="2" r="14" />
      <path d="M2 1.5L2 17L6.2 13.2L9 19.6L11.8 18.4L9.1 12.2L14.6 12Z" fill="#000000" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  );
}

function Cursor({ x, y, click, hidden }: { x: string; y: string; click: boolean; hidden: boolean }) {
  if (hidden) return null;
  return (
    <span className="fd-cursor" style={{ left: x, top: y }}>
      <span className={click ? "fd-ring on" : "fd-ring"} />
      <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
        <path d="M2 1.5L2 17L6.2 13.2L9 19.6L11.8 18.4L9.1 12.2L14.6 12Z" fill="#000000" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// The map of the aisus repository, in the colours the viewer takes from VS Code (packages/viewer/hosts/vscode.ts).
type NodeId = "sidebar" | "viewer" | "cloud" | "skills" | "core" | "action" | "maps";
interface Mark { stroke: string; width: number; dash?: string }

const NODES: { id: NodeId; label: string; sub: string; x: number; y: number; color: string; fill: string }[] = [
  { id: "sidebar", label: "Sidebar", sub: "apps/vscode/", x: 24, y: 36, color: "#1a85ff", fill: "rgba(26,133,255,.12)" },
  { id: "viewer", label: "Viewer", sub: "packages/viewer/", x: 234, y: 36, color: "#1a85ff", fill: "rgba(26,133,255,.12)" },
  { id: "cloud", label: "Cloud", sub: "apps/cloud/", x: 444, y: 36, color: "#bf8803", fill: "rgba(191,136,3,.12)" },
  { id: "skills", label: "Skills", sub: "skills/", x: 24, y: 156, color: "#717171", fill: "rgba(113,113,113,.12)" },
  { id: "core", label: "Core", sub: "packages/core/", x: 234, y: 156, color: "#388a34", fill: "rgba(56,138,52,.12)" },
  { id: "action", label: "Action", sub: "apps/action/", x: 444, y: 156, color: "#388a34", fill: "rgba(56,138,52,.12)" },
  { id: "maps", label: "Maps", sub: ".aisus/maps/", x: 234, y: 276, color: PURPLE, fill: "rgba(101,45,144,.12)" },
];

const EDGES = ["M156 62H232", "M444 62H368", "M90 88V154", "M300 88V154", "M156 182H232", "M444 182H368", "M300 208V274", "M90 208V292Q90 302 100 302H232"];

function RepoMap({ marks, edited, children }: { marks: Partial<Record<NodeId, Mark>>; edited?: boolean; children?: ReactNode }) {
  return (
    <svg className="fd-svg" viewBox="0 0 600 340" aria-hidden="true">
      <defs>
        <marker id="fd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#3b3b3b" /></marker>
      </defs>
      {EDGES.map((d) => <path key={d} d={d} fill="none" stroke="#3b3b3b" strokeWidth="1.25" markerEnd="url(#fd-arrow)" />)}
      {NODES.map((node) => {
        const mark = marks[node.id];
        return (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width="132" height="52" rx="6" fill={node.fill} stroke={mark?.stroke ?? node.color} strokeWidth={mark?.width ?? 1.5} strokeDasharray={mark?.dash} />
            <text x={node.x + 66} y={node.y + 21} textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b3b3b">{node.label}</text>
            <text x={node.x + 66} y={node.y + 38} textAnchor="middle" fontSize="11" fill="#717171">{node.sub}</text>
          </g>
        );
      })}
      <text className="fd-fade" x="366" y="148" textAnchor="end" fontSize="12" fontWeight="600" fill={ORANGE} stroke="#ffffff" strokeWidth="3" paintOrder="stroke" opacity={edited ? 1 : 0}>edited</text>
      {children}
    </svg>
  );
}

interface Frame { body: ReactNode; status: string; branch: string }

function mapScene(f: number, still: boolean): Frame {
  const open = f < 2 ? "sidebar" : f < 6 ? "viewer" : "core";
  const selected = f >= 10 ? null : open;
  const [x, y] = f === 0 ? [90, 62] : f < 5 ? [300, 62] : f < 9 ? [300, 182] : [520, 300];
  const edited = f >= 9;
  const marks: Partial<Record<NodeId, Mark>> = {};
  if (edited && selected !== "core") marks.core = { stroke: ORANGE, width: 1.5, dash: "6 3" };
  if (selected) marks[selected] = { stroke: ACCENT, width: 3 };
  const editor = open === "sidebar"
    ? <Editor file={GENERATE} from={149} to={160} selected={[149, 155]} />
    : open === "viewer"
      ? <Editor file={TOUR} from={55} to={71} selected={[55, 71]} />
      : <Editor file={CHECK} from={99} to={109} selected={[99, 107]} edit={edited ? CHECK_EDIT : undefined} />;
  return {
    body: (
      <>
        <Pane title="Architecture">
          <div className="fd-art">
            <RepoMap marks={marks} edited={edited}>
              <SvgCursor x={x} y={y} click={f === 2 || f === 6 || f === 10} hidden={still} />
            </RepoMap>
          </div>
          <div className="fd-widget fd-fresh">{edited ? "Core changed since the map" : "All 7 boxes match their code"}</div>
        </Pane>
        {editor}
      </>
    ),
    status: edited ? "aisus: 1 box changed since the map" : "aisus: 7 boxes fresh",
    branch: "main",
  };
}

const STOPS: { id: NodeId; title: string; text: string; cite: string; question: string; answer: string }[] = [
  { id: "sidebar", title: "Generate starts in the sidebar", text: "The command asks for an optional focus, then launches your agent with the architecture skill.", cite: "apps/vscode/src/generate.ts:149-155", question: "What happens when the focus is left empty?", answer: "The agent maps the whole repository." },
  { id: "core", title: "Core checks a diff against the map", text: "runCheck reads the map and compares it with the code, without spending a token.", cite: "packages/core/model/check.ts:99-107", question: "Which map does it use when none is named?", answer: "The config names one, or else the main map." },
  { id: "viewer", title: "The player marks each stop", text: "Each stop highlights its box and asks the host to open the cited code.", cite: "packages/viewer/tour.ts:66-71", question: "Who opens the code, the player or the host?", answer: "The host. The player posts a tourStop message." },
  { id: "cloud", title: "The cloud plays the same tour", text: "Map pages on aisus cloud load the same viewer, so a shared map keeps its tour.", cite: "apps/cloud/public/viewer.css:1032-1045", question: "Where does the tour card sit on the map?", answer: "Bottom left, above the map controls." },
];

function tourScene(f: number, still: boolean): Frame {
  const index = f < 5 ? 0 : f < 8 ? 1 : f < 12 ? 2 : 3;
  const stop = STOPS[index]!;
  const revealed = (index === 0 && f >= 2) || (index === 2 && f >= 10);
  const IDLE = [300, 100], ANSWER = [62, 177], NEXT = [90, 212];
  const at = [IDLE, ANSWER, ANSWER, NEXT, NEXT, NEXT, NEXT, NEXT, NEXT, ANSWER, ANSWER, NEXT, NEXT, IDLE][f] ?? IDLE;
  const editor = [
    <Editor key="generate" file={GENERATE} from={149} to={155} selected={[149, 155]} />,
    <Editor key="check" file={CHECK} from={99} to={107} selected={[99, 107]} />,
    <Editor key="tour" file={TOUR} from={62} to={71} selected={[66, 71]} />,
    <Editor key="css" file={VIEWER_CSS} from={1032} to={1045} selected={[1032, 1045]} />,
  ][index];
  return {
    body: (
      <>
        <Pane title="Architecture">
          <div className="fd-art"><RepoMap marks={{ [stop.id]: { stroke: PURPLE, width: 3 } }} /></div>
          <div className="fd-widget fd-tour">
            <div className="fd-muted">Stop {index + 1} of 4</div>
            <h3>{stop.title}</h3>
            <p>{stop.text}</p>
            <p className="fd-cite">{stop.cite}</p>
            <p><b>Question: </b>{stop.question}</p>
            <div className="fd-reveal">
              {revealed ? <div className="fd-answer">{stop.answer}</div> : <span className={at === ANSWER && !still ? "fd-btn hover" : "fd-btn"}>Show answer</span>}
            </div>
            <div className="fd-tour-nav">
              <span className={index === 0 ? "fd-btn off" : "fd-btn"} style={{ width: 48 }}>Back</span>
              <span className={at === NEXT && !still ? "fd-btn hover" : "fd-btn"} style={{ width: 52 }}>{index === 3 ? "Finish" : "Next"}</span>
              <span className="fd-btn" style={{ width: 72 }}>End tour</span>
            </div>
            <Cursor x={`${at[0]}px`} y={`${at[1]}px`} click={[2, 5, 8, 10, 12].includes(f)} hidden={still} />
          </div>
        </Pane>
        {editor}
      </>
    ),
    status: `aisus: tour, stop ${index + 1} of 4`,
    branch: "main",
  };
}

const PARTICIPANTS = [
  { label: "Sidebar", sub: "apps/vscode/", x: 13, color: "#1a85ff", fill: "rgba(26,133,255,.12)" },
  { label: "Claude Code", sub: "your agent", x: 163, color: "#717171", fill: "rgba(113,113,113,.12)" },
  { label: "Validator", sub: "validate.mjs", x: 313, color: "#388a34", fill: "rgba(56,138,52,.12)" },
  { label: "Viewer", sub: "packages/viewer/", x: 463, color: "#1a85ff", fill: "rgba(26,133,255,.12)" },
];

// Calls are solid in the foreground colour, and returns are dashed in the muted colour, as the viewer draws them.
const MESSAGES = [
  { d: "M75 108H217", label: "run aisus-architecture", x: 150, y: 100, back: false },
  { d: "M231 142H367", label: "validate.mjs draft", x: 300, y: 134, back: false },
  { d: "M369 172H233", label: "rejected, 2 errors", x: 300, y: 164, back: true },
  { d: "M231 200H367", label: "validate again", x: 300, y: 192, back: false },
  { d: "M369 228H233", label: "accepted", x: 300, y: 220, back: true },
  { d: "M75 304H517", label: "open the map", x: 300, y: 296, back: false },
];

function sequenceScene(f: number, still: boolean): Frame {
  const selected = f >= 7 ? 1 : 0;
  const [x, y] = f < 6 ? [540, 320] : [300, 134];
  return {
    body: (
      <>
        <Pane title="Sequence: generate a map">
          <div className="fd-art">
            <svg className="fd-svg" viewBox="0 0 600 352" aria-hidden="true">
              <defs>
                <marker id="fd-call" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#3b3b3b" /></marker>
                <marker id="fd-return" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#717171" /></marker>
                <marker id="fd-picked" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={ACCENT} /></marker>
              </defs>
              <rect x="4" y="66" width="592" height="178" rx="6" fill="#f8f8f8" stroke="#e5e5e5" />
              <text x="14" y="82" fontSize="11" fontWeight="700" fill="#717171">Draw</text>
              <rect x="4" y="252" width="592" height="94" rx="6" fill="#f8f8f8" stroke="#e5e5e5" />
              <text x="14" y="268" fontSize="11" fontWeight="700" fill="#717171">Open</text>
              {[75, 225, 375, 525].map((lx) => <line key={lx} x1={lx} y1="56" x2={lx} y2="346" stroke="#717171" strokeDasharray="4 4" />)}
              <rect x="219" y="100" width="12" height="132" fill="#ffffff" stroke="#717171" />
              <rect x="369" y="134" width="12" height="98" fill="#ffffff" stroke="#388a34" />
              <rect x="519" y="296" width="12" height="40" fill="#ffffff" stroke="#1a85ff" />
              {MESSAGES.map((message, i) => {
                const picked = i === selected;
                const stroke = picked ? ACCENT : message.back ? "#717171" : "#3b3b3b";
                const marker = picked ? "url(#fd-picked)" : message.back ? "url(#fd-return)" : "url(#fd-call)";
                return (
                  <g key={message.label} className="fd-fade" opacity={f >= i ? 1 : 0}>
                    <path d={message.d} fill="none" stroke={stroke} strokeWidth={picked ? 2.5 : 1.25} strokeDasharray={message.back ? "4 3" : undefined} markerEnd={marker} />
                    <text x={message.x} y={message.y} textAnchor="middle" fontSize="11.5" fill={message.back ? "#717171" : "#3b3b3b"} stroke={i === 0 ? "#ffffff" : "#f8f8f8"} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">{message.label}</text>
                  </g>
                );
              })}
              {PARTICIPANTS.map((p) => (
                <g key={p.label}>
                  <rect x={p.x} y="12" width="124" height="44" rx="6" fill={p.fill} stroke={p.color} strokeWidth="1.5" />
                  <text x={p.x + 62} y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b3b3b">{p.label}</text>
                  <text x={p.x + 62} y="46" textAnchor="middle" fontSize="11" fill="#717171">{p.sub}</text>
                </g>
              ))}
              <SvgCursor x={x} y={y} click={f === 7} hidden={still} />
            </svg>
          </div>
        </Pane>
        {selected === 0
          ? <Editor file={GENERATE} from={149} to={155} selected={[154, 154]} />
          : <Editor file={SKILL} from={68} to={76} selected={[73, 73]} />}
      </>
    ),
    status: "aisus: 4 participants, 6 messages",
    branch: "main",
  };
}

const COMMAND = ["", "/aisus-pr", "/aisus-pr show how tours", "/aisus-pr show how tours reach the viewer"];
const PROGRESS = [
  "Reading pull request #212, Add guided tours",
  "9 files changed, 3 boxes touched",
  "Drew 5 boxes, 1 of them new",
  "The diagram is valid",
  "Commented on #212 with its aisus cloud page",
];

function pullRequestScene(f: number, tick: number): Frame {
  const posted = f >= 9;
  return {
    body: (
      <>
        <div className="fd-panel">
          <div className="fd-panel-tabs"><span>PROBLEMS</span><span>OUTPUT</span><span className="on">TERMINAL</span></div>
          <div className="fd-term">
            <div className="fd-muted">~/aisus on guided-tours</div>
            <div className="fd-prompt"><span className="fd-muted">&gt; </span>{COMMAND[Math.min(f, 3)]}<span className="fd-caret" style={{ opacity: tick % 2 ? 1 : 0 }} /></div>
            {PROGRESS.map((line, i) => <div key={line} className="fd-out fd-fade" style={{ opacity: f >= 4 + i ? 1 : 0 }}><b>●</b> {line}</div>)}
          </div>
        </div>
        <div className="fd-web">
          <div className="fd-page">
            <div className="fd-url"><span>github.com/aisusdev/aisus/pull/212</span></div>
            <div className="fd-pr">
              <div className="fd-pr-title">Add guided tours <span>#212</span></div>
              <div className="fd-pr-meta"><span className="fd-open">Open</span>4 commits into main from guided-tours</div>
              <div className={posted ? "fd-comment on" : "fd-comment"}>
                <div className="fd-comment-head"><span className="fd-avatar" /><b>you</b> commented now</div>
                <div className="fd-comment-body">
                  <div className="fd-comment-title">Show how tours reach the viewer</div>
                  <svg className="fd-svg fd-shot" viewBox="0 0 420 150" aria-hidden="true">
                    <defs><marker id="fd-pr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1f2328" /></marker></defs>
                    {["M120 40L153 66", "M120 110L153 84", "M300 75H269"].map((d) => <path key={d} d={d} fill="none" stroke="#1f2328" strokeWidth="1.25" markerEnd="url(#fd-pr-arrow)" />)}
                    <rect x="10" y="20" width="110" height="40" rx="6" fill="rgba(9,105,218,.12)" stroke="#0969da" strokeWidth="1.5" />
                    <text x="65" y="44" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2328">Sidebar</text>
                    <rect x="10" y="90" width="110" height="40" rx="6" fill="rgba(26,127,55,.12)" stroke="#1a7f37" strokeWidth="2" strokeDasharray="5 3" />
                    <text x="65" y="114" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2328">Tour skill</text>
                    <rect x="155" y="55" width="110" height="40" rx="6" fill="rgba(9,105,218,.12)" stroke="#bc4c00" strokeWidth="3" />
                    <text x="210" y="79" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2328">Viewer</text>
                    <rect x="300" y="55" width="110" height="40" rx="6" fill="rgba(154,103,0,.12)" stroke="#9a6700" strokeWidth="1.5" strokeDasharray="2 3" />
                    <text x="355" y="79" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2328">Cloud</text>
                  </svg>
                  <div className="fd-legend">
                    <span><i className="changed" />Changed in this pull request</span>
                    <span><i className="uses" />Uses changed code</span>
                    <span><i className="new" />New in this pull request</span>
                  </div>
                  <div className="fd-legend-foot"><span className="fd-link">Open in aisus cloud</span> · drawn from 3f9c2a1 by /aisus-pr</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
    status: "Claude Code",
    branch: "guided-tours",
  };
}

export function FeatureDemo({ scene, playing }: { scene: number; playing: boolean }) {
  const still = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!playing || still) return;
    const timer = setInterval(() => setTick((t) => t + 1), BEAT_MS);
    return () => clearInterval(timer);
  }, [playing, still]);
  const frames = SCENE_FRAMES[scene] ?? SCENE_FRAMES[0]!;
  const f = still ? frames - 1 : tick % frames;
  const frame = scene === 1 ? tourScene(f, still) : scene === 2 ? sequenceScene(f, still) : scene === 3 ? pullRequestScene(f, still ? 1 : tick) : mapScene(f, still);
  return (
    <div className="fd" role="img" aria-label={DESCRIPTIONS[scene] ?? DESCRIPTIONS[0]}>
      <div className="fd-window">
        <div className="fd-titlebar"><i className="r" /><i className="y" /><i className="g" /><span>aisus</span></div>
        <div className="fd-body">
          <div className="fd-activity" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5" /></svg>
            <svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></svg>
            <svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 7.5v9M18 10.5c0 4-6 3-12 6" /></svg>
            <span className="on"><MapIcon /></span>
          </div>
          <div className="fd-main" data-scene={["map", "tour", "sequence", "pr"][scene]}>{frame.body}</div>
        </div>
        <div className="fd-status">
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 7.5v9M18 10.5c0 4-6 3-12 6" /></svg>{frame.branch}</span>
          <span className="fd-status-text">{frame.status}</span>
        </div>
      </div>
    </div>
  );
}
