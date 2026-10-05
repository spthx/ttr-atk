import {businesses,skills,groups,type Encounter} from './content';
import {availableSkills,availableSynergies,activeGroups,autoUnlocked,type Company} from './campaign';
import {MarketWind} from './wind';
import {enemyProfile} from './enemy';
import type {EnemySupportSkillId} from '../data/battleEncounterData';
export type Action={kind:'cash';ratio:number}|{kind:'network';id?:string}|{kind:'group';id:string}|{kind:'alliance'}|{kind:'limit'}|{kind:'skill';id:string};
export type Pour={id:number;side:0|1;from:number;to:number;start:number;duration:number};
type Warning={kind:'drain'|'drill'|'barrier'|'divination'|'rapid'|'enemyLimit'|'reversal'|'liquidation'|'copy'|'declaration'|'reckoning';name:string;hint:string;remaining:number;copyKind?:Action['kind'];copyAmount?:number;countered?:number};
const counters:Record<Action['kind'],Action['kind'][]>={cash:['network','group'],network:['cash','skill'],group:['limit','skill'],alliance:['cash','skill'],limit:['network','skill'],skill:['cash','group']};
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
export class TradeEngine {
  readonly events=new EventTarget();
  readonly receipt=crypto.randomUUID();
  visual=0;time=0;ownership=50;player=0;enemy=0;cash:number;reserve:number;budget:number;cashStart:number;
  direct=0;drain=0;supportUses=0;lb=0;lbUses=0;allianceUsed=false;cooldown=0;enemyClock=3.5;
  recovered=0;enemyRecovered=0;winner:'player'|'opponent'|null=null;message='資金を積んで、商談を動かすでっす。';
  usedSkills=new Set<string>();usedGroups=new Set<string>();risk:Record<string,number>;pours:Pour[]=[];
  warning:Warning|null=null;shield=0;shieldTime=0;cover=0;coverCapacity=0;feint=0;haste=0;buff=0;immortal=0;recovery=0;reversal=0;enemyShield=0;
  private serial=0;private checkpoints=0;private resolved=new Set<string>();private cruelStage=0;private cruelClock=0;private signature=0;private grace=0;
  private awaitingCounter=false;private debt=0;private escrow=0;private synergyMultiplier=1;private synergyTick=0;
  readonly marketWind:MarketWind;private opened=false;
  private enemyUsed=new Set<EnemySupportSkillId>();private criticalUsed=false;private divination=0;private rapid=0;private enemyShieldTime=0;
  constructor(readonly encounter:Encounter,readonly company:Company){
    let seed=Array.from(encounter.id).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,17);
    this.marketWind=new MarketWind(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
    const stage=Math.max(0,businesses.filter(p=>p.marketPrice<=encounter.price&&p.countsTowardCityConquest!==false).length);
    this.cash=this.cashStart=Math.min(company.cash,encounter.price);
    this.lb=clamp(company.lbCarry??0,0,this.lbTier*100);
    const scale=encounter.mode==='normal'?(stage<=2?.38:.8+Math.min(.9,stage*.055)):encounter.mode==='savage'?1.35+encounter.series*.12:2.2;
    this.budget=Math.round(encounter.price*scale);this.reserve=this.budget;this.risk={...company.risk};
    if(encounter.mode==='karma'){this.escrow=this.budget*.24;this.reserve-=this.escrow;}
    this.commit(1,Math.round(this.budget*.14));
  }
  get motion(){return this.pours.some(p=>this.visual<p.start+p.duration);}
  get ready(){return !this.winner&&!this.motion&&this.cooldown<=0;}
  get record(){return this.encounter.mode==='phantom'||this.encounter.mode==='karma';}
  get supportLimit(){return ['ultimate','karma'].includes(this.encounter.mode)?8:18;}
  get lbTier(){return this.company.owned.length>=15?3:this.company.owned.length>=7?2:this.company.owned.length>=3?1:0;}
  get remaining(){return this.encounter.mode==='ultimate'?Math.max(0,108-this.time):null;}
  supportAmount(id:string){const p=businesses.find(p=>p.id===id);if(!p||!this.company.owned.includes(id))return 0;
    const floor=this.encounter.price*(this.encounter.mode==='normal'?Math.min(.1,this.company.owned.length*.006):.1);
    return Math.round(Math.max(p.marketPrice*.75,floor)*Math.max(.5,1-this.supportUses*.1));}
  strongest(){return this.company.owned.reduce((best,id)=>this.supportAmount(id)>this.supportAmount(best)?id:best,'');}
  private emit(name:string){this.events.dispatchEvent(new Event(name));}
  private commit(side:0|1,amount:number){
    const before=side===0?this.player:this.enemy;
    if(side===1){amount=Math.min(this.reserve,amount);this.reserve-=amount;this.enemy+=amount;}else this.player+=amount;
    if(amount<=0)return;
    const ratio=amount/Math.max(1,this.encounter.price);
    const duration=Math.min(5400,Math.max(400,1485*Math.max(.3,Math.sqrt(ratio/.35))));
    this.pours.push({id:++this.serial,side,from:before,to:before+amount,start:this.visual,duration});
    this.pours=this.pours.slice(-32);this.emit('coins');
  }
  private push(value:number){
    if(value<0&&this.ownership+value<=25&&this.company.critical&&autoUnlocked(this.company,'critical'))this.autoSkill(this.company.critical);
    if(value<0){value*=this.feint>0?.9:1;
      if(this.cover>0){const protectedAmount=Math.min(this.coverCapacity,-value*.92);this.coverCapacity-=protectedAmount;value+=protectedAmount;if(this.coverCapacity<=0)this.cover=0;}
      const absorbed=Math.min(this.shield,-value);this.shield-=absorbed;value+=absorbed;
      if(absorbed>0&&this.shield===0){this.ownership+=10;this.message='ブラックナイト破壊――暗黒波動で押し返す！';}}
    if(value>0&&this.enemyShield>0){const absorbed=Math.min(this.enemyShield,value);this.enemyShield-=absorbed;value-=absorbed;}
    const raw=this.ownership-this.debt+value;
    if(raw<=0&&this.immortal>0){this.debt=1-raw;this.ownership=1;this.immortal=0;this.recovery=10;this.message='リビングデッド――10秒で所有率30%まで戻す！';}
    else if(this.recovery>0){this.debt=Math.max(0,1-raw);this.ownership=clamp(raw,1,100);}else{this.debt=0;this.ownership=clamp(raw);}
  }
  private warn(kind:Warning['kind'],name:string,hint:string,remaining:number,extra:Partial<Warning>={}){this.warning={kind,name,hint,remaining,...extra};this.message=name;this.emit('warning');}
  private enemyAction(id:EnemySupportSkillId|null){
    if(!id||this.warning||this.enemyUsed.has(id))return false;
    const actions={drain:['drain','ドレイン','手元資金の18%、相場10%までを吸収。先に積んで守る。'],drill:['drill','整備 → ドリル','牽制・防御を合わせ、着弾後に反撃。'],blackest_night:['barrier','ブラックナイト','7秒の有限障壁。防御切れを見極める。'],divination:['divination','ディヴィネーション','5秒の資本圧強化。時代の風で相殺。'],rapid_assault:['rapid','黒魔紋','13秒の連続投入。反撃資金を残す。'],limit_break_3:['enemyLimit','LIMIT BREAK III','強い押し込み。防御を合わせて再建。']} as const;
    if(!(id in actions))return false;
    const action=actions[id as keyof typeof actions];this.enemyUsed.add(id);this.warn(action[0],action[1],action[2],3);return true;
  }
  private autoSkill(id:string){if(this.usedSkills.has(id)||this.motion)return;const cooldown=this.cooldown;this.cooldown=0;this.act({kind:'skill',id});this.cooldown=cooldown;}
  act(a:Action):boolean {
    if(!this.ready)return false;
    const price=this.encounter.price;let addition=0;
    if(a.kind==='cash'){
      if(![.02,.05,.1,.2,.35].includes(a.ratio))return false;
      const cost=Math.round(price*a.ratio);if(cost<=0||this.cash<cost)return false;
      this.cash-=cost;this.direct+=cost;addition=cost;
      if(this.cruelStage===3)this.signature+=cost;
      if(this.reversal>0){addition=cost*.7;this.reserve+=cost*.3;this.commit(1,cost*.3);this.reversal=0;this.message='反転契約：出資の30%が競合へ。';}else this.message=`自社資金を積むでっす！`;
      this.commit(0,addition);this.push(Math.min(10,addition/price*24)*this.wind.player);
      if(addition<cost)this.push(-Math.min(this.encounter.series===1?8:100,(cost-addition)/price*24));
    }else if(a.kind==='network'){
      if(this.supportUses>=this.supportLimit)return false;const id=a.id??this.strongest();addition=this.supportAmount(id);if(addition<=0)return false;
      this.supportUses++;this.risk[id]=clamp((this.risk[id]??0)+12);this.commit(0,addition);this.push(Math.min(14,addition/price*18)*this.wind.player);this.message='人脈から資金が届くでっす！';
    }else if(a.kind==='group'){
      const g=[...activeGroups(this.company),...availableSynergies(this.company)].find(g=>g.id===a.id);if(!g||this.usedGroups.has(g.id))return false;
      if(g.battleOnly){if(!availableSynergies(this.company).some(s=>s.id===g.id)||!g.battleEffect||[...this.usedGroups].some(id=>groups.find(item=>item.id===id)?.battleOnly))return false;
        this.buff=g.battleEffect.durationMs/1000;this.synergyMultiplier=g.battleEffect.capitalPressureMultiplier;this.synergyTick=(g.battleEffect.continuousGaugePushPerSecond??0)/2;this.push(g.battleEffect.ownershipPush);this.usedGroups.add(g.id);this.message=g.name+'、発動！';
      }else{if(!g.requiredPropertyIds.length||!g.requiredPropertyIds.every(id=>this.company.owned.includes(id)))return false;
        addition=g.requiredPropertyIds.reduce((sum,id)=>sum+this.supportAmount(id),0)*(g.battleGroupMultiplier??1.3);this.usedGroups.add(g.id);this.commit(0,addition);this.push(Math.min(18,addition/price*20));this.message=g.name+'、一斉調達！';}
    }else if(a.kind==='alliance'){
      if(!this.company.patron||this.allianceUsed)return false;this.allianceUsed=true;addition=price*.75;this.commit(0,addition);this.push(15);this.message='外部の後援が届くでっす！';
    }else if(a.kind==='limit'){
      if(!this.lbTier||this.lb<100||this.encounter.mode==='ultimate'&&this.lbUses>=1)return false;const tier=Math.min(this.lbTier,Math.floor(this.lb/100));this.lb=0;this.lbUses++;
      addition=Math.round((price*.28+this.company.owned.reduce((sum,id)=>sum+(businesses.find(p=>p.id===id)?.marketPrice??0)*.28*Math.max(.5,1-this.supportUses*.1),0))*[0,1.56,1.98,2.46][tier]);
      addition=Math.min(addition,price*[0,.8,1.2,Infinity][tier]);this.commit(0,addition);this.push(Math.min([0,7,14,30][tier],addition/price*85*this.wind.player));this.message='LIMIT BREAK――商会の総力をここへ！';this.emit('limit');
    }else {
      const skill=skills.find(s=>s.id===a.id);if(!skill||![...this.company.equipped,this.company.opening,this.company.critical].includes(a.id)||!availableSkills(this.company).some(s=>s.id===a.id)||this.usedSkills.has(a.id))return false;this.usedSkills.add(a.id);this.message=skill.name+'！';
      if(skill.effectType==='FEINT')this.feint=10;
      if(skill.effectType==='COVER'){this.cover=16;this.coverCapacity=42;}
      if(skill.effectType==='BARRIER'){this.shield=25;this.shieldTime=7;}
      if(skill.effectType==='COOLDOWN_REDUCTION')this.haste=15;
      if(skill.effectType==='CAPITAL_BOOST'){addition=price*.4;this.commit(0,addition);this.push(10);}
      if(skill.effectType==='LIVING_DEAD')this.immortal=10;
      this.emit('skill');
    }
    if(a.kind!=='alliance'&&a.kind!=='limit')this.lb=clamp(this.lb+addition/price*100*1.2*(this.buff>0&&this.synergyMultiplier>=2.18?1.25:1),0,this.lbTier*100);
    this.cooldown=this.haste>0?1.3*2.8/5.2:1.3;
    this.awaitingCounter=false;
    if(this.warning?.kind==='copy'&&a.kind!==this.warning.copyKind)this.warning.countered=counters[this.warning.copyKind!].includes(a.kind)?1:.5;
    this.checkThreshold(a.kind,addition,true);
    return true;
  }
  private checkThreshold(kind:Action['kind'],addition:number,activeAction=false){
    const mode=this.encounter.mode;
    if(mode==='karma'&&activeAction&&!this.warning&&this.checkpoints<4&&this.ownership>=[55,70,85,95][this.checkpoints]){
      this.ownership=Math.min(this.ownership,[55,70,85,95][this.checkpoints]);this.checkpoints++;
      const labels={cash:'自社資金',network:'人脈',group:'事業連携',alliance:'外部後援',limit:'限界突破',skill:'アビリティ'};
      this.warn('copy','ものまねの予告',`${counters[kind].map(k=>labels[k]).join('・')}で取消。別系統なら半減。`,6,{copyKind:kind,copyAmount:Math.min(28,10+addition/this.encounter.price*14)});return;
    }
    if(mode==='cruel'&&this.cruelStage===0&&this.time>=15&&!this.warning){this.cruelStage=1;this.warn('declaration','星海資本の宣告','所有率が10%へ。反撃の資金を残す。',4.5);return;}
    if(!this.warning&&!this.criticalUsed&&this.ownership>=70){this.criticalUsed=true;if(this.enemyAction(enemyProfile(this.encounter).critical))return;}
    if(mode!=='normal'&&mode!=='karma'&&mode!=='cruel'&&!this.warning){
      if(this.encounter.layer>=3&&this.ownership>=55&&!this.resolved.has('reversal')){this.resolved.add('reversal');this.warn('reversal','資本反転','次の自社出資を30%反射。小口・人脈で対応。',2.7);return;}
      if(this.encounter.layer>=4&&this.ownership>=75&&!this.resolved.has('liquidation')){this.resolved.add('liquidation');this.warn('liquidation','強制清算','防御を用意し、着弾後の反撃を残す。',4);return;}
    }
    if(this.ownership>=100&&!this.warning&&this.reversal<=0&&!(mode==='karma'&&this.checkpoints<4)&&!(mode==='cruel'&&this.cruelStage<4)){this.winner='player';this.emit('win');}
  }
  private resolveWarning(){
    const w=this.warning;if(!w)return;this.warning=null;
    if(w.kind==='drain'){const stolen=Math.min(this.cash*.18,this.encounter.price*.1);this.cash-=stolen;this.drain+=stolen;this.reserve+=stolen;this.message='未投入の資金が吸収された。';}
    if(w.kind==='drill'){this.commit(1,Math.min(this.reserve,this.encounter.price*.06));this.push(this.encounter.mode==='ultimate'?-10:-8);}
    if(w.kind==='barrier'){this.enemyShield=25;this.enemyShieldTime=7;this.message='競合の障壁。出資を重ねて崩す！';}
    if(w.kind==='divination')this.divination=5;
    if(w.kind==='rapid')this.rapid=13;
    if(w.kind==='enemyLimit'){this.commit(1,this.encounter.price*.18);this.push(-30);}
    if(w.kind==='reversal')this.reversal=10;
    if(w.kind==='liquidation'){this.push(-Math.max(0,this.ownership-3));this.grace=this.encounter.mode==='ultimate'?4:this.encounter.series===1?3:1.4;this.cooldown=0;this.awaitingCounter=this.encounter.mode==='ultimate';}
    if(w.kind==='copy'){this.push(-Math.min(Math.max(0,this.ownership-1),(w.copyAmount??20)*(1-(w.countered??0))));const copyCash=Math.min(this.escrow,this.budget*.06)*(1-(w.countered??0));this.escrow=Math.max(0,this.escrow-this.budget*.06);this.reserve+=copyCash;this.commit(1,copyCash);this.message=w.countered===1?'ものまねを打ち消した！':w.countered?'別系統で半減！':'一手を模倣された。';}
    if(w.kind==='declaration'){this.ownership=Math.min(10,this.ownership);this.cruelStage=2;this.cruelClock=10;this.message='10秒で所有率50%へ立て直す！';}
    if(w.kind==='reckoning'){if(this.ownership<75||this.signature<this.encounter.price*.1){this.winner='opponent';const missing=[this.ownership<75?`所有率 ${this.ownership.toFixed(1)}%／必要75%`:null,this.signature<this.encounter.price*.1?`査定中の自社出資 ${(this.signature/this.encounter.price*100).toFixed(1)}%／必要10%`:null].filter(Boolean);this.message=`査定未達：${missing.join('・')}。反撃用の資源を残して再挑戦。`;}else{this.cruelStage=4;this.message='査定突破！ 最後の商談へ！';}}
    this.checkThreshold('skill',0);
  }
  get wind(){return this.buff>0&&this.synergyMultiplier>=2.18?{player:1,enemy:1,recovery:1,enemyRecovery:1,speed:1}:this.marketWind.multipliers;}
  step(realSeconds:number,speed:1|2=1){
    if(!Number.isFinite(realSeconds)||realSeconds<=0)return;
    let remaining=Math.min(3600,realSeconds);while(remaining>1e-9){const dt=Math.min(.05,remaining);this.stepSlice(dt,speed);remaining-=dt;}
  }
  private stepSlice(realSeconds:number,speed:1|2=1){
    if(!Number.isFinite(realSeconds)||realSeconds<=0)return;
    this.visual+=realSeconds*1000*speed;
    if(this.motion)return;
    if(this.winner)return;
    if(!this.opened){this.opened=true;if(this.company.opening&&autoUnlocked(this.company,'opening'))this.autoSkill(this.company.opening);this.enemyAction(enemyProfile(this.encounter).opening);if(this.motion)return;}
    const dt=Math.min(.1,realSeconds);
    this.cooldown=Math.max(0,this.cooldown-dt);
    for(const key of ['feint','cover','haste','buff','immortal','reversal','grace'] as const)this[key]=Math.max(0,this[key]-dt);
    this.divination=Math.max(0,this.divination-dt);this.rapid=Math.max(0,this.rapid-dt);this.enemyShieldTime=Math.max(0,this.enemyShieldTime-dt);if(this.enemyShieldTime===0)this.enemyShield=0;
    if(this.shieldTime>0){this.shieldTime-=dt;if(this.shieldTime<=0)this.shield=0;}
    if(this.recovery>0){this.recovery-=dt;if(this.ownership>=30)this.recovery=0;else if(this.recovery<=0){this.winner='opponent';this.message='リビングデッド：回復が間に合わなかった。';return;}}
    if(this.warning){this.warning.remaining-=dt;if(this.warning.remaining<=0)this.resolveWarning();return;}
    if(this.cruelStage===2){this.cruelClock-=dt;if(this.ownership>=50||this.cruelClock<=0){this.cruelStage=3;this.signature=0;this.warn('reckoning','終極資本査定','15秒で所有率75%・査定中に自社出資10%。',15);}}
    this.time+=dt;
    if(!(this.buff>0&&this.synergyMultiplier>=2.18)&&this.encounter.city!=='グリダニア')this.marketWind.step(dt);
    if(this.remaining===0){this.winner='opponent';this.message='終極査定の108秒が終了した。';return;}
    const replenish=Math.min(this.cashStart*.003*dt*this.wind.recovery,this.cashStart*.2-this.recovered,this.cashStart-this.cash);
    if(replenish>0){this.cash+=replenish;this.recovered+=replenish;}
    const er=Math.min(this.budget*.003*dt*this.wind.enemyRecovery,this.budget*.2-this.enemyRecovered,this.budget-this.reserve);if(er>0){this.reserve+=er;this.enemyRecovered+=er;}
    const pressure=clamp(Math.log2((this.player*this.wind.player*(this.buff>0?this.synergyMultiplier:1)+this.encounter.price*.08)/(this.enemy*this.wind.enemy*(this.divination>0&&!(this.buff>0&&this.synergyMultiplier>=2.18)?1.42:1)+this.encounter.price*.08))*.95,-4,4);
    if(this.grace<=0&&!(this.awaitingCounter&&pressure>0))this.push((pressure*this.wind.speed+(this.buff>0?this.synergyTick:0))*dt);
    this.enemyClock-=dt*(this.rapid>0?2.05:1);
    if(this.enemyClock<=0){this.enemyClock=this.encounter.mode==='normal'?5.5:4;
      this.commit(1,Math.round(this.encounter.price*(this.ownership>65?.18:.1)));
      if(this.time>6&&!this.warning&&this.cruelStage!==2){const skill=enemyProfile(this.encounter).skills.find(id=>!this.enemyUsed.has(id)&&!['capital_reversal','forced_liquidation'].includes(id));if(skill)this.enemyAction(skill);}}
    this.checkThreshold('cash',0);
    if(this.ownership<=0&&this.recovery<=0){this.winner='opponent';this.message='競合に押し切られました。自社資金や人脈を早めに投入して、主導権をつかみましょう。';this.emit('lose');}
  }
  surrender(){if(!this.winner){this.winner='opponent';this.warning=null;this.message='自社資金を回収し、次の商機へ。';}}
}
