// CLD-17: a branch's map merged into the default branch's map, with ours winning each conflict.
import { expect, test } from "vitest";
import { mergeMaps } from "@aisus/core/model/mergeMaps";

const box = (id: string, label: string, path = `src/${id}.ts`): { id: string; label: string; type: string; tag?: string; sources: { path: string }[] } => ({ id, label, type: "backend", sources: [{ path }] });

const BASE = {
  meta: { title: "Shop" },
  components: [box("web", "Web"), box("api", "API"), box("jobs", "Jobs"), box("db", "DB")],
  connections: [
    { from: "web", to: "api", label: "calls" },
    { from: "api", to: "db" },
    { from: "jobs", to: "api" },
  ],
  boundaries: [
    { kind: "region", label: "Backend", wraps: ["api", "jobs"] },
    { kind: "region", label: "Data", wraps: ["db"] },
  ],
};

/** A copy of the base map with `edit` applied. */
function edited(edit: (map: typeof BASE) => void): typeof BASE {
  const map = structuredClone(BASE);
  edit(map);
  return map;
}

const relabel = (map: typeof BASE, id: string, label: string) => {
  map.components.find((entry) => entry.id === id)!.label = label;
};

test("CLD-17 when only one side changed the map, the result is that side's map", () => {
  const ours = edited((map) => relabel(map, "web", "Web app"));
  const theirs = edited((map) => relabel(map, "api", "API server"));
  const theirsSame = edited((map) => void (map.meta.title = "Shop (branch)"));
  const keepOurs = mergeMaps(BASE, ours, theirsSame);
  expect(keepOurs.outcome).toBe("ours");
  expect(keepOurs.map).toBe(ours);
  const takeTheirs = mergeMaps(BASE, structuredClone(BASE), theirs);
  expect(takeTheirs.outcome).toBe("theirs");
  expect(takeTheirs.map).toBe(theirs);
});

test("CLD-17 each side's changes apply; a box both changed differently keeps ours and is a conflict, and the same change on both sides is not", () => {
  const ours = edited((map) => {
    (map as Record<string, unknown>).layout = { direction: "LR" };
    relabel(map, "api", "API gateway");
    relabel(map, "db", "Postgres");
  });
  const theirs = edited((map) => {
    relabel(map, "api", "API server");
    relabel(map, "db", "Postgres");
    relabel(map, "web", "Web app");
    map.connections[0]!.label = "requests";
  });
  const result = mergeMaps(BASE, ours, theirs);
  expect(result.outcome).toBe("merged");
  expect(result.map.meta).toEqual({ title: "Shop" });
  expect(result.map.layout).toEqual({ direction: "LR" });
  expect(result.map.components).toEqual([box("web", "Web app"), box("api", "API gateway"), box("jobs", "Jobs"), box("db", "Postgres")]);
  expect(result.map.connections).toEqual([{ from: "web", to: "api", label: "requests" }, { from: "api", to: "db" }, { from: "jobs", to: "api" }]);
  expect(result.conflicts).toEqual([{ kind: "box", name: "API gateway", reason: "both-changed" }]);
});

test("CLD-17 an element changed on one side and removed on the other is a conflict, and the result keeps ours's state of it", () => {
  const ours = edited((map) => {
    relabel(map, "jobs", "Workers");
    map.components = map.components.filter((entry) => entry.id !== "db");
    map.connections = map.connections.filter((arrow) => arrow.to !== "db");
    map.boundaries = map.boundaries.filter((boundary) => boundary.label !== "Data");
  });
  const theirs = edited((map) => {
    map.components = map.components.filter((entry) => entry.id !== "jobs");
    map.connections = map.connections.filter((arrow) => arrow.from !== "jobs");
    map.boundaries[0]!.wraps = ["api"];
    map.components.find((entry) => entry.id === "db")!.type = "database";
  });
  const result = mergeMaps(BASE, ours, theirs);
  expect(result.map.components).toEqual([box("web", "Web"), box("api", "API"), box("jobs", "Workers")]);
  expect(result.map.boundaries).toEqual([{ kind: "region", label: "Backend", wraps: ["api", "jobs"] }]);
  expect(result.conflicts).toEqual([
    { kind: "box", name: "Workers", reason: "changed-and-removed" },
    { kind: "box", name: "DB", reason: "changed-and-removed" },
  ]);
});

