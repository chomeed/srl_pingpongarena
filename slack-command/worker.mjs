// SRL PingpongArena Slack command (/pingpong), runs on Cloudflare Workers.
// Security: every request must carry a valid Slack signature (signing secret) made in the last 5 minutes,
// and come from our workspace (SLACK_TEAM_ID). Secrets come from Cloudflare's encrypted settings, never the repo.
import { computeArena, fetchArena, isDoubles, teams, SITE } from "../arena-core.mjs";
import VoiceParse from "../voice-parse.js";

const enc = new TextEncoder();

async function validSignature(req, body, secret) {
  const ts = req.headers.get("x-slack-request-timestamp"), sig = req.headers.get("x-slack-signature") || "";
  if (!ts || !/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay guard
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`v0:${ts}:${body}`)));
  const expected = "v0=" + [...mac].map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i); // constant-time compare
  return diff === 0;
}

const reply = (text, inChannel = false) =>
  new Response(JSON.stringify({ response_type: inChannel ? "in_channel" : "ephemeral", text }), { headers: { "content-type": "application/json" } });

const HELP = [
  "*/pingpong* – show the ladder",
  "*/pingpong Hansol* – one player's stats",
  "*/pingpong Meedeum beat Gwanwoo 11-4* – log a 1v1 (score optional)",
  "*/pingpong Hansol and Dohyeon beat Hokyun and Kyoungin* – log a 2v2",
  `Mistakes can be deleted on the site: ${SITE}`,
].join("\n");

const medal = r => ["🥇", "🥈", "🥉"][r - 1] || `${r}.`;

function ladderText(arena) {
  const l = arena.ladder("o");
  if (!l.length) return `No players yet. Add some at ${SITE}`;
  return `🏓 *SRL PingpongArena ladder* (${arena.matches.length} matches)\n` +
    l.map(p => `${medal(p.rank)} *${p.name}* · ${p.tier} · ${p.elo} · ${p.wins}–${p.losses}`).join("\n") +
    `\n<${SITE}|Open the arena>`;
}

function playerText(arena, id) {
  const p = arena.ladder("o").find(x => x.id === id) || null;
  const st = arena.st[id];
  if (!p) return `${st.name} is hidden from the ladder.`;
  let streak = 0; const f = p.form; const last = f.slice(-1);
  for (let i = f.length - 1; i >= 0 && f[i] === last; i--) streak++;
  const fmt = k => { const r = st[k]; return r.w + r.l ? `${r.elo} (${r.w}–${r.l})` : "no games"; };
  return `*${p.name}* · #${p.rank} · ${p.tier} · *${p.elo}*\n` +
    `Record ${p.wins}–${p.losses}${p.wins + p.losses ? ` (${Math.round(100 * p.wins / (p.wins + p.losses))}%)` : ""}` +
    `${streak >= 2 ? ` · ${last === "W" && streak >= 3 ? "🔥 " : ""}${streak} ${last === "W" ? "wins" : "losses"} in a row` : ""}\n` +
    `1v1 ${fmt("s")} · 2v2 ${fmt("d")}\n<${SITE}#p-${id}|Player page>`;
}

export default {
  async fetch(req, env) {
    if (req.method !== "POST") return new Response("SRL PingpongArena Slack command is running.", { status: 200 });
    const body = await req.text();
    if (!env.SLACK_SIGNING_SECRET || !(await validSignature(req, body, env.SLACK_SIGNING_SECRET))) {
      return new Response("Invalid signature", { status: 401 });
    }
    const form = new URLSearchParams(body);
    if (env.SLACK_TEAM_ID && form.get("team_id") !== env.SLACK_TEAM_ID) return new Response("Wrong workspace", { status: 403 });

    const text = (form.get("text") || "").trim();
    const raw = await fetchArena(env.DB_URL);
    const arena = computeArena(raw.players, raw.matches);
    const active = Object.values(arena.st).filter(p => !p.retired).map(p => ({ id: p.id, name: p.name }));

    if (!text || /^(ladder|leaderboard|rank|ranking|top)$/i.test(text)) return reply(ladderText(arena), true);
    if (/^help$/i.test(text)) return reply(HELP);

    // a result: "A beat B 11-4", "A and B beat C and D", "B lost to A"
    if (/\b(beat|beats|won|wins|defeated|lost|loses|over|vs|versus)\b/i.test(text)) {
      const res = VoiceParse.parseResult(text, active);
      if (res.error) return reply(`${res.error}\nTry: \`/pingpong Meedeum beat Gwanwoo 11-4\`. Players: ${active.map(p => p.name).join(", ")}`);
      const match = { winner: res.winners[0], loser: res.losers[0], at: { ".sv": "timestamp" } };
      if (res.winners.length === 2) { match.winner2 = res.winners[1]; match.loser2 = res.losers[1]; }
      if (res.score) { match.winnerScore = res.score.winner; match.loserScore = res.score.loser; }
      const saved = await fetch(`${env.DB_URL}/matches.json`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(match) });
      if (!saved.ok) return reply("The database refused this result. Try logging it on the site instead: " + SITE);
      const { name: newId } = await saved.json();
      // recompute with the new match to report everyone's points
      const after = computeArena(raw.players, { ...raw.matches, [newId]: { ...match, at: Date.now() } });
      const m = after.matches.find(x => x.id === newId);
      const [W, L] = teams(m);
      const pts = ids => ids.map(id => `${after.st[id].name} ${m.change[id] > 0 ? "+" : "−"}${Math.abs(m.change[id])}`).join(", ");
      return reply(`✅ Logged by <@${form.get("user_id")}>: *${after.team(W)}* beat *${after.team(L)}*` +
        `${m.winnerScore != null ? ` ${m.winnerScore}–${m.loserScore}` : ""}${isDoubles(m) ? " (2v2)" : ""}\n${pts(W)} · ${pts(L)}`, true);
    }

    // otherwise treat it as a player name
    const best = active.map(p => ({ p, s: VoiceParse.similarity(text, p.name) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= 0.6) return reply(playerText(arena, best.p.id), true);
    return reply(`I didn't understand "${text}".\n${HELP}`);
  },
};
