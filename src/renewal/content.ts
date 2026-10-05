import {INITIAL_PROPERTIES,INITIAL_SKILLS,INITIAL_GROUP_SYNERGIES} from '../data/initialData';
import {COMMUNITY_CAMPAIGN_ORDER,TRADE_COMMUNITIES} from '../data/worldData';
import {SAVAGE_RAID_DEFINITIONS,ULTIMATE_RAID_DEFINITION,CRUEL_RAID_DEFINITION,KARMA_RAID_DEFINITION} from './raidCatalog';
import {ALLIANCE_CANDIDATES} from '../data/allianceData';
export const cities=COMMUNITY_CAMPAIGN_ORDER;
export const regions=TRADE_COMMUNITIES;
export const businesses=INITIAL_PROPERTIES;
export const skills=INITIAL_SKILLS;
export const groups=INITIAL_GROUP_SYNERGIES;
export const patrons=ALLIANCE_CANDIDATES;
export type Mode='normal'|'savage'|'ultimate'|'cruel'|'phantom'|'karma';
export interface Encounter {id:string;name:string;city:string;price:number;mode:Mode;layer:number;series:number;opponent:string;description:string;businessId?:string;pattern?:number}
export const contracts:Encounter[]=businesses.map(p=>({id:p.id,name:p.name,city:p.community,price:p.marketPrice,mode:'normal',layer:0,series:0,opponent:p.ownerName,description:p.description.replace(/【[^】]*】/g,''),businessId:p.id}));
export const raids:Encounter[]=SAVAGE_RAID_DEFINITIONS.map(r=>({id:`savage:${r.id}`,name:r.encounterName,city:r.communities.join('・'),price:r.marketPrice,mode:'savage',layer:r.layer,series:r.series,opponent:r.coalitionName,description:r.description}));
export const finals:Encounter[]=[ULTIMATE_RAID_DEFINITION,CRUEL_RAID_DEFINITION,KARMA_RAID_DEFINITION].map((r,index)=>({id:['ultimate','cruel','karma'][index],name:r.name,city:r.communities.join('・'),price:r.marketPrice,mode:(['ultimate','cruel','karma'] as const)[index],layer:4,series:3,opponent:r.coalitionName,description:r.description}));
export const amount=(value:number)=>new Intl.NumberFormat('ja-JP',{notation:Math.abs(value)>=10000?'compact':'standard',maximumFractionDigits:1}).format(Math.floor(value));
