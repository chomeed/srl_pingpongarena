// Turns a spoken result ("Meedeum won Gwanwoo by 11 to 4") into winners, losers and an optional score.
// Names are matched fuzzily because speech recognition often splits or misspells them ("gwan woo", "do hyun").
(function (root) {
  const NUM = {
    zero: 0, oh: 0, nil: 0, love: 0, one: 1, two: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, 'twenty-one': 21, 'twenty one': 21,
  };
  // verbs: the side before the verb is the winner unless the verb says otherwise
  const WIN = /\b(beat|beats|won against|won over|won vs|wins against|won|wins|defeated|defeats|destroyed|crushed|over|vs|versus|against)\b/;
  const LOSE = /\b(lost to|lost against|loses to|lost|loses|was beaten by|got beaten by|beaten by|fell to)\b/;

  function simplify(s) {
    return s.toLowerCase().replace(/[^a-z]/g, '')
      .replace(/yeo/g, 'yu').replace(/eo/g, 'u').replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/ea/g, 'i')
      .replace(/eu/g, 'u').replace(/ou/g, 'u').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c/g, 'k')
      .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/wh/g, 'w').replace(/z/g, 'j').replace(/(.)\1+/g, '$1');
  }
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function similarity(a, b) {
    const x = simplify(a), y = simplify(b);
    if (!x || !y) return 0;
    return 1 - lev(x, y) / Math.max(x.length, y.length);
  }

  // Find player names in a word list. Returns [{id, start, end, score}] in spoken order, no overlaps.
  function findPlayers(words, players) {
    const cands = [];
    for (const p of players) for (let i = 0; i < words.length; i++) for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const span = words.slice(i, i + n).join('');
      if (/^\d+$/.test(span)) continue;
      const score = similarity(span, p.name);
      if (score >= 0.6) cands.push({ id: p.id, start: i, end: i + n, score: score + n * 0.001 });
    }
    cands.sort((a, b) => b.score - a.score);
    const used = new Set(), taken = [], out = [];
    for (const c of cands) {
      if (used.has(c.id) || taken.some(t => c.start < t.end && t.start < c.end)) continue;
      used.add(c.id); taken.push(c); out.push(c);
    }
    return out.sort((a, b) => a.start - b.start);
  }

  function findScore(text) {
    let t = ' ' + text.toLowerCase().replace(/[–—:]/g, ' to ').replace(/(\d)\s*-\s*(\d)/g, '$1 to $2') + ' ';
    t = t.replace(/twenty[\s-]one/g, '21');
    for (const [w, n] of Object.entries(NUM)) t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), String(n));
    // "11 to 4", "11 4", and the recogniser's "11 2 4" (to heard as two)
    let m = t.match(/\b(\d{1,2})\s+(?:to|too|-)\s+(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s+2\s+(\d{1,2})\b(?!\s+\d)/) || t.match(/\b(\d{1,2})\s+(\d{1,2})\b/);
    if (!m) { const c = t.match(/\b(\d{1,2})2(\d)\b/); if (c && Number(c[1]) >= 10) m = c; } // "1124" style mishears
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2]);
    if (a === b || a > 99 || b > 99) return null;
    return { winner: Math.max(a, b), loser: Math.min(a, b) };
  }

  // Returns {winners:[ids], losers:[ids], score|null} or {error}.
  function parseResult(text, players) {
    const clean = ' ' + text.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    const lose = clean.match(LOSE), win = clean.match(WIN);
    const verb = lose && (!win || lose.index <= win.index) ? lose : win;
    const words = clean.trim().split(' ');
    const found = findPlayers(words.filter(w => w !== 'and' && w !== '&'), players);
    if (found.length !== 2 && found.length !== 4) {
      return { error: found.length < 2 ? "Couldn't recognise two players." : `Heard ${found.length} players; say 2 for 1v1 or 4 for 2v2.` };
    }
    // split into the two sides by the verb position (in words, after dropping "and")
    let split = found.length / 2;
    if (verb) {
      const before = clean.slice(0, verb.index).trim().split(' ').filter(w => w && w !== 'and' && w !== '&').length;
      const n = found.filter(f => f.start < before).length;
      if (n === found.length / 2) split = n;
    }
    let first = found.slice(0, split).map(f => f.id), second = found.slice(split).map(f => f.id);
    if (first.length !== second.length) return { error: "Couldn't tell the two sides apart." };
    if (verb === lose) [first, second] = [second, first];
    return { winners: first, losers: second, score: findScore(clean) };
  }

  const api = { parseResult, similarity, findScore };
  if (typeof module !== 'undefined') module.exports = api; else root.VoiceParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
