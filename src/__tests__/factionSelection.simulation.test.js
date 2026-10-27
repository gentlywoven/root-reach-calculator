import { mkdirSync, writeFileSync } from 'node:fs';
import { IS_PICKED } from '../constants';
import { createInitialFactions, FACTION_CATALOG } from '../data/factions';
import { REACH_THRESHOLDS } from '../data/reachThresholds';
import { randomCompletePicks, sumPickedReach } from '../factionSelection';

// Simulate 10,000 fresh selections per app configuration, assert they complete,
// and write the faction frequency report to reports/faction-selection-report.html.
const { test, expect } = globalThis;

const TRIALS = 10000;
const LABELS = { player: 'No bots', '1clockwork': '1 bot', '2clockwork': '2 bots' };
const scenarios = [];

for (const [key, config] of Object.entries(REACH_THRESHOLDS)) {
  const match = key.match(/^(player|1clockwork|2clockwork)(\d)$/);
  const [, prefix, players] = match;
  const counts = Object.fromEntries(Object.keys(FACTION_CATALOG).map((name) => [name, 0]));
  let completed = 0;
  let reachedTarget = 0;

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const { factions } = randomCompletePicks(createInitialFactions(), {}, config.playerCount, config.requiredReach);
    const picked = Object.values(factions).filter((faction) => faction.status === IS_PICKED);
    if (picked.length === config.playerCount) completed += 1;
    if (sumPickedReach(factions) >= config.requiredReach) reachedTarget += 1;
    for (const faction of picked) counts[faction.name] += 1;
  }

  scenarios.push({
    key,
    players: config.playerCount,
    bots: prefix === 'player' ? 0 : Number(prefix[0]),
    label: `${players} ${Number(players) === 1 ? 'player' : 'players'} · ${LABELS[prefix]}`,
    requiredReach: config.requiredReach,
    counts,
    completed,
    reachedTarget,
  });
}

