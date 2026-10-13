# SRL PingpongArena

Elo ladder for 1v1 ping-pong matches, hosted on GitHub Pages:
**https://chomeed.github.io/srl_pingpongarena/**

## Logging a match
1. Tap the winner, tap the loser, press **Save on GitHub**.
2. GitHub opens a pre-filled issue. Press **Create**.
3. A GitHub Action records it in `data.json`, closes the issue, and redeploys the site (about a minute).
   Your own device shows the result straight away, marked *pending*.

Adding players and deleting a wrong match work the same way. A match can be deleted by whoever logged it or by a repo collaborator.
Everyone needs a (free) GitHub account to log results.

## Rating
Everyone starts at 1000, K-factor 32. Players with fewer than 5 games are marked provisional (P).
Ratings are replayed from the full history in `data.json`, so deleting or editing a match corrects everyone's rating.

## Setup (once)
Settings → Pages → Build and deployment → Source: **GitHub Actions**.
