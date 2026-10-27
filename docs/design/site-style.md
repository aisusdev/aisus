# The aisus site style

Every page of aisus cloud, public and signed in, uses one light design. `apps/cloud/src/app/site-redesign.css` holds its tokens and loads after `globals.css`, so its values win. The map viewer keeps its own theme.

## Colour

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f7f9f4` | Page background |
| `--paper-2` | `#eaf0e8` | Table headers, hover fills and quiet panels |
| `--white` | `#fffef9` | Inputs and cards that sit on paper |
| `--forest` | `#142b22` | Primary buttons, bands, the product frame and text on lime |
| `--text` | `#182a22` | Body text |
| `--text-2` | `#4f6055` | Secondary text |
| `--line` | `#cad1c6` | Borders and dividers |
| `--accent` | `#c8ef72` | Lime for selection, status dots and the primary button on forest |

Links and hover states use the deeper greens `#477646` and `#315f3d`. Danger uses `#9b342d`.

## Type

Headlines use Space Grotesk SemiBold through `--display`. The site serves the font from `apps/cloud/public/fonts/` under the SIL Open Font License. Body text uses Avenir Next through `--sans`, falling back to Helvetica Neue and the system font. Code uses the system monospace stack through `--mono`. Body text is 16 pixels, and nothing on a page is smaller.

## Shape

Buttons are at least 48 pixels tall with a 3-pixel radius. A primary button is forest with white text. A secondary button is a forest outline on paper. On a forest band, the primary button turns lime with forest text. Page content sits in a column up to 1248 pixels wide, with side gutters of 24 to 64 pixels on desktop and 20 pixels on phones. The header keeps 16-pixel gutters on phones.

## Mockups

[onboarding-mockup.html](onboarding-mockup.html) shows the signed-in first run in this style.
