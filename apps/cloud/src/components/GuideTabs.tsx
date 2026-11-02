"use client";
// The Get Started page's tabs on a step panel, and the agent choice that both its agent tabs and its skill command read.
// The browser remembers the agent, and a link to a tab's id opens that tab.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

export interface Tab { id: string; name: string; content: ReactNode }

function TabStrip({ tabs, label, selected, onSelect }: { tabs: Tab[]; label: string; selected: number; onSelect: (index: number) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    onSelect(next);
    buttons.current[next]?.focus();
  };
  return (
    <div className="steps-panel">
      <div className="panel-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(node) => { buttons.current[i] = node; }}
            type="button"
            role="tab"
            id={`${tab.id}-tab`}
            aria-selected={i === selected}
            aria-controls={tab.id}
            tabIndex={i === selected ? 0 : -1}
            onClick={() => onSelect(i)}
            onKeyDown={(event) => move(event, i)}
          >
            {tab.name}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.id} className="panel-body" role="tabpanel" id={tab.id} aria-labelledby={`${tab.id}-tab`} hidden={i !== selected}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}

/** Tabs whose choice lasts only while the page is open. */
export function PanelTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    const follow = () => {
      const index = tabs.findIndex((tab) => `#${tab.id}` === window.location.hash);
      if (index < 0) return;
      setSelected(index);
      requestAnimationFrame(() => document.getElementById(tabs[index]!.id)?.scrollIntoView({ block: "center" }));
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [tabs]);
  return <TabStrip tabs={tabs} label={label} selected={selected} onSelect={setSelected} />;
}

export const AGENTS = ["Claude Code", "Codex", "Devin"] as const;
export type AgentName = (typeof AGENTS)[number];
const STORE = "aisus.guide.agent";
const CHANGED = "aisus:guide-agent";

function useAgent(): [AgentName, (agent: AgentName) => void] {
  const [agent, setAgent] = useState<AgentName>("Claude Code");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORE);
      if (AGENTS.includes(saved as AgentName)) setAgent(saved as AgentName);
    } catch {
      // Without storage the page starts at Claude Code each time.
    }
    const changed = (event: Event) => setAgent((event as CustomEvent<AgentName>).detail);
    window.addEventListener(CHANGED, changed);
    return () => window.removeEventListener(CHANGED, changed);
  }, []);
  const choose = (next: AgentName) => {
    try {
      window.localStorage.setItem(STORE, next);
    } catch {
      // The choice still holds for this visit.
    }
    window.dispatchEvent(new CustomEvent(CHANGED, { detail: next }));
  };
  return [agent, choose];
}

/** One tab per agent. Choosing one also sets the skill command and is remembered. */
export function AgentTabs({ panels }: { panels: Record<AgentName, ReactNode> }) {
  const [agent, choose] = useAgent();
  const tabs = AGENTS.map((name) => ({ id: `agent-${name.toLowerCase().replace(/\s+/g, "-")}`, name, content: panels[name] }));
  return <TabStrip tabs={tabs} label="Agents" selected={AGENTS.indexOf(agent)} onSelect={(index) => choose(AGENTS[index]!)} />;
}

/** The skill command for the chosen agent: `$` in Codex, `/` in Claude Code and Devin. */
export function SkillCommand() {
  const [agent] = useAgent();
  const command = `${agent === "Codex" ? "$" : "/"}aisus-architecture checkout flow`;
  return (
    <>
      <p className="code-label">In {agent}</p>
      <CodeBlock code={command} label={`the ${agent} command`} language="shell" />
    </>
  );
}
