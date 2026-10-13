# SRL PingpongArena

Elo ladder for 1v1 ping-pong matches. Live app: https://claude.ai/artifact/SsPub6pHn4ZNKjzVDfiVWW

- Log a match in three taps: winner, loser, **Save result**. No scores.
- Everyone starts at 1000, K-factor 32. Players with fewer than 5 games are marked provisional.
- Ratings are replayed from the full match history, so deleting a wrong match corrects everyone's rating.
- Data is shared live through the artifact's database (`players` and `matches` collections).
  Opened outside claude.ai (e.g. as a plain HTML file), `index.html` falls back to saving on the local device.
