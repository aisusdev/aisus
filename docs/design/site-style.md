# The aisus site style

Every page of aisus cloud, public and signed in, uses one light design. `apps/cloud/src/app/site-redesign.css` holds its tokens and loads after `globals.css`, so its values win. The map viewer keeps its own theme. Public pages sit on white inside `.site-page`, and signed-in pages sit on white inside `.cloud-page`. The signed-in rail and the sign-in page's pitch keep the pale green paper. [homepage.md](homepage.md) describes the homepage.

## Colour

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f7f9f4` | The page background. Public and signed-in pages set it to white, and the signed-in rail keeps `#f7f9f4` |
| `--paper-2` | `#eaf0e8` | Table headers, hover fills and quiet panels |
| `--white` | `#fffef9` | Inputs and cards that sit on paper |
| `--forest` | `#142b22` | Primary buttons, bands, the product frame and text on lime |
| `--text` | `#182a22` | Body text |
| `--text-2` | `#4f6055` | Secondary text |
| `--line` | `#cad1c6` | Borders and dividers |
| `--accent` | `#c8ef72` | Lime for selection, status dots and the primary button on forest |
| `--pink` | `#c92c6d` | The action colour: primary buttons, progress, link hover and the bar on an active tab or nav item. On forest it appears only as a fill |

Links and hover states use the deeper greens `#477646` and `#315f3d`. Danger uses `#9b342d`.

## Type

Headlines use Poppins SemiBold through `--display`. The site serves the font from `apps/cloud/public/fonts/` under the SIL Open Font License, in `OFL-Poppins.txt`. Space Grotesk stays in that folder for the older mockups here. Body text uses Avenir Next through `--sans`, falling back to Helvetica Neue and the system font. Code uses the system monospace stack through `--mono`. Body text is 16 pixels, and nothing on a page is smaller.

## Shape

Buttons are at least 48 pixels tall with a 3-pixel radius. A primary button is pink with white text. A secondary button is a forest outline on paper. On a forest band, the primary button turns lime with forest text. Cards, such as the Pricing plans and the signed-in account cards, are white with 16-pixel corners, a soft shadow and no border. Page content sits in a column up to 1248 pixels wide, with side gutters of 24 to 64 pixels on desktop and 20 pixels on phones. The header keeps 16-pixel gutters on phones.

## Mockups

[onboarding-mockup.html](onboarding-mockup.html) shows the signed-in first run in this style. [pr-diagrams-mockup.html](pr-diagrams-mockup.html) shows PRC-07's comment, the pull request page's diagrams and the diagram page.
