// SEQ-03: lays out a sequence map from message order alone (ADR 0069). Participants sit in
// columns across the top, and each message takes one row below the last. Browser-safe.
import type { ViewSequence } from "../model/tolerant";
import type { ComponentType, MessageVariant } from "../model/types";
import { LABEL_PX, SUBLABEL_PX } from "./measure";
import type { MeasureText, Point, Rect } from "./scene";

export const MESSAGE_PX = 12;
export const NOTE_PX = 11;
export const PHASE_PX = 12;

/** Margin around the drawing. */
const MARGIN = 40;
const HEAD_MIN_W = 110;
const HEAD_PAD_X = 14;
const HEAD_PAD_Y = 10;
/** Least room between two neighbouring participant boxes. */
const HEAD_GAP = 32;
/** Room a message label keeps beyond its own width, split over both ends. */
const LABEL_PAD = 28;
/** Room above the first message, below the boxes. */
const FIRST_ROW = 36;
/** Height of a message row without a note or a loop. */
const ROW = 40;
const NOTE_LINE = 15;
/** A call to itself loops this far to the right and down. */
const LOOP_W = 30;
const LOOP_H = 20;
const ACTIVATION_W = 10;
/** Each nested activation sits this far right of the one it is in. */
const NEST_DX = 5;
/** An activation reaches this far above its first message and below its last. */
const ACTIVATION_PAD = 6;
const PHASE_PAD_X = 12;
/** Space between a message label's baseline and its arrow. */
const LABEL_GAP = 10;

export interface SequenceParticipant {
  id: string;
  index: number;
  type: ComponentType;
  rect: Rect;
  /** The lifeline's x. */
  x: number;
}

export interface SequenceMessage {
  id: string;
  index: number;
  variant: MessageVariant;
  /** The arrow, from the sender to the receiver; a call to itself has four points. */
  points: Point[];
  label: string;
  labelAt: Point;
  labelAnchor: "middle" | "start";
  note?: string;
  noteAt?: Point;
}

export interface SequenceActivation {
  /** Index into the participants. */
  participant: number;
  depth: number;
  rect: Rect;
}

export interface SequencePhase {
  index: number;
  label: string;
  rect: Rect;
  labelAt: Point;
}

export interface SequenceScene {
  participants: SequenceParticipant[];
  lifelines: { x: number; top: number; bottom: number }[];
  activations: SequenceActivation[];
  phases: SequencePhase[];
  messages: SequenceMessage[];
  bounds: Rect;
}

interface Open {
  start: number;
  depth: number;
  /** The y of the latest message the participant sent or received while this was open. */
  last: number;
}

