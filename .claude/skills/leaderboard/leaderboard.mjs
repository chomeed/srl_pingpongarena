#!/usr/bin/env node
// Prints the current SRL PingpongArena ladder from the Firebase Realtime Database.
// Usage: node leaderboard.mjs [--recent N] [--json]
// Rating rules live in arena-core.mjs (shared with the Slack command).
import { computeArena, fetchArena, isDoubles, teams, SITE } from "../../../arena-core.mjs";
const DB = process.env.ARENA_DB_URL || "https://srl-pingpongarena-default-rtdb.asia-southeast1.firebasedatabase.app";

const args = process.argv.slice(2);
const recentN = Number(args[args.indexOf("--recent") + 1]) || (args.includes("--recent") ? 5 : 0);
const asJson = args.includes("--json");

const raw = await fetchArena(DB);
const { matches, ladder: rankFor, team } = computeArena(raw.players, raw.matches);
const strip = l => l.map(({ id, form, ...p }) => p);
const ladder = strip(rankFor("o"));
const recent = matches.slice(-recentN).reverse().map(m => ({
  winner: team(teams(m)[0]), loser: team(teams(m)[1]), doubles: isDoubles(m), delta: m.delta,
  score: m.winnerScore != null ? `${m.winnerScore}-${m.loserScore}` : null, at: new Date(m.at).toISOString(),
}));

if (args.includes("--slack")) {
  // Slack mrkdwn message for the Incoming Webhook.
  const medal = r => ["🥇", "🥈", "🥉"][r - 1] || `${r}.`;
  const lines = ladder.length
    ? ladder.map(p => `${medal(p.rank)} *${p.name}* · ${p.tier} · ${p.elo} · ${p.wins}–${p.losses}`)
    : ["No players on the ladder yet."];
  let text = `🏓 *SRL PingpongArena ladder* (${matches.length} matches)\n` + lines.join("\n");
  if (recentN && recent.length) text += "\n\n*Recent:* " + recent.map(m => `${m.winner} beat ${m.loser}${m.doubles ? " (2v2)" : ""}${m.score ? ` ${m.score}` : ""}`).join(" · ");
  text += `\n<${SITE}|Log a match>`;
  console.log(JSON.stringify({ text }));
  process.exit(0);
}
if (asJson) { console.log(JSON.stringify({ ladder, singles: strip(rankFor("s")), doubles: strip(rankFor("d")), recent: recentN ? recent : undefined, matches: matches.length }, null, 2)); process.exit(0); }
if (!ladder.length) { console.log("No players on the ladder yet."); process.exit(0); }
const w = Math.max(6, ...ladder.map(p => p.name.length + 1));
console.log(`SRL PingpongArena · ${ladder.length} players · ${matches.length} matches\n`);
console.log(`${"#".padStart(2)}  ${"Player".padEnd(w)}  ${"Tier".padEnd(15)}  ${"Elo".padStart(4)}  ${"W-L".padStart(5)}  Last 5`);
for (const p of ladder) console.log(`${String(p.rank).padStart(2)}  ${p.name.padEnd(w)}  ${p.tier.padEnd(15)}  ${String(p.elo).padStart(4)}  ${`${p.wins}-${p.losses}`.padStart(5)}  ${p.last5}`);
if (recentN && recent.length) {
  console.log("\nRecent matches:");
  for (const m of recent) console.log(`  ${m.winner} beat ${m.loser}${m.doubles ? " (2v2)" : ""}${m.score ? ` ${m.score}` : ""} (±${m.delta}) · ${m.at.slice(0, 16).replace("T", " ")} UTC`);
}
