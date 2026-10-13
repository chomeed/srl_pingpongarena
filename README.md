# SRL PingpongArena

Elo ladder for 1v1 ping-pong matches: **https://chomeed.github.io/srl_pingpongarena/**

Tap the winner, tap the loser, press **Save result**. Results are shared live through Firebase Realtime Database.
Everyone starts at 1000, K-factor 32; fewer than 5 games is provisional (P).
Ratings are replayed from the full match history, so deleting a wrong match corrects everyone's rating.

- **2v2:** switch to 2v2, tap the two winners then the two losers. Each team's rating is the average of its two players.
- **Ladders:** *Overall* counts every match; the *1v1* and *2v2* tabs keep format-only ratings.
- **Voice:** tap **Say result** and say e.g. "Meedeum beat Gwanwoo 11 to 4" or "Hansol and Dohyeon beat Hokyun and Kyoungin".
  The players and score are filled in; check and tap Save. Works in Chrome and Safari.
- **Score is optional** (e.g. 11–7). It is shown in the history but does not change Elo; only the win counts.
- **Manage players:** rename anyone, or remove them. A player with matches is hidden instead of deleted, so their
  opponents' ratings stay the same; hidden players can be restored.

## Leaderboard skill
`.claude/skills/leaderboard` lets Claude answer "who's top of the ladder?". It can also be run directly:
`node .claude/skills/leaderboard/leaderboard.mjs --recent 5`

## Setup (once)
1. **GitHub Pages:** Settings → Pages → Source: **GitHub Actions**. Every push to the default branch redeploys.
2. **Firebase:** create a project at https://console.firebase.google.com (free Spark plan),
   add a **Realtime Database** (locked mode), and register a **Web app**.
3. Paste the web app's config into `firebase-config.js`.
4. In Realtime Database → **Rules**, paste the contents of `database.rules.json` and publish.

Without a config the page still works, but saves only on the current device.

## Backups
Every day a GitHub Action (`Daily backup`) saves all players and matches; each backup is kept for 7 days.
To restore: Actions → Daily backup → pick a run → download the `backup-YYYY-MM-DD` file, unzip it, then in Firebase
open Realtime Database → ⋮ (top right of the data view) → **Import JSON** and choose `srl-pingpongarena.json`.
Importing replaces the current players and matches with the backup.
