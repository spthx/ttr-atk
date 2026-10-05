import {SAVAGE_ENEMY_SUPPORT_PROFILES,SAVAGE_ENEMY_AUTO_PROFILES,ULTIMATE_ENEMY_AUTO_PATTERNS,type EnemySupportSkillId} from '../data/battleEncounterData';
import type {Encounter} from './content';
export function enemyProfile(e:Encounter):{skills:readonly EnemySupportSkillId[];opening:EnemySupportSkillId|null;critical:EnemySupportSkillId|null;hint:string}{
  if(e.mode==='normal'||e.mode==='karma')return {skills:[],opening:null,critical:null,hint:''};
  if(e.mode==='ultimate'){
    const pattern=ULTIMATE_ENEMY_AUTO_PATTERNS[(e.pattern??0)%ULTIMATE_ENEMY_AUTO_PATTERNS.length];
    return {skills:['blackest_night','divination'],...pattern,hint:pattern.counterPlan};
  }
  const series=Math.max(0,Math.min(2,e.series-1)),layer=Math.max(0,Math.min(3,e.layer-1));
  return {skills:SAVAGE_ENEMY_SUPPORT_PROFILES[series][layer],...SAVAGE_ENEMY_AUTO_PROFILES[series][layer],hint:''};
}