test("CLD-17 an arrow whose end the other side removed is dropped, and a boundary loses removed members and goes when it has none", () => {
  const ours = edited((map) => {
    map.components = map.components.filter((entry) => entry.id !== "jobs");
    map.connections = map.connections.filter((arrow) => arrow.from !== "jobs");
    map.boundaries[0]!.wraps = ["api"];
    map.connections.push({ from: "web", to: "db" });
  });
  const theirs = edited((map) => {
    map.connections.push({ from: "jobs", to: "web", label: "notifies" });
    map.components = map.components.filter((entry) => entry.id !== "db");
    map.connections = map.connections.filter((arrow) => arrow.to !== "db");
    map.boundaries[1]!.wraps = [];
  });
  const result = mergeMaps(BASE, ours, theirs);
  expect(result.map.components).toEqual([box("web", "Web"), box("api", "API")]);
  expect(result.map.connections).toEqual([{ from: "web", to: "api", label: "calls" }]);
  expect(result.map.boundaries).toEqual([{ kind: "region", label: "Backend", wraps: ["api"] }]);
  expect(result.conflicts).toEqual([]);
});

test("CLD-17 boxes both sides added that pair become ours's box, and theirs's arrows and members follow it", () => {
  const ours = edited((map) => {
    map.components.push(box("mail", "Mail", "src/mail/send.ts"));
    map.boundaries[0]!.label = "Services";
  });
  const theirs = edited((map) => {
    map.components.push({ ...box("mailer", "Mail", "src/mail/send.ts"), tag: "SMTP" });
    map.connections.push({ from: "api", to: "mailer", label: "sends" });
    map.boundaries[0]!.wraps.push("mailer");
  });
  const result = mergeMaps(BASE, ours, theirs);
  expect(result.map.components).toEqual([...BASE.components, box("mail", "Mail", "src/mail/send.ts")]);
  expect(result.map.connections).toEqual([...BASE.connections, { from: "api", to: "mail", label: "sends" }]);
  expect(result.map.boundaries).toEqual([{ kind: "region", label: "Services", wraps: ["api", "jobs", "mail"] }, BASE.boundaries[1]]);
  expect(result.conflicts).toEqual([{ kind: "box", name: "Mail", reason: "both-changed" }]);
});

test("CLD-17 a box from theirs whose id another box already has gets a new id, and its arrows follow it", () => {
  const ours = edited((map) => {
    map.components.push(box("server", "Game server", "src/game/server.ts"));
    map.connections.push({ from: "server", to: "db" });
  });
  const theirs = edited((map) => {
    map.components[1] = box("server", "API server", "src/api.ts");
    map.connections = map.connections.map((arrow) => ({ ...arrow, from: arrow.from.replace("api", "server"), to: arrow.to.replace("api", "server") }));
    map.boundaries[0]!.wraps = ["server", "jobs"];
  });
  const result = mergeMaps(BASE, ours, theirs);
  expect(result.map.components).toEqual([box("web", "Web"), box("server-2", "API server", "src/api.ts"), box("jobs", "Jobs"), box("db", "DB"), box("server", "Game server", "src/game/server.ts")]);
  expect(result.map.connections).toEqual([
    { from: "web", to: "server-2", label: "calls" },
    { from: "server-2", to: "db" },
    { from: "jobs", to: "server-2" },
    { from: "server", to: "db" },
  ]);
  expect(result.map.boundaries).toEqual([{ kind: "region", label: "Backend", wraps: ["server-2", "jobs"] }, BASE.boundaries[1]]);
  expect(result.conflicts).toEqual([]);
});

test("CLD-17 without a base, both maps' elements are merged and ours wins each element that differs", () => {
  const ours = { meta: { title: "Ours" }, components: [box("web", "Web"), box("api", "API")], connections: [{ from: "web", to: "api", label: "calls" }] };
  const theirs = {
    meta: { title: "Theirs" },
    components: [box("web", "Website"), box("api", "API"), box("db", "DB")],
    connections: [{ from: "web", to: "api", label: "calls" }, { from: "api", to: "db" }],
    boundaries: [{ kind: "region", label: "Data", wraps: ["db"] }],
  };
  const result = mergeMaps(null, ours, theirs);
  expect(result.outcome).toBe("merged");
  expect(result.map).toEqual({
    meta: { title: "Ours" },
    components: [box("web", "Web"), box("api", "API"), box("db", "DB")],
    connections: [{ from: "web", to: "api", label: "calls" }, { from: "api", to: "db" }],
    boundaries: [{ kind: "region", label: "Data", wraps: ["db"] }],
  });
  expect(result.conflicts).toEqual([{ kind: "box", name: "Web", reason: "both-changed" }]);
});
