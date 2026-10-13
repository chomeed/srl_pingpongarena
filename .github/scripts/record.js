// Applies one "arena" issue (new player, match result, or match deletion) to data.json.
const fs = require('fs');

const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];

function apply(data, cmd, issue) {
  const find = name => data.players.find(p => p.name.toLowerCase() === String(name || '').trim().toLowerCase());
  const login = issue.user.login;
  if (cmd.type === 'player') {
    const name = String(cmd.name || '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 32) return { error: 'Player names must be 1–32 characters.' };
    if (find(name)) return { error: `${name} is already on the ladder.` };
    data.players.push({ name, addedAt: Date.parse(issue.created_at), by: login });
    return { message: `Added **${name}** to the ladder at 1000.` };
  }
  if (cmd.type === 'match') {
    const W = find(cmd.winner), L = find(cmd.loser);
    if (!W || !L) return { error: `Unknown player: ${!W ? cmd.winner : cmd.loser}. Add them first.` };
    if (W === L) return { error: 'A player cannot play themselves.' };
    const id = /^m_[a-z0-9]{4,24}$/.test(cmd.id || '') ? cmd.id : `m_${issue.number}`;
    if (data.matches.some(m => m.id === id)) return { message: 'This match was already recorded.', unchanged: true };
    data.matches.push({ id, winner: W.name, loser: L.name, at: Date.parse(issue.created_at), by: login, issue: issue.number });
    return { message: `Recorded: **${W.name}** beat **${L.name}**.` };
  }
  if (cmd.type === 'delete') {
    const i = data.matches.findIndex(m => m.id === cmd.id);
    if (i < 0) return { message: 'That match is already gone.', unchanged: true };
    const m = data.matches[i];
    if (m.by !== login && !TRUSTED.includes(issue.author_association)) {
      return { error: `Only @${m.by} (who logged it) or a repo collaborator can delete this match.` };
    }
    data.matches.splice(i, 1);
    return { message: `Deleted: ${m.winner} beat ${m.loser}. Ratings are recalculated.` };
  }
  return { error: 'Unrecognised request.' };
}

module.exports = async ({ github, context, core, exec }) => {
  const issue = context.payload.issue;
  const branch = context.payload.repository.default_branch;
  const { owner, repo } = context.repo;
  const site = `https://${owner.toLowerCase()}.github.io/${repo}/`;
  core.setOutput('changed', 'false');

  const finish = async (text, ok) => {
    await github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body: `${text}\n\n[Open the ladder](${site})` });
    await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed', state_reason: ok ? 'completed' : 'not_planned' });
  };

  const m = (issue.body || '').match(/<!-- arena:(\{.*?\}) -->/s);
  let cmd;
  try { cmd = JSON.parse(m[1]); } catch (e) { return finish('Could not read this request. Please log it again from the ladder page.', false); }

  await exec.exec('git', ['config', 'user.name', 'arena-bot']);
  await exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);

  for (let attempt = 1; attempt <= 6; attempt++) {
    await exec.exec('git', ['fetch', 'origin', branch]);
    await exec.exec('git', ['reset', '--hard', `origin/${branch}`]);
    let data = { players: [], matches: [] };
    try { data = JSON.parse(fs.readFileSync('data.json', 'utf8')); } catch (e) {}
    data.players = data.players || [];
    data.matches = data.matches || [];

    const result = apply(data, cmd, issue);
    if (result.error) return finish(result.error, false);
    if (result.unchanged) return finish(result.message, true);

    fs.writeFileSync('data.json', JSON.stringify(data, null, 1) + '\n');
    await exec.exec('git', ['add', 'data.json']);
    await exec.exec('git', ['commit', '-m', `${issue.title} (#${issue.number})`]);
    const code = await exec.exec('git', ['push', 'origin', `HEAD:${branch}`], { ignoreReturnCode: true });
    if (code === 0) {
      core.setOutput('changed', 'true');
      return finish(`${result.message} The ladder updates in about a minute.`, true);
    }
    await new Promise(r => setTimeout(r, 1000 * attempt + Math.random() * 2000));
  }
  core.setFailed('Could not push after several attempts.');
};
