import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Connect only to an explicitly launched, isolated development Edge profile.
const port = Number(process.argv[2] ?? 9355);
const base = process.argv[3] ?? 'http://127.0.0.1:3130';
const output = resolve(process.argv[4] ?? 'tmp/capital-browser-audit');
const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
const tab = tabs.find(t=>t.type==='page' && (t.url==='about:blank' || t.url.startsWith(base))) ??
  await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
const pending = new Map();
let serial = 0;
ws.onmessage = ({ data }) => {
  const message = JSON.parse(String(data));
  if (message.id && pending.has(message.id)) {
    const [ok, fail] = pending.get(message.id);
    pending.delete(message.id);
    message.error ? fail(new Error(JSON.stringify(message.error))) : ok(message.result);
  }
};
const send = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++serial;
  const timeout = setTimeout(() => {pending.delete(id);fail(new Error(`CDP timeout: ${method}`));},45000);
  pending.set(id, [value=>{clearTimeout(timeout);ok(value)},error=>{clearTimeout(timeout);fail(error)}]);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
await mkdir(output, { recursive: true });
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', {url:`${base}/capital-contact-audit.html`});
for (let attempt = 0; attempt < 100; attempt++) {
  if (await evaluate('Boolean(window.capitalAudit)')) break;
  await new Promise(ok => setTimeout(ok, 100));
}
if (!await evaluate('Boolean(window.capitalAudit)')) throw new Error('fixture did not load');
const results = [];
for (const [name, width, height] of [['portrait', 390, 844], ['landscape', 844, 390], ['wide', 1440, 900]]) {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    console.log(`${name} DPR ${dpr}`);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
    await evaluate(`new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)))`);
    const result = await evaluate(`(async () => {
      const a = window.capitalAudit, canvas = a.canvas;
      canvas.closest('section').style.padding = '0';
      canvas.parentElement.style.width = '100%';
      canvas.style.margin = 'auto';
      const css = { width: ${name === 'wide' ? 1190 : name === 'portrait' ? 378 : 824}, height: ${name === 'wide' ? 276 : name === 'portrait' ? 366 : 159} };
      canvas.style.width = css.width + 'px'; canvas.style.height = css.height + 'px';
      const heights = a.getCapitalColumnHeights;
      const make = (before, after, progress) => {
        const cols = heights(before), target = heights(after);
        const side = {amount: after, marketPrice: 2000, previewFrame: {visibleUnits:before, columnHeights:cols, settledAfterColumnHeights:target, activeColumnIndices:cols.flatMap((v,i)=>target[i]>v?[i]:[]), beatDurationMs:165, packetSeed:42}};
        const s = a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
        s.player.frame.packetProgress = progress; s.enemy.frame.packetProgress = progress;
        return s;
      };
      const options = {sprites:a.sprites,cssSize:css,devicePixelRatio:${dpr},frameRate:60};
      window.auditRender = (before,after,p) => a.paintBattleCapitalCanvas(canvas,make(before,after,p),options);
      const timings=[], draws=[];
      const original=CanvasRenderingContext2D.prototype.drawImage;
      let count=0;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){count++;return original.apply(this,args)};
      let metrics;
      try {
        for(let i=0;i<100;i++){
          const scene=make(648,720,(i%20)/19);
          count=0; const started=performance.now();
          metrics=a.paintBattleCapitalCanvas(canvas,scene,options);
          timings.push(performance.now()-started); draws.push(count);
        }
      } finally {CanvasRenderingContext2D.prototype.drawImage=original}
      timings.sort((a,b)=>a-b); draws.sort((a,b)=>a-b);
      return {css,dpr:${dpr},cpuSubmissionMs:{p50:timings[50],p95:timings[95]},drawImageCalls:{p50:draws[50],p95:draws[95]},metrics};
    })()`);
    for (const [state, before, after, progress] of [['small',1,1,1],['growing',648,720,0.65],['huge',9216,9216,1]]) {
      await evaluate(`window.auditRender(${before},${after},${progress})`);
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(resolve(output, `${name}-dpr${dpr}-${state}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    results.push({name,...result});
    await writeFile(resolve(output, 'metrics.json'), JSON.stringify({note:'CPU submission timings, not hardware FPS.',results},null,2));
  }
}
await writeFile(resolve(output, 'metrics.json'), JSON.stringify({note:'Edge headless, CPU submission timing in a deterministic loop; not GPU duration, real-device FPS, power or touch latency.',results},null,2));
await send('Page.navigate', {url:'about:blank'});
ws.close();
console.log(JSON.stringify({output,results},null,2));
