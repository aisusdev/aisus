# Plan map format for aisus

A plan map is an architecture map in the format `map-format.md` describes, of the system as a spec will leave it. Every rule there holds, with the additions below.

## Tags

Each box's `tag` says what the spec does to it:

- No tag: existing code the spec leaves alone. Show it only when it helps the reader place the change, such as a caller or a store the new code uses.
- `changed`: existing code the spec edits. Cite the lines that will change.
- `removed`: existing code the spec deletes. Cite that code. Keep its connections, so the reader sees what loses it.
- `new`: code the spec adds. Cite the passage of the spec that asks for it, in the run's `spec.md`, by its repository-relative path and lines. Also cite the existing code it plugs into when there is such a place, such as the registration it joins or the function that will call it. Use at most 3 sources in total.

Only a `new` box may cite `spec.md`, and only the `spec.md` of its own run. Use no other tags in a plan.

## Labels

A `new` box's label says what the spec asks the code to do, in the same style as an existing box's label. A `changed` box's sublabel says what changes, such as "Also exports to PDF". A `removed` box keeps the label of what it does today.

## Connections

Draw the connections the spec adds or changes as `emphasis`, and keep the existing ones as they are. A connection to or from a `new` box is planned, so no import backs it yet. The evidence review leaves those connections out.

## Size

Show at most 15 boxes tagged `new`, `changed` or `removed`. When the spec needs more, draw its top level, one box per part, and say in the report which parts to plan on their own. With a base map, keep the base's other boxes, so the plan reads as the map the reader knows with the change on it.

## Cards

Add a card titled "Open questions" (`dot: "amber"`) with the questions the spec leaves open that change the picture. Add a card titled "Not in the code" (`dot: "rose"`) with what the spec assumes and the code does not have, such as a table, a setting or a service that does not exist. Leave out a card with no items. Keep each item short.

## Already built

When the code already does everything the spec asks, tag nothing. The validator then warns `PlanWithoutChange`, and the report says so with the boxes that show it.
