# aisus cloud

aisus cloud puts your maps on the web at [aisus.dev](https://aisus.dev), so your team can open them in a browser without installing anything. Only maps and check results are uploaded, never your code.

## What you get

- Your repository's map in the browser, with its tour.
- A page for each pull request, showing the boxes it touches.
- Read-only links you can send to anyone.
- A dashboard for your team's repositories.

## Before you start

1. Sign in at [aisus.dev](https://aisus.dev) with GitHub.
2. Choose a plan in Settings. The cloud keeps maps on Pro and Team. On Free, the extension, the skills and the pull request comment still work, all locally.

| Plan | Price | What the cloud keeps |
|---|---|---|
| Free | No cost | No maps |
| Pro | US$5 a month | The maps of your own repositories, public and private, with their history, pull request pages and share links |
| Team | US$10 per seat a month | The same for an organization's repositories, and the team dashboard |

## Share a map from VS Code

1. At the bottom of the aisus sidebar, next to "aisus cloud is off", click **Turn on**, and tick the setting that opens.
2. In the sidebar's Maps list, open a map's **⋯** menu and choose **Share to aisus cloud**.
3. Choose **Team space** to share it with your team, or **Personal space** to keep it to yourself.
4. Sign in with GitHub if VS Code asks.
5. aisus shows exactly what it will send. Click **Send**.

The map opens at `aisus.dev/cloud/u/<owner>/<repo>`.

## Share a map from a terminal

1. On aisus.dev, open your repository's settings and create an upload token.
2. Download `aisus.mjs` from the [latest release](https://github.com/aisusdev/aisus/releases).
3. On your default branch, run this command with your token.

   ```bash
   AISUS_TOKEN=<your token> node aisus.mjs publish --url https://aisus.dev
   ```

## Update the map on every pull request

Add the aisus GitHub Action, then turn on its upload. Each pull request then gets its own page, and each merge updates the main map. [The GitHub Action guide](github-action.md#upload-to-aisus-cloud) shows the three lines to add.

## Share a map with someone outside your team

In your repository's settings, create a share link. Anyone with the link can view the map, without signing in. A link lasts 1, 7 or 30 days, and you can turn it off at any time.

## Your data

- Settings exports all your data as one JSON file.
- Each repository's settings list every upload and how it was signed.
- **Delete my account** in Settings removes your account and every space it owns at once.

## Host it yourself

You can run your own aisus cloud. Without Stripe keys, every account gets everything.

1. Create a GitHub OAuth app.
2. Set `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
3. Run `docker compose -f infra/local/compose.yaml up --build`.
