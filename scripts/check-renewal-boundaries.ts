import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

// Deliberately follows the production graph rather than treating unused legacy tests as acceptance.
const entry=readFileSync('index.html','utf8');
assert.ok(entry.includes('/src/renewal/main.tsx'));
const visited=new Set<string>();
const allowedData=new Set(['initialData.ts','worldData.ts','allianceData.ts','fankitAssets.ts','battleEncounterData.ts']);
function inspect(path:string){
  const file=resolve(path);if(visited.has(file))return;visited.add(file);
  const source=readFileSync(file,'utf8');
  if(file.includes('/renewal/')||file.includes('\\renewal\\')){
    assert.doesNotMatch(source,/sessionStorage|localStorage\.(clear|removeItem)|tataru-world-trade-save-v3|tataru-company-name|tataru_trade_pending_battle/);
  }
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
    const spec=match[1];if(!spec.startsWith('.'))continue;
    const target=resolve(file,'..',spec);
    if(/\.(png|webp|jpg|svg|css)$/.test(target))continue;
    const candidates=[target+'.ts',target+'.tsx',target];
    let found='';for(const candidate of candidates){try{readFileSync(candidate);found=candidate;break;}catch{/* try next extension */}}
    assert.ok(found,`Unresolved production import ${spec}`);
    assert.ok(!/[\\/](components|utils|hooks)[\\/]/.test(found),`Old runtime dependency: ${found}`);
    if(/[\\/]data[\\/]/.test(found))assert.ok(allowedData.has(found.split(/[\\/]/).at(-1)!),`Unreviewed data import: ${found}`);
    inspect(found);
  }
}
inspect('src/renewal/main.tsx');
const styles=readFileSync('src/renewal/renewal.css','utf8');
assert.doesNotMatch(styles,/@import|url\(['"]?https?:/);
assert.ok(styles.includes('prefers-reduced-motion'));
assert.ok(styles.includes('max-height:500px'));
const app=readFileSync('src/renewal/App.tsx','utf8');
assert.ok(app.includes('<div inert={!!selected||settings||!!battle}>'));
assert.ok(app.includes('visibilitychange'));
const renderer=readFileSync('src/renewal/CoinStage.tsx','utf8');
assert.doesNotMatch(renderer,/engine\.step|setInterval|setTimeout/);
assert.ok(renderer.includes('stacks.size>=64'));
assert.ok(renderer.includes('ctx.translate(0,offset)'));
assert.ok(renderer.includes('Math.min(1.5,window.devicePixelRatio'));
assert.ok(readdirSync('src/renewal').length>5);
console.log(`Renewal production dependency boundary: ${visited.size} modules; save/runtime isolation, bounded renderer and responsive styles passed.`);
