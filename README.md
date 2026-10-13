# SRL PingpongArena

Elo ladder for 1v1 ping-pong matches: **https://chomeed.github.io/srl_pingpongarena/**

Tap the winner, tap the loser, press **Save result**. Results are shared live through Firebase Realtime Database.
Everyone starts at 1000, K-factor 32; fewer than 5 games is provisional (P).
Ratings are replayed from the full match history, so deleting a wrong match corrects everyone's rating.

## Setup (once)
1. **GitHub Pages:** Settings → Pages → Source: **GitHub Actions**. Every push to the default branch redeploys.
2. **Firebase:** create a project at https://console.firebase.google.com (free Spark plan),
   add a **Realtime Database** (locked mode), and register a **Web app**.
3. Paste the web app's config into `firebase-config.js`.
4. In Realtime Database → **Rules**, paste the contents of `database.rules.json` and publish.

Without a config the page still works, but saves only on the current device.
