import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const dir=resolve(process.argv[2]??'tmp/coin-polish-20260905/live');await mkdir(dir,{recursive:true});
const c=await connectCapitalAudit();
const base=process.env.CAPITAL_QA_BASE??'http://127.0.0.1:3130';
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
const button=async prefix=>c.evaluate(`(()=>{const p=${JSON.stringify(prefix)};const b=[...document.querySelectorAll('button')].find(b=>!b.disabled&&(b.getAttribute('aria-label')||b.innerText).trim().startsWith(p));if(!b)return false;b.click();return true})()`);
const until=async predicate=>{for(let i=0;i<150;i++){if(await predicate())return;await wait(200)}throw new Error('UI condition did not become ready')};
const shot=async name=>{const r=await c.send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(dir,name+'.png'),Buffer.from(r.data,'base64'))};
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1.5,mobile:false});
 await c.send('Page.navigate',{url:base+'/'});
 await until(()=>c.evaluate('document.querySelectorAll("button").length>0'));
 for(let i=0;i<4;i++){await button('次へ');await button('この名で開店する');await button('わかった！');await wait(500)}
 await until(()=>button('グリダニア'));
 await shot('01-market');
 await until(()=>button('商戦へ挑戦'));
 await until(()=>button('この条件で争奪戦開始'));
 await until(()=>c.evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>!b.disabled&&(b.getAttribute('aria-label')||'').startsWith('投資実行。')))`));
 await shot('02-ready');
 await button('投資実行。');await wait(600);await shot('03-first-rolls');
 await c.send('Performance.enable');
 const before=await c.send('Performance.getMetrics');
 const stats=await c.evaluate(`(async()=>{
  const stats={drawImage:0,longTasks:[],backgroundMutations:0,animations:document.getAnimations().filter(a=>a.playState==='running').length};
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){stats.drawImage++;return original.apply(this,args)};
  const observer=new PerformanceObserver(list=>stats.longTasks.push(...list.getEntries().map(e=>e.duration)));
  observer.observe({type:'longtask'});
  const market=document.querySelector('main[data-app-main]')??document.querySelector('.game-app-shell > main');
  const mutations=new MutationObserver(list=>stats.backgroundMutations+=list.length);
  if(market)mutations.observe(market,{subtree:true,childList:true,attributes:true,characterData:true});
  try{await new Promise(ok=>setTimeout(ok,6000))}finally{CanvasRenderingContext2D.prototype.drawImage=original;observer.disconnect();mutations.disconnect()}
  return {...stats,marketObserved:!!market,overflow:document.documentElement.scrollWidth>innerWidth};
 })()`);
 const after=await c.send('Performance.getMetrics');
 const metrics=Object.fromEntries(after.metrics.filter(m=>['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration'].includes(m.name)).map(m=>[m.name,m.value-(before.metrics.find(b=>b.name===m.name)?.value??0)]));
 await c.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1.25,mobile:false});
 await wait(300);await shot('04-rotate');
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:2,mobile:false});
 for(let i=0;i<90;i++){
  if(await button('分析へ'))break;
  await button('投資実行。');await wait(750);
 }
 await until(async()=>{
   await button('五分の祝儀');
   return c.evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>!b.disabled&&b.innerText.includes('買収結果を確定')))`);
 });
 await shot('05-analysis');
 await until(()=>button('買収結果を確定'));
 await wait(500);await button('わかった！');
 await shot('06-settled');
 const final=await c.evaluate(`({text:document.body.innerText.slice(-4000),canvasCount:document.querySelectorAll('canvas').length,overflow:document.documentElement.scrollWidth>innerWidth,focusTag:document.activeElement?.tagName})`);
 await writeFile(resolve(dir,'live-result.json'),JSON.stringify({stats,metrics,final,note:'One real initial battle and six-second active window, isolated Edge guest; no fabricated save or resources.'},null,2));
 console.log(JSON.stringify({stats,metrics,final}));
}finally{c.close()}
