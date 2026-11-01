"use client";
// The homepage's feature tabs (docs/design/homepage.md). The tabs advance when the active tab's progress bar fills,
// and a button pauses them. A visitor who prefers reduced motion chooses each tab by hand.
import { useEffect, useState } from "react";
import { BEAT_MS, FeatureDemo, SCENE_FRAMES, useReducedMotion } from "./FeatureDemo";

const FEATURES = [
  { label: "Interactive diagram", text: "Click a box to open the lines it cites. Every save checks each box against its code." },
  { label: "Follow guided tour", text: "Your agent writes a tour through the map. Each stop opens its code and asks you a question." },
  { label: "Sequence diagram", text: "See the calls in a flow, in order. Each message opens the line that makes it." },
  { label: "/aisus-pr", text: "Run /aisus-pr on a branch. The pull request gets a diagram of what it changes." },
];
const STEP_MS = 100;

export function FeatureTabs() {
  const still = useReducedMotion();
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const running = !paused && !still;
  const duration = (SCENE_FRAMES[active] ?? 0) * BEAT_MS;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((e) => e + STEP_MS), STEP_MS);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (elapsed < duration) return;
    setActive((a) => (a + 1) % FEATURES.length);
    setElapsed(0);
  }, [elapsed, duration]);

  const choose = (index: number) => {
    setActive(index);
    setElapsed(0);
  };

  return (
    <section className="features" id="features" aria-label="Features">
      <div className="features-stage">
        <FeatureDemo key={active} scene={active} playing={running} />
      </div>
      <div className="feature-tabs">
        {FEATURES.map((feature, i) => (
          <button key={feature.label} type="button" className="feature-tab" aria-pressed={i === active} onClick={() => choose(i)}>
            {feature.label}
            {i === active && !still ? <span className="feature-progress" style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }} /> : null}
          </button>
        ))}
        {still ? null : (
          <button type="button" className="feature-pause" aria-label={paused ? "Play the demos" : "Pause the demos"} onClick={() => setPaused(!paused)}>
            {paused
              ? <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path className="fill" d="M7 4.5v15l12-7.5z" /></svg>
              : <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>}
          </button>
        )}
      </div>
      <p className="feature-text">{FEATURES[active]?.text}</p>
    </section>
  );
}
