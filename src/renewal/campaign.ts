import {businesses,cities,raids,skills,groups,type Encounter} from './content';
import {SAVAGE_RAID_DEFINITIONS} from './raidCatalog';
export const STORAGE_KEY='tataru-renewal-campaign-v1';
export interface Company {version:1;name:string;cash:number;owned:string[];cleared:string[];equipped:string[];opening?:string|null;critical?:string|null;synergy?:string|null;lbCarry?:number;risk:Record<string,number>;patron:string|null;streak:number;savedAt:number;sound:boolean}
export const freshCompany=():Company=>({version:1,name:'タタルの大繁盛商店',cash:20000,owned:[],cleared:[],equipped:['skill_sabotage'],risk:{},patron:null,streak:0,savedAt:Date.now(),sound:true});
export function parseCompany(text:string|null):Company|null {
  if(!text)return null;
  try{const p=JSON.parse(text);if(p.version!==1||typeof p.name!=='string'||!Number.isFinite(p.cash)||p.cash<0||!Array.isArray(p.owned)||!Array.isArray(p.cleared)||!Array.isArray(p.equipped)||!Number.isFinite(p.savedAt))return null;
    const normal=new Set(businesses.map(b=>b.id));const skillIds=new Set(skills.map(s=>s.id));
    const c={...freshCompany(),...p,name:p.name.slice(0,24),owned:[...new Set(p.owned.filter((id:unknown)=>typeof id==='string'&&normal.has(id)))],cleared:[...new Set(p.cleared.filter((id:unknown)=>typeof id==='string'))],equipped:[...new Set(p.equipped.filter((id:unknown)=>typeof id==='string'&&skillIds.has(id)))].slice(0,3),risk:{},sound:p.sound!==false,streak:Number.isFinite(p.streak)?Math.max(0,Math.floor(p.streak)):0,lbCarry:Number.isFinite(p.lbCarry)?Math.max(0,Math.min(300,p.lbCarry)):0} as Company;
    if(p.risk&&typeof p.risk==='object'&&!Array.isArray(p.risk))for(const [id,value] of Object.entries(p.risk))if(c.owned.includes(id)&&typeof value==='number'&&Number.isFinite(value))c.risk[id]=Math.max(0,Math.min(100,value));
    const unlocked=new Set(availableSkills(c).map(s=>s.id));
    c.opening=autoUnlocked(c,'opening')&&unlocked.has(p.opening)?p.opening:null;
    c.critical=autoUnlocked(c,'critical')&&unlocked.has(p.critical)&&p.critical!==c.opening?p.critical:null;
    c.equipped=c.equipped.filter(id=>unlocked.has(id)&&id!==c.opening&&id!==c.critical);
    return c;
  }catch{return null;}
}
export function loadCompany(){try{return parseCompany(localStorage.getItem(STORAGE_KEY))??freshCompany();}catch{return freshCompany();}}
export function storeCompany(c:Company){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(c));return true;}catch{return false;}}
export const ownedBusinesses=(c:Company)=>businesses.filter(p=>c.owned.includes(p.id));
export const cityComplete=(c:Company,city:string)=>c.cleared.includes(`city:${city}`)||businesses.filter(p=>p.community===city&&p.countsTowardCityConquest!==false).every(p=>c.owned.includes(p.id));
export const chapter=(c:Company)=>{const first=cities.findIndex(city=>!cityComplete(c,city));return first<0?cities.length:first;};
export const accessible=(c:Company,city:string)=>cities.indexOf(city as typeof cities[number])<=chapter(c);
const upgradedGroups=(c:Company)=>groups.map(g=>{const rank=SAVAGE_RAID_DEFINITIONS.filter(r=>c.cleared.includes(`savage:${r.id}`)&&r.rewardSynergyIds.includes(g.id)).length;return {...g,bonusYieldMultiplier:g.bonusYieldMultiplier+rank*.05,battleGroupMultiplier:1.45+rank*.04,battleEffect:g.battleEffect?{...g.battleEffect,capitalPressureMultiplier:g.battleEffect.capitalPressureMultiplier+rank*.02}:undefined};});
export const activeGroups=(c:Company)=>upgradedGroups(c).filter(g=>!g.battleOnly&&g.requiredPropertyIds.length>0&&g.requiredPropertyIds.every(id=>c.owned.includes(id)));
export const income=(c:Company)=>Math.floor(ownedBusinesses(c).reduce((sum,p)=>sum+p.annualRevenue*2*(1+SAVAGE_RAID_DEFINITIONS.filter(r=>c.cleared.includes(`savage:${r.id}`)&&r.memberPropertyIds.includes(p.id)).length*.1)*activeGroups(c).filter(g=>g.requiredPropertyIds.includes(p.id)).reduce((factor,g)=>factor*g.bonusYieldMultiplier,1),0));
export const availableSkills=(c:Company)=>skills.filter(s=>s.id==='skill_sabotage'||s.unlockAfterCommunity&&cityComplete(c,s.unlockAfterCommunity)||s.unlockAfterSavageRaidId&&c.cleared.includes(`savage:${s.unlockAfterSavageRaidId}`)||s.requiredAssetValue&&ownedBusinesses(c).reduce((sum,p)=>sum+p.marketPrice,0)>=s.requiredAssetValue||s.requiredPropertyIds?.some(id=>c.owned.includes(id))||s.requiredAllPropertyIds?.length&&s.requiredAllPropertyIds.every(id=>c.owned.includes(id)));
export const availableSynergies=(c:Company)=>upgradedGroups(c).filter(g=>g.battleOnly&&(g.unlockAfterCommunity&&cityComplete(c,g.unlockAfterCommunity)||g.unlockAfterAllCartelHqs&&businesses.filter(b=>b.isCartelHQ).every(b=>c.owned.includes(b.id))));
export const autoUnlocked=(c:Company,slot:'opening'|'critical')=>c.cleared.includes(raids[slot==='opening'?0:3].id);
export const unlockedRaid=(c:Company,e:Encounter)=>e.mode==='savage'?chapter(c)>=10&&(raids.findIndex(r=>r.id===e.id)===0||c.cleared.includes(raids[raids.findIndex(r=>r.id===e.id)-1]?.id)):
  e.mode==='ultimate'?raids.every(r=>c.cleared.includes(r.id)):e.mode==='cruel'?c.cleared.includes('ultimate'):e.mode==='karma'||e.mode==='phantom'?c.cleared.includes('cruel'):accessible(c,e.city);
