import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const output=resolve(process.argv[2]??'tmp/coin-polish-20260905/cpu');await mkdir(output,{recursive:true});
const c=await connectCapitalAudit();
try{
 await c.send('Profiler.enable');await c.send('Profiler.setSamplingInterval',{interval:1000});await c.send('Profiler.start');
 await new Promise(ok=>setTimeout(ok,6000));
 const {profile}=await c.send('Profiler.stop');
 await writeFile(resolve(output,'live.cpuprofile'),JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
 const self=new Map();for(let i=0;i<(profile.samples??[]).length;i++){
  const node=nodes.get(profile.samples[i]);const f=node.callFrame;
  const key=f.functionName+' '+f.url+':'+f.lineNumber;
  self.set(key,(self.get(key)??0)+(profile.timeDeltas?.[i]??1000));
 }
 const top=[...self].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([where,us])=>({where,ms:us/1000}));
 await writeFile(resolve(output,'top.json'),JSON.stringify(top,null,2));console.log(JSON.stringify(top,null,2));
}finally{c.close()}