export function layoutSequence(sequence: ViewSequence, measure: MeasureText): SequenceScene {
  const { participants, messages, phases } = sequence;
  const count = participants.length;
  const labelWidth = (text: string): number => measure(text, MESSAGE_PX, false).width;
  /** The wider of a message's label and its note. */
  const textWidth = (label: string, note?: string): number => Math.max(labelWidth(label), note ? measure(note, NOTE_PX, false).width : 0);

  // Columns: each box fits its text, and each gap fits its boxes and the labels of the messages across it.
  const heads = participants.map((p) => {
    const label = measure(p.label, LABEL_PX, true);
    const sub = p.sublabel ? measure(p.sublabel, SUBLABEL_PX, false) : { width: 0, height: 0 };
    return { w: Math.max(HEAD_MIN_W, Math.max(label.width, sub.width) + 2 * HEAD_PAD_X), h: label.height + sub.height + 2 * HEAD_PAD_Y };
  });
  const headH = Math.max(...heads.map((head) => head.h));
  const gaps = heads.slice(1).map((head, i) => heads[i]!.w / 2 + head.w / 2 + HEAD_GAP);
  let trailing = 0;
  for (const message of messages) {
    const need = textWidth(message.label, message.note) + LABEL_PAD;
    if (message.from === message.to) {
      const room = LOOP_W + need;
      if (message.from < count - 1) gaps[message.from] = Math.max(gaps[message.from]!, room + heads[message.from + 1]!.w / 2);
      else trailing = Math.max(trailing, room - heads[message.from]!.w / 2);
      continue;
    }
    const lo = Math.min(message.from, message.to);
    const hi = Math.max(message.from, message.to);
    const span = gaps.slice(lo, hi).reduce((sum, gap) => sum + gap, 0);
    if (span < need) for (let g = lo; g < hi; g++) gaps[g]! += (need - span) / (hi - lo);
  }

  const phaseLabels = phases.map((phase) => measure(phase.label, PHASE_PX, true).width);
  const gutter = phases.length > 0 ? Math.max(...phaseLabels) + 2 * PHASE_PAD_X : 0;
  const xs: number[] = [];
  participants.forEach((_, i) => xs.push(i === 0 ? MARGIN + gutter + heads[0]!.w / 2 : xs[i - 1]! + gaps[i - 1]!));
  const right = Math.max(xs[count - 1]! + heads[count - 1]!.w / 2 + Math.max(0, trailing), ...xs);

  const headTop = MARGIN;
  const sceneParticipants: SequenceParticipant[] = participants.map((p, i) => ({
    id: p.id,
    index: i,
    type: p.type,
    rect: { x: xs[i]! - heads[i]!.w / 2, y: headTop, w: heads[i]!.w, h: headH },
    x: xs[i]!,
  }));

  // Rows, and activations from calls and returns.
  const stacks: Open[][] = participants.map(() => []);
  const activations: SequenceActivation[] = [];
  const rows: { top: number; bottom: number }[] = [];
  const sceneMessages: SequenceMessage[] = [];
  let cursor = headTop + headH + FIRST_ROW;
  const edgeX = (participant: number, toward: number): number => {
    const top = stacks[participant]!.at(-1);
    if (top === undefined) return xs[participant]!;
    const centre = xs[participant]! + top.depth * NEST_DX;
    return centre + (toward > xs[participant]! ? ACTIVATION_W / 2 : -ACTIVATION_W / 2);
  };
  const close = (participant: number, end: number): void => {
    const open = stacks[participant]!.pop();
    end = Math.max(end, open?.start ?? end);
    if (open === undefined) return;
    const x = xs[participant]! + open.depth * NEST_DX - ACTIVATION_W / 2;
    activations.push({ participant, depth: open.depth, rect: { x, y: open.start - ACTIVATION_PAD, w: ACTIVATION_W, h: end - open.start + 2 * ACTIVATION_PAD } });
  };

  messages.forEach((message, i) => {
    const top = cursor;
    const y = top + MESSAGE_PX + LABEL_GAP + 4;
    const self = message.from === message.to;
    const label = message.label;
    let points: Point[];
    let labelAt: Point;
    let labelAnchor: "middle" | "start" = "middle";
    if (self) {
      const x = edgeX(message.from, Number.POSITIVE_INFINITY);
      points = [{ x, y }, { x: x + LOOP_W, y }, { x: x + LOOP_W, y: y + LOOP_H }, { x, y: y + LOOP_H }];
      labelAt = { x: x + LOOP_W + 6, y: y + LOOP_H / 2 };
      labelAnchor = "start";
    } else {
      if (stacks[message.from]!.length === 0 && message.variant !== "return") stacks[message.from]!.push({ start: y, depth: 0, last: y });
      if (message.variant === "return") {
        const from = edgeX(message.from, xs[message.to]!);
        close(message.from, y);
        points = [{ x: from, y }, { x: edgeX(message.to, xs[message.from]!), y }];
      } else {
        const from = edgeX(message.from, xs[message.to]!);
        stacks[message.to]!.push({ start: y, depth: stacks[message.to]!.length, last: y });
        points = [{ x: from, y }, { x: edgeX(message.to, xs[message.from]!), y }];
      }
      labelAt = { x: (points[0]!.x + points[1]!.x) / 2, y: y - LABEL_GAP };
    }
    let bottom = y + (self ? LOOP_H : 0);
    for (const participant of [message.from, message.to]) {
      const open = stacks[participant]!.at(-1);
      if (open) open.last = bottom;
    }
    const scene: SequenceMessage = { id: message.id, index: i, variant: message.variant, points, label, labelAt, labelAnchor };
    if (message.note) {
      scene.note = message.note;
      scene.noteAt = { x: labelAt.x, y: bottom + NOTE_LINE };
      bottom += NOTE_LINE;
    }
    sceneMessages.push(scene);
    rows.push({ top, bottom });
    cursor = Math.max(top + ROW, bottom + ROW - (y - top));
  });

  const lastY = sceneMessages.length > 0 ? rows.at(-1)!.bottom : headTop + headH + FIRST_ROW;
  // A participant that never returns stays active until the last message it sent or received.
  stacks.forEach((stack, participant) => {
    while (stack.length > 0) close(participant, stack.at(-1)!.last);
  });
  activations.sort((a, b) => a.participant - b.participant || a.depth - b.depth || a.rect.y - b.rect.y);
  const lifelineBottom = lastY + FIRST_ROW / 2;

  const scenePhases: SequencePhase[] = phases.map((phase, index) => {
    const y = rows[phase.first]!.top;
    const h = rows[phase.last]!.bottom + ACTIVATION_PAD * 2 - y;
    return { index, label: phase.label, rect: { x: MARGIN, y, w: right + PHASE_PAD_X - MARGIN, h }, labelAt: { x: MARGIN + PHASE_PAD_X, y: y + PHASE_PX } };
  });

  const labelRight = Math.max(
    ...sceneMessages.map((m) => m.labelAt.x + textWidth(m.label, m.note) / (m.labelAnchor === "start" ? 1 : 2)),
    right + PHASE_PAD_X,
  );
  return {
    participants: sceneParticipants,
    lifelines: xs.map((x) => ({ x, top: headTop + headH, bottom: lifelineBottom })),
    activations,
    phases: scenePhases,
    messages: sceneMessages,
    bounds: { x: 0, y: 0, w: labelRight + MARGIN, h: lifelineBottom + MARGIN },
  };
}
