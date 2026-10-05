export type WindKind='calm'|'player'|'head'|'enemy'|'cross';
export class MarketWind {
  kind:WindKind='calm';phase:'calm'|'forecast'|'active'|'cooldown'='calm';remaining=10;pending:WindKind='calm';private previous:WindKind='calm';
  constructor(private random:()=>number=Math.random){}
  step(seconds:number){this.remaining-=seconds;if(this.remaining>1e-8)return;
    if(this.phase==='active'){this.previous=this.kind;this.kind='calm';this.phase='cooldown';this.remaining=18;return;}
    if(this.phase==='forecast'){this.kind=this.pending;this.phase='active';this.remaining=7+this.random()*2;return;}
    if(this.phase==='cooldown'){this.phase='calm';this.remaining=10;return;}
    this.phase='calm';this.remaining=10;
    if(this.random()>=.25)return;
    const choices=(['player','head','enemy','cross'] as const).filter(k=>k!==this.previous);this.pending=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];this.phase='forecast';this.remaining=2;
  }
  get multipliers(){return this.kind==='player'?{player:1.35,enemy:1,recovery:1.25,enemyRecovery:1,speed:1}:this.kind==='head'?{player:.72,enemy:1,recovery:.75,enemyRecovery:1,speed:1}:this.kind==='enemy'?{player:1,enemy:1.35,recovery:1,enemyRecovery:1.25,speed:1}:this.kind==='cross'?{player:1.12,enemy:1.12,recovery:1.2,enemyRecovery:1.2,speed:1.45}:{player:1,enemy:1,recovery:1,enemyRecovery:1,speed:1};}
  get label(){return {calm:'静穏',player:'自社に追い風',head:'自社に向かい風',enemy:'競合に追い風',cross:'乱旋風'}[this.phase==='forecast'?this.pending:this.kind];}
}
