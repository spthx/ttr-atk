import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import RenewalApp from './App';
import {freshCompany} from './campaign';
import {businesses,skills,raids,finals,contracts} from './content';
const query=new URLSearchParams(location.search);
const full=query.get('stage')!=='fresh';
const company={...freshCompany(),cash:full?50e9:20000,owned:full?businesses.map(p=>p.id):[],cleared:full?[...raids.map(r=>r.id),'ultimate','cruel']:[],equipped:full?['skill_demoralize','skill_capital_boost','skill_synergy_push']:['skill_sabotage'],patron:full?'garland_ironworks':null,sound:false};
const encounter=query.get('battle')==='ultimate'?finals[0]:query.get('battle')==='cruel'?finals[1]:query.get('battle')==='karma'?finals[2]:query.get('battle')==='large'?contracts.at(-1):query.get('battle')==='first'?contracts[0]:undefined;
function PerformanceProbe(){
  const [label,setLabel]=useState('計測中');
  useEffect(()=>{let raf=0,last=performance.now();let intervals:number[]=[];const tick=(now:number)=>{if(!document.hidden){intervals.push(now-last);if(intervals.length>=120){const sorted=[...intervals].sort((a,b)=>a-b);setLabel(`120 frames · p95 ${sorted[113].toFixed(1)}ms · >50ms ${sorted.filter(v=>v>50).length}`);intervals=[];}}else intervals=[];last=now;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[]);
  return <output style={{position:'fixed',right:6,bottom:2,zIndex:200,font:'10px monospace',color:'#fff',background:'#000a',pointerEvents:'none'}}>{label}</output>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<><RenewalApp initialCompany={company} initialEncounter={encounter} isolated/><PerformanceProbe/></>);
