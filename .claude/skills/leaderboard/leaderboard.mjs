#!/usr/bin/env node
// Prints the current SRL PingpongArena ladder from the Firebase Realtime Database.
// Usage: node leaderboard.mjs [--recent N] [--json]
// Elo rules must match index.html: start 1000, K 32, replay matches oldest first.
const DB = process.env.ARENA_DB_URL || "https://srl-pingpongarena-default-rtdb.asia-southeast1.firebasedatabase.app";
const START = 1000, K = 32;

const args = process.argv.slice(2);
const recentN = Number(args[args.indexOf("--recent") + 1]) || (args.includes("--recent") ? 5 : 0);
const asJson = args.includes("--json");

const get = async path => {
  const res = await fetch(`${DB}/${path}.json`);
  if (!res.ok) throw new Error(`Reading ${path} failed: HTTP ${res.status}`);
  return (await res.json()) || {};
};

const [playersRaw, matchesRaw] = await Promise.all([get("players"), get("matches")]);
const st = {};
for (const [id, p] of Object.entries(playersRaw)) if (p && p.name) st[id] = { name: p.name, retired: !!p.retired, elo: START, w: 0, l: 0, form: "" };
const matches = Object.entries(matchesRaw).map(([id, m]) => ({ id, ...m })).filter(m => st[m.winner] && st[m.loser]).sort((a, b) => a.at - b.at);
for (const m of matches) {
  const W = st[m.winner], L = st[m.loser];
  const d = Math.round(K * (1 - 1 / (1 + 10 ** ((L.elo - W.elo) / 400))));
  W.elo += d; L.elo -= d; W.w++; L.l++; W.form += "W"; L.form += "L"; m.delta = d;
}
const ladder = Object.values(st).filter(p => !p.retired)
  .sort((a, b) => b.elo - a.elo || (b.w - b.l) - (a.w - a.l) || a.name.localeCompare(b.name))
  .map((p, i) => ({ rank: i + 1, name: p.name, elo: p.elo, wins: p.w, losses: p.l, last5: p.form.slice(-5), provisional: p.w + p.l < 5 }));
const recent = matches.slice(-recentN).reverse().map(m => ({
  winner: st[m.winner].name, loser: st[m.loser].name, delta: m.delta,
  score: m.winnerScore != null ? `${m.winnerScore}-${m.loserScore}` : null, at: new Date(m.at).toISOString(),
}));

if (args.includes("--slack")) {
  // Slack mrkdwn message for the Incoming Webhook.
  const site = "https://chomeed.github.io/srl_pingpongarena/";
  const medal = r => ["🥇", "🥈", "🥉"][r - 1] || `${r}.`;
  const lines = ladder.length
    ? ladder.map(p => `${medal(p.rank)} *${p.name}*${p.provisional ? " _(P)_" : ""} · ${p.elo} · ${p.wins}–${p.losses}`)
    : ["No players on the ladder yet."];
  let text = `🏓 *SRL PingpongArena ladder* (${matches.length} matches)\n` + lines.join("\n");
  if (recentN && recent.length) text += "\n\n*Recent:* " + recent.map(m => `${m.winner} beat ${m.loser}${m.score ? ` ${m.score}` : ""}`).join(" · ");
  text += `\n<${site}|Log a match>`;
  console.log(JSON.stringify({ text }));
  process.exit(0);
}
if (asJson) { console.log(JSON.stringify({ ladder, recent: recentN ? recent : undefined, matches: matches.length }, null, 2)); process.exit(0); }
if (!ladder.length) { console.log("No players on the ladder yet."); process.exit(0); }
const w = Math.max(6, ...ladder.map(p => p.name.length));
console.log(`SRL PingpongArena · ${ladder.length} players · ${matches.length} matches\n`);
console.log(`${"#".padStart(2)}  ${"Player".padEnd(w)}  ${"Elo".padStart(4)}  ${"W-L".padStart(5)}  Last 5`);
for (const p of ladder) console.log(`${String(p.rank).padStart(2)}  ${(p.name + (p.provisional ? "*" : "")).padEnd(w)}  ${String(p.elo).padStart(4)}  ${`${p.wins}-${p.losses}`.padStart(5)}  ${p.last5}`);
console.log("\n* provisional (fewer than 5 games)");
if (recentN) {
  console.log("\nRecent matches:");
  for (const m of recent) console.log(`  ${m.winner} beat ${m.loser}${m.score ? ` ${m.score}` : ""} (±${m.delta}) · ${m.at.slice(0, 16).replace("T", " ")} UTC`);
}
