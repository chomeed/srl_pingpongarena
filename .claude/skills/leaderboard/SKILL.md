---
name: leaderboard
description: Show the current SRL PingpongArena ping-pong ladder (overall Elo rankings counting 1v1 and 2v2, W-L records, recent matches; --json also has 1v1-only and 2v2-only ladders). Use when someone asks who's on top, the current leaderboard/rankings, someone's rating, or recent ping-pong results.
---

# SRL PingpongArena leaderboard

Run the script from the repository root (Node 18+, no dependencies):

```bash
node .claude/skills/leaderboard/leaderboard.mjs --recent 5
```

- `--recent N` adds the last N matches; omit it for the ladder only.
- `--json` prints machine-readable output, handy for answering a specific question (one player's rating, head-to-head).

It reads the public Firebase Realtime Database the site uses and replays every match with the same Elo rules as the site (start 1000, K 32; 2v2 counts half in Overall), so numbers match https://chomeed.github.io/srl_pingpongarena/.

When replying, show the ladder as a short ranked list (rank, name, Elo, W-L), mark provisional players, and link the site so people can log a match. Results are read-only here: matches are logged on the site.
