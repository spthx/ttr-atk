import assert from 'node:assert/strict';
import {createCapitalPresentationScheduler} from '../src/utils/capitalPresentationScheduler';
import {resolveCapitalRollTrajectory} from '../src/utils/capitalRollMotion';

let now=0,id=0;
const pending=new Map<number,{at:number;callback:()=>void}>();
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
Object.defineProperty(globalThis,'window',{value:{
  setTimeout(callback:()=>void,delay:number){const key=++id;pending.set(key,{at:now+delay,callback});return key;},
  clearTimeout(key:number){pending.delete(key);},
},configurable:true});
const advance=(time:number)=>{
  while(true){
    const entry=[...pending.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
    if(!entry || entry[1].at>time)break;
    now=entry[1].at;pending.delete(entry[0]);entry[1].callback();
  }
  now=time;
};
const scheduler=createCapitalPresentationScheduler();
let completed=0;
scheduler.schedule(()=>completed++,330);
advance(100);scheduler.setSpeed(2);scheduler.setSpeed(2);
advance(214);assert.equal(completed,0);
advance(215);assert.equal(completed,1,'100ms normal + 115ms double must complete 330ms exactly once');
scheduler.schedule(()=>completed++,165);
advance(297.5);assert.equal(completed,2,'following beats inherit double speed');
scheduler.schedule(()=>completed++,165);scheduler.clear();advance(600);
assert.equal(completed,2,'cancellation must remove the accelerated callback');
assert.equal(scheduler.speed,1,'a new pour starts at normal speed');
const positions=Array.from({length:11},(_,i)=>resolveCapitalRollTrajectory(i/10,0,0,true));
assert.equal(new Set(positions).size,11,'small pours must not retain three-position snapping');
assert.equal(positions[0],0);assert.equal(positions.at(-1),1);
console.log('Capital speed passed: mid-flight 2x, repeated tap, subsequent beat, cancellation and smooth small rolls.');