export function accrue(c:Company,now=Date.now()):Company {const seconds=Math.max(0,Math.min(1800,(now-c.savedAt)/1000));return {...c,cash:c.cash+Math.floor(income(c)*seconds),savedAt:now};}
export interface Settlement {id:string;won:boolean;direct:number;drain:number;risk:Record<string,number>;allocation:0|.5|1;lbCarry?:number}
export function settleCompany(c:Company,e:Encounter,r:Settlement):Company {
  if(![r.direct,r.drain,e.price,c.cash].every(v=>Number.isFinite(v)&&v>=0)||![0,.5,1].includes(r.allocation))return c;
  if(c.cleared.includes(`receipt:${r.id}`))return c;
  const record=e.mode==='karma'||e.mode==='phantom';
  const reward=!record&&r.won&&(e.mode==='normal'||!c.cleared.includes(e.id))?Math.round(e.price*.05):0;
  const cost=record?0:Math.round(e.price*.03+r.direct*(r.won?.35:e.mode==='normal'?0:.75)+r.drain);
  const next={...c,cash:Math.max(0,c.cash+reward*(1-r.allocation)-cost),owned:[...c.owned],cleared:[...c.cleared,`receipt:${r.id}`],risk:{...c.risk},savedAt:Date.now()};
  if(!record&&r.lbCarry!==undefined&&Number.isFinite(r.lbCarry))next.lbCarry=Math.max(0,Math.min(300,r.lbCarry));
  if(e.mode==='phantom')next.streak=r.won?c.streak+1:0;
  if(r.won){if(e.mode==='normal'&&!next.owned.includes(e.id))next.owned.push(e.id);if(e.mode!=='normal'&&e.mode!=='phantom'&&!next.cleared.includes(e.id))next.cleared.push(e.id);}
  for(const city of cities)if(cityComplete(next,city)&&!next.cleared.includes(`city:${city}`))next.cleared.push(`city:${city}`);
  if(!record&&r.won&&reward>0)for(const [id,risk] of Object.entries(r.risk)) if(Number.isFinite(risk)&&next.owned.includes(id))next.risk[id]=Math.max(0,Math.min(100,risk-(r.allocation===1?30:r.allocation===.5?15:0)));
  if(!record&&r.won&&reward>0&&r.allocation<1){
    let seed=Array.from(r.id).reduce((n,ch)=>(Math.imul(n,31)+ch.charCodeAt(0))>>>0,17);
    for(const [id,risk] of Object.entries(r.risk)){
      if(!next.owned.includes(id)||!Number.isFinite(risk))continue;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const probability=risk<=30?0:.9*Math.pow((Math.min(100,risk)-30)/70,2)*(r.allocation===.5?.2:1);
      if(seed/4294967296<probability){next.owned=next.owned.filter(p=>p!==id);next.cash+=businesses.find(p=>p.id===id)?.marketPrice??0;delete next.risk[id];}
    }
  }
  // No old save keys, migration, compatibility mode or legacy company mirror.
  return next;
}