const factions = Object.values(FACTION_CATALOG).map(({ name, label, reach }) => ({ name, label, reach }));
const payload = JSON.stringify({ trials: TRIALS, scenarios, factions });
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Faction Selection Simulation Report</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9eee9;background:#111714;font-synthesis:none}*{box-sizing:border-box}body{margin:0;padding:36px 20px 60px;background:radial-gradient(ellipse at top,#24352b 0,#111714 58%);min-height:100vh}.wrap{max-width:1120px;margin:auto}header{margin-bottom:26px}h1{margin:0 0 9px;font-size:clamp(1.7rem,4vw,2.6rem);letter-spacing:-.04em}.sub{color:#a9b6aa;margin:0;line-height:1.55}.panel{background:#19221d;border:1px solid #34453a;border-radius:16px;padding:22px;margin:18px 0;box-shadow:0 18px 60px #0003}.controls{display:flex;gap:16px;align-items:end;flex-wrap:wrap}.field label{display:block;color:#9eafa2;font-size:.78rem;text-transform:uppercase;letter-spacing:.09em;margin:0 0 7px}.field select{min-width:min(360px,82vw);padding:10px 12px;background:#101713;border:1px solid #526858;border-radius:9px;color:#f3f7f3;font:inherit}.stats{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto}.stat{background:#202d25;border-radius:10px;padding:10px 14px;min-width:140px}.stat b{display:block;font-size:1.15rem}.stat span{font-size:.75rem;color:#9eafa2}.chart{overflow-x:auto;margin-top:20px}.chart svg{display:block;min-width:800px;width:100%;height:auto}.axis{stroke:#3c4a40;stroke-width:1}.grid{stroke:#2c3930;stroke-width:1}.tick,.bar-label{fill:#a9b6aa;font-size:11px}.bar-label{font-size:10px}.value{fill:#eff6ef;font-size:11px;font-weight:700}.bar{fill:#81be8d}.bar:hover{fill:#b0e0b7}.note{font-size:.84rem;line-height:1.55;color:#a9b6aa;margin:18px 0 0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:right;padding:11px 10px;border-bottom:1px solid #314037;white-space:nowrap}th{color:#a9b6aa;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}th:first-child,td:first-child{text-align:left}tbody tr:hover{background:#202d25}.reach{color:#9eafa2}.tag{display:inline-block;background:#2a3c30;color:#b8dfbf;padding:4px 8px;border-radius:999px;font-size:.78rem}
</style></head><body><main class="wrap">
<header><h1>Faction selection simulation</h1><p class="sub">10,000 independent random complete selection attempts for every player and bot configuration in the app. Each trial starts with the default faction state and no bans or existing picks.</p></header>
<section class="panel"><div class="controls"><div class="field"><label for="scenario">Scenario</label><select id="scenario"></select></div><div class="stats" id="stats"></div></div><div class="chart" id="chart"></div><p class="note">Bars show how many trials included each faction. Percentages use all 10,000 trials as the denominator, so each faction’s share is its selection frequency, and totals can exceed 100% because each game selects several factions. The algorithm uses sequential random choice among currently available factions, so this is an empirical result, not an equal probability guarantee.</p></section>
<section class="panel"><div class="controls"><div><h2 style="margin:0 0 5px">Faction counts</h2><div class="sub">Sorted by selection frequency in this scenario.</div></div><span class="tag" id="reach"></span></div><div class="table-wrap"><table><thead><tr><th>Faction</th><th>Reach</th><th>Selected in trials</th><th>Frequency</th></tr></thead><tbody id="rows"></tbody></table></div></section>
<p class="note">Generated from the application’s <code>randomCompletePicks</code> function and current reach thresholds. Samples use the runtime’s Math.random and are not seeded.</p>
</main><script>const DATA=${payload};
const select=document.getElementById('scenario');for(const [i,s] of DATA.scenarios.entries()){const o=document.createElement('option');o.value=i;o.textContent=s.label+' · reach '+s.requiredReach;select.append(o)}
function render(){const s=DATA.scenarios[Number(select.value)];const ordered=[...DATA.factions].sort((a,b)=>s.counts[b.name]-s.counts[a.name]);const pct=(n)=>100*n/DATA.trials;
document.getElementById('stats').innerHTML='<div class="stat"><b>'+DATA.trials.toLocaleString()+'</b><span>trials</span></div><div class="stat"><b>'+s.completed.toLocaleString()+' ('+pct(s.completed).toFixed(1)+'%)</b><span>filled all player slots</span></div><div class="stat"><b>'+s.reachedTarget.toLocaleString()+' ('+pct(s.reachedTarget).toFixed(1)+'%)</b><span>met reach target</span></div>';
document.getElementById('reach').textContent='Required reach '+s.requiredReach;
document.getElementById('rows').innerHTML=ordered.map(f=>'<tr><td>'+f.label+'</td><td class="reach">'+f.reach+'</td><td>'+s.counts[f.name].toLocaleString()+'</td><td>'+pct(s.counts[f.name]).toFixed(2)+'%</td></tr>').join('');
const width=Math.max(800,ordered.length*58+100),height=400,left=54,right=16,top=25,bottom=92,plotW=width-left-right,plotH=height-top-bottom,max=Math.max(1,Math.ceil(Math.max(...ordered.map(f=>s.counts[f.name]))/1000)*1000),steps=4,barW=Math.min(34,plotW/ordered.length*.62);let svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Faction selection counts bar chart">';
for(let i=0;i<=steps;i++){const y=top+plotH*i/steps,v=Math.round(max*(1-i/steps));svg+='<line class="grid" x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'"/><text class="tick" text-anchor="end" x="'+(left-8)+'" y="'+(y+4)+'">'+v.toLocaleString()+'</text>'}
ordered.forEach((f,i)=>{const x=left+(i+.5)*plotW/ordered.length,bh=s.counts[f.name]/max*plotH,y=top+plotH-bh;svg+='<rect class="bar" x="'+(x-barW/2)+'" y="'+y+'" width="'+barW+'" height="'+bh+'" rx="4"><title>'+f.label+': '+s.counts[f.name].toLocaleString()+' ('+pct(s.counts[f.name]).toFixed(2)+'%)</title></rect><text class="value" text-anchor="middle" x="'+x+'" y="'+Math.max(top+11,y-6)+'">'+s.counts[f.name].toLocaleString()+'</text><text class="bar-label" text-anchor="end" transform="translate('+x+','+(height-bottom+12)+') rotate(-42)">'+f.label+'</text>'});svg+='</svg>';document.getElementById('chart').innerHTML=svg}
select.addEventListener('change',render);render();</script></body></html>`;

mkdirSync('reports', { recursive: true });
writeFileSync('reports/faction-selection-report.html', html);
console.log(`Wrote report with ${scenarios.length} scenarios × ${TRIALS.toLocaleString()} trials.`);
for (const scenario of scenarios) {
  console.log(`${scenario.label}; reach ${scenario.requiredReach}; complete ${scenario.completed}/${TRIALS}; reach met ${scenario.reachedTarget}/${TRIALS}`);
}

test('random selection completes all simulated app configurations', () => {
  expect(scenarios).toHaveLength(13);
  for (const scenario of scenarios) {
    expect(scenario.completed).toBe(TRIALS);
    expect(scenario.reachedTarget).toBe(TRIALS);
    expect(Object.values(scenario.counts).reduce((sum, count) => sum + count, 0))
      .toBe(scenario.players * TRIALS);
  }
});
