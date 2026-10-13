// Shared SRL PingpongArena rating rules for the leaderboard script and the Slack command.
// Must match index.html: start 1000, K 32 (2v2 counts K 16 in Overall), a player's first 10 games
// move their own rating double, replay matches oldest first, League-style tiers.
export const START = 1000, K = 32, NEWCOMER_GAMES = 10, PLACEMENTS = 5;
export const SITE = "https://chomeed.github.io/srl_pingpongarena/";
const APEX = ["Challenger", "Grandmaster", "Master"], APEX_MIN = 1025;
const TIERS = [[1125, "Diamond"], [1075, "Emerald"], [1025, "Platinum"], [975, "Gold"], [925, "Silver"], [875, "Bronze"], [-Infinity, "Iron"]];

export const isDoubles = m => !!(m.winner2 && m.loser2);
export const teams = m => isDoubles(m) ? [[m.winner, m.winner2], [m.loser, m.loser2]] : [[m.winner], [m.loser]];

export function computeArena(playersRaw, matchesRaw) {
  const st = {};
  const blank = () => ({ elo: START, w: 0, l: 0, form: "" });
  for (const [id, p] of Object.entries(playersRaw || {})) if (p && p.name) st[id] = { id, name: p.name, retired: !!p.retired, o: blank(), s: blank(), d: blank() };
  const matches = Object.entries(matchesRaw || {}).map(([id, m]) => ({ id, ...m }))
    .filter(m => teams(m).flat().every(id => st[id])).sort((a, b) => a.at - b.at);
  const boost = r => (r.w + r.l < NEWCOMER_GAMES ? 2 : 1);
  for (const m of matches) {
    const [W, L] = teams(m);
    m.change = {};
    // overall counts every match; "s"/"d" count only 1v1/2v2
    for (const k of ["o", isDoubles(m) ? "d" : "s"]) {
      const avg = ids => ids.reduce((t, id) => t + st[id][k].elo, 0) / ids.length;
      const kf = k === "o" && isDoubles(m) ? K / 2 : K; // 2v2 counts half in Overall
      const d = Math.round(kf * (1 - 1 / (1 + 10 ** ((avg(L) - avg(W)) / 400))));
      for (const id of W) { const r = st[id][k], c = d * boost(r); r.elo += c; r.w++; r.form += "W"; if (k === "o") m.change[id] = c; }
      for (const id of L) { const r = st[id][k], c = d * boost(r); r.elo -= c; r.l++; r.form += "L"; if (k === "o") m.change[id] = -c; }
      if (k === "o") m.delta = d;
    }
  }
  // ranked list for one ladder ("o" overall, "s" 1v1, "d" 2v2), with tiers
  const ladder = (k = "o") => {
    let place = 0;
    return Object.values(st).filter(p => !p.retired)
      .sort((a, b) => b[k].elo - a[k].elo || (b[k].w - b[k].l) - (a[k].w - a[k].l) || a.name.localeCompare(b.name))
      .map((p, i) => {
        const r = p[k], games = r.w + r.l;
        const tier = games < PLACEMENTS ? `Placement ${games}/${PLACEMENTS}`
          : place < APEX.length && r.elo >= APEX_MIN ? APEX[place++] : (place++, TIERS.find(([min]) => r.elo >= min)[1]);
        return { id: p.id, rank: i + 1, name: p.name, elo: r.elo, wins: r.w, losses: r.l, last5: r.form.slice(-5), form: r.form, provisional: games < PLACEMENTS, tier };
      });
  };
  const team = ids => ids.map(id => st[id].name).join(" & ");
  return { st, matches, ladder, team };
}

export async function fetchArena(dbUrl) {
  const get = async path => {
    const res = await fetch(`${dbUrl}/${path}.json`);
    if (!res.ok) throw new Error(`Reading ${path} failed: HTTP ${res.status}`);
    return (await res.json()) || {};
  };
  const [players, matches] = await Promise.all([get("players"), get("matches")]);
  return { players, matches };
}
