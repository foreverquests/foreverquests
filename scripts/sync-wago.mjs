#!/usr/bin/env node
// Diff WoW Forever (wowf) game data vs Classic Era using wago.tools (used with Wago's permission).
// Writes candidates to review/pending.json + review/pending.md. Never touches src/data.json.
import fs from 'node:fs';
const UA = 'ForeverQuests/1.0 (+https://foreverquests.github.io/foreverquests/)';
const STATE = 'review/state.json', PENDING = 'review/pending.json', MD = 'review/pending.md';
const get = async (url) => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.text();
    if (r.status < 500) throw new Error(`${r.status} ${url}`);
    await new Promise(s => setTimeout(s, 2000 * (i + 1)));
  }
  throw new Error(`failed ${url}`);
};
function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...body] = rows;
  return new Map(body.map(r => [r[0], Object.fromEntries(h.map((k, i) => [k, r[i]]))]));
}
const table = async (name, build) => {
  try { return parseCSV(await get(`https://wago.tools/db2/${name}/csv?build=${build}`)); }
  catch (e) { console.warn(`  ${name}@${build}: ${e.message}`); return new Map(); }
};
const QUAL = ['Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Artifact', 'Heirloom'];

const builds = JSON.parse(await get('https://wago.tools/api/builds'));
const latest = (p, pre) => (builds[p] || []).filter(b => !pre || b.version.startsWith(pre)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.version;
const fBuild = latest('wowf'), eBuild = latest('wow_classic_era', '1.15.');
if (!fBuild || !eBuild) throw new Error('could not find builds');
console.log(`Forever ${fBuild} vs Era ${eBuild}`);

// [kind, table, label fn, fields compared for "changed"]
const specs = [
  ['item', 'ItemSparse', r => r.Display_lang, ['Display_lang', 'OverallQualityID', 'ItemLevel', 'RequiredLevel'],
    r => ({ name: r.Display_lang, quality: QUAL[+r.OverallQualityID] ?? r.OverallQualityID, itemLevel: +r.ItemLevel, reqLevel: +r.RequiredLevel })],
  ['quest', 'QuestV2', r => `Quest #${r.ID}`, null, r => ({})],
  ['questline', 'QuestLine', r => r.Name_lang, ['Name_lang'], r => ({ name: r.Name_lang, firstQuest: +r.QuestID })],
  ['zone', 'AreaTable', r => r.AreaName_lang, ['AreaName_lang'], r => ({ name: r.AreaName_lang, parent: +r.ParentAreaID })],
  ['map', 'Map', r => r.MapName_lang, ['MapName_lang', 'InstanceType', 'MaxPlayers'], r => ({ name: r.MapName_lang, instanceType: +r.InstanceType, maxPlayers: +r.MaxPlayers })],
  ['dungeon', 'LFGDungeons', r => r.Name_lang, ['Name_lang', 'MinLevel', 'MaxLevel'], r => ({ name: r.Name_lang, minLevel: +r.MinLevel, maxLevel: +r.MaxLevel })],
];
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { seen: {} };
const pending = fs.existsSync(PENDING) ? JSON.parse(fs.readFileSync(PENDING, 'utf8')) : { candidates: [] };
const queued = new Set(pending.candidates.map(c => c.key));
const added = [], summary = {}, eraNames = {};
const qlx = await table('QuestLineXQuest', fBuild);
const questLineOf = new Map([...qlx.values()].map(r => [r.QuestID, r.QuestLineID]));

for (const [kind, name, label, cmp, extra] of specs) {
  const [F, E] = await Promise.all([table(name, fBuild), table(name, eBuild)]);
  let nNew = 0, nChg = 0;
  eraNames[kind] = new Set([...E.values()].map(r => (label(r) || '').toLowerCase()));
  for (const [id, r] of F) {
    const e = E.get(id);
    let status = null, changes;
    if (!e) status = 'new';
    else if (cmp) {
      changes = cmp.filter(k => k in e && k in r && e[k] !== r[k]).map(k => ({ field: k, era: e[k], forever: r[k] }));
      if (changes.length) status = 'changed';
    }
    if (!status) continue;
    status === 'new' ? nNew++ : nChg++;
    const sig = JSON.stringify(cmp ? cmp.map(k => r[k]) : 1);
    const key = `${kind}:${id}`;
    if (state.seen[key] === sig) continue;   // already surfaced in a previous run
    state.seen[key] = sig;
    const c = { key, kind, id: +id, status, label: label(r) || `${kind} #${id}`, ...extra(r), build: fBuild, wowhead: kind === 'item' || kind === 'quest' ? `https://www.wowhead.com/classic/${kind}=${id}` : undefined, firstSeen: new Date().toISOString().slice(0, 10) };
    if (kind === 'quest' && questLineOf.has(id)) c.questLine = +questLineOf.get(id);
    if (changes) c.changes = changes;
    if (queued.has(key)) pending.candidates = pending.candidates.filter(x => x.key !== key);
    pending.candidates.push(c); added.push(c);
  }
  summary[name] = { forever: F.size, era: E.size, new: nNew, changed: nChg };
  console.log(`  ${name}: ${F.size} rows, ${nNew} new, ${nChg} changed vs Era`);
}
pending.foreverBuild = fBuild; pending.eraBuild = eBuild; pending.updated = new Date().toISOString(); pending.summary = summary;
state.lastForeverBuild = fBuild; state.lastEraBuild = eBuild; state.lastRun = pending.updated;
fs.writeFileSync(PENDING, JSON.stringify(pending, null, 1) + '\n');
fs.writeFileSync(STATE, JSON.stringify(state) + '\n');

// Readable review file
const by = k => pending.candidates.filter(c => c.kind === k);
const esc = s => String(s ?? '').replace(/\|/g, '\\|');
let md = `# ForeverQuests review queue\n\nForever **${fBuild}** vs Classic Era **${eBuild}** · updated ${pending.updated}\nData: [wago.tools](https://wago.tools). This run surfaced **${added.length}** new candidates.\n\nTo publish: add the entry to \`src/data.json\` with the next free \`idx\` (never reuse/renumber), then delete it from \`review/pending.json\` (or leave it; state prevents re-surfacing).\n\n| Table | Forever rows | New | Changed |\n|---|---|---|---|\n`;
for (const [k, v] of Object.entries(summary)) md += `| ${k} | ${v.forever} | ${v.new} | ${v.changed} |\n`;
const sect = (k, title, cols, row, limit = 300) => {
  const list = by(k); if (!list.length) return;
  md += `\n## ${title} (${list.length})\n\n| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n`;
  for (const c of list.slice(0, limit)) md += `| ${row(c).map(esc).join(' | ')} |\n`;
  if (list.length > limit) md += `\n…and ${list.length - limit} more in pending.json\n`;
};
sect('dungeon', 'Dungeons / raids', ['ID', 'Status', 'Name', 'Levels'], c => [c.id, c.status, c.label, `${c.minLevel}-${c.maxLevel}`]);
sect('map', 'Maps', ['ID', 'Status', 'Name', 'Players'], c => [c.id, c.status, c.label, c.maxPlayers]);
sect('zone', 'Zones / areas', ['ID', 'Status', 'Name'], c => [c.id, c.status, c.label]);
sect('questline', 'Quest lines', ['ID', 'Status', 'Name', 'First quest'], c => [c.id, c.status, c.label, c.firstQuest]);
sect('item', 'Items', ['ID', 'Status', 'Name', 'Quality', 'iLvl', 'Req', 'Changes'], c => [c.id, c.status, c.name, c.quality, c.itemLevel, c.reqLevel, (c.changes || []).map(x => `${x.field}: ${x.era}→${x.forever}`).join('; ')]);
sect('quest', 'Quest IDs (names aren\'t in client data)', ['ID', 'Status', 'Quest line', 'Wowhead'], c => [c.id, c.status, c.questLine ?? '', c.wowhead]);
fs.writeFileSync(MD, md);
console.log(`Surfaced ${added.length} new candidates -> ${PENDING}, ${MD}`);

// ---- Auto-publish (no manual approval): append curated finds to src/data.json ----
const JUNK = /\b(test|dnt|ph|zzold|old|unused|placeholder|deprecated|nyi|qa|debug|prototype|template|copy|monster -|nothing to see here|crafting)\b|^\s*$|^zz|^\[|\(old\)|^[0-9 ]+$/i;
const ok = c => c.status === 'new' && c.label && !eraNames[c.kind]?.has(c.label.toLowerCase()) && !JUNK.test(c.label) && !/ #\d+$/.test(c.label);
const pick = pending.candidates.filter(c => !c.published && ok(c) && (
  c.kind === 'dungeon' || c.kind === 'questline' ||
  c.kind === 'map' ||
  (c.kind === 'zone' && c.parent === 0) ||
  (c.kind === 'item' && ['Epic', 'Legendary'].includes(c.quality) && c.itemLevel >= 40)));
const D = JSON.parse(fs.readFileSync('src/data.json', 'utf8'));
D.sources.G ??= { name: 'wago.tools – WoW: Forever client game data (used with permission)', url: 'https://wago.tools' };
let nextIdx = Math.max(-1, ...D.items.map(i => i.idx)) + 1;
const slugs = new Set(D.items.map(i => i.slug)), names = new Set(D.items.map(i => i.name.toLowerCase()));
const TYPE = { dungeon: 'Dungeon', questline: 'Quest', map: 'Map', zone: 'Zone', item: 'Item' };
const DESC = {
  dungeon: c => `New dungeon entry found in the Forever ${c.build} game files.`,
  questline: c => `New quest line found in the Forever ${c.build} game files.`,
  map: c => `New map found in the Forever ${c.build} game files${c.maxPlayers ? ` (up to ${c.maxPlayers} players)` : ''}.`,
  zone: c => `New zone found in the Forever ${c.build} game files.`,
  item: c => `New ${c.quality} item (item level ${c.itemLevel}${c.reqLevel ? `, requires level ${c.reqLevel}` : ''}) found in the Forever ${c.build} game files.`,
};
const log = [];
for (const c of pick) {
  c.published = true;
  if (names.has(c.label.toLowerCase())) continue;            // already covered by a hand-written entry
  let slug = c.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `${c.kind}-${c.id}`;
  if (slugs.has(slug)) slug += `-${c.kind}-${c.id}`;
  slugs.add(slug); names.add(c.label.toLowerCase());
  const it = { slug, name: c.label, type: TYPE[c.kind], patch: 'launch', desc: DESC[c.kind](c), src: ['G'],
    unknown: 'Found in datamined game files; details may change before launch.', auto: c.key, idx: nextIdx++ };
  D.items.push(it); log.push(it);
}
fs.writeFileSync('src/data.json', JSON.stringify(D, null, 2) + '\n');
fs.writeFileSync(PENDING, JSON.stringify(pending, null, 1) + '\n');
fs.mkdirSync('review/log', { recursive: true });
if (log.length) fs.appendFileSync('review/log/CHANGELOG.md', `\n## ${pending.updated.slice(0, 10)} · Forever ${fBuild}\n\n${log.map(i => `- [${i.type}] ${i.name} (idx ${i.idx})`).join('\n')}\n`);
console.log(`Published ${log.length} new entries to src/data.json`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `published=${log.length}\n`);
