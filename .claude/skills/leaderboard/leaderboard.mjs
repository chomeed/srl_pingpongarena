#!/usr/bin/env node
// Prints the current SRL PingpongArena ladder from the Firebase Realtime Database.
// Usage: node leaderboard.mjs [--recent N] [--json]
// Elo rules must match index.html: start 1000, K 32 (2v2 counts K 16 in Overall), replay matches oldest first.
const DB = process.env.ARENA_DB_URL || "https://srl-pingpongarena-default-rtdb.asia-southeast1.firebasedatabase.app";
const START = 1000, K = 32;

const args = process.argv.slice(2);
const recentN = Number(args[args.indexOf("--recent") + 1]) || (args.includes("--recent") ? 5 : 0);
const asJson = args.includes("--json");
const isDoubles = m => !!(m.winner2 && m.loser2);

const get = async path => {
  const res = await fetch(`${DB}/${path}.json`);
  if (!res.ok) throw new Error(`Reading ${path} failed: HTTP ${res.status}`);
  return (await res.json()) || {};
};

const [playersRaw, matchesRaw] = await Promise.all([get("players"), get("matches")]);
const st = {};
const blank = () => ({ elo: START, w: 0, l: 0, form: "" });
for (const [id, p] of Object.entries(playersRaw)) if (p && p.name) st[id] = { name: p.name, retired: !!p.retired, o: blank(), s: blank(), d: blank() };
const teams = m => isDoubles(m) ? [[m.winner, m.winner2], [m.loser, m.loser2]] : [[m.winner], [m.loser]];
const matches = Object.entries(matchesRaw).map(([id, m]) => ({ id, ...m }))
  .filter(m => teams(m).flat().every(id => st[id])).sort((a, b) => a.at - b.at);
for (const m of matches) {
  const [W, L] = teams(m);
  // overall counts every match; "s"/"d" count only 1v1/2v2
  for (const k of ["o", isDoubles(m) ? "d" : "s"]) {
    const avg = ids => ids.reduce((t, id) => t + st[id][k].elo, 0) / ids.length;
    const kf = k === "o" && isDoubles(m) ? K / 2 : K; // 2v2 counts half in Overall
    const d = Math.round(kf * (1 - 1 / (1 + 10 ** ((avg(L) - avg(W)) / 400))));
    for (const id of W) { const r = st[id][k]; r.elo += d; r.w++; r.form += "W"; }
    for (const id of L) { const r = st[id][k]; r.elo -= d; r.l++; r.form += "L"; }
    if (k === "o") m.delta = d;
  }
}
const rank = k => Object.values(st).filter(p => !p.retired)
  .sort((a, b) => b[k].elo - a[k].elo || (b[k].w - b[k].l) - (a[k].w - a[k].l) || a.name.localeCompare(b.name))
  .map((p, i) => ({ rank: i + 1, name: p.name, elo: p[k].elo, wins: p[k].w, losses: p[k].l, last5: p[k].form.slice(-5), provisional: p[k].w + p[k].l < 5 }));
const ladder = rank("o");
const team = ids => ids.map(id => st[id].name).join(" & ");
const recent = matches.slice(-recentN).reverse().map(m => ({
  winner: team(teams(m)[0]), loser: team(teams(m)[1]), doubles: isDoubles(m), delta: m.delta,
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
  if (recentN && recent.length) text += "\n\n*Recent:* " + recent.map(m => `${m.winner} beat ${m.loser}${m.doubles ? " (2v2)" : ""}${m.score ? ` ${m.score}` : ""}`).join(" · ");
  text += `\n<${site}|Log a match>`;
  console.log(JSON.stringify({ text }));
  process.exit(0);
}
if (asJson) { console.log(JSON.stringify({ ladder, singles: rank("s"), doubles: rank("d"), recent: recentN ? recent : undefined, matches: matches.length }, null, 2)); process.exit(0); }
if (!ladder.length) { console.log("No players on the ladder yet."); process.exit(0); }
const w = Math.max(6, ...ladder.map(p => p.name.length + 1));
console.log(`SRL PingpongArena · ${ladder.length} players · ${matches.length} matches\n`);
console.log(`${"#".padStart(2)}  ${"Player".padEnd(w)}  ${"Elo".padStart(4)}  ${"W-L".padStart(5)}  Last 5`);
for (const p of ladder) console.log(`${String(p.rank).padStart(2)}  ${(p.name + (p.provisional ? "*" : "")).padEnd(w)}  ${String(p.elo).padStart(4)}  ${`${p.wins}-${p.losses}`.padStart(5)}  ${p.last5}`);
console.log("\n* provisional (fewer than 5 games)");
if (recentN && recent.length) {
  console.log("\nRecent matches:");
  for (const m of recent) console.log(`  ${m.winner} beat ${m.loser}${m.doubles ? " (2v2)" : ""}${m.score ? ` ${m.score}` : ""} (±${m.delta}) · ${m.at.slice(0, 16).replace("T", " ")} UTC`);
}
