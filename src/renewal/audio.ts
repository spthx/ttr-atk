import {GAME_AUDIO,FANKIT_AUDIO} from './assets';
class RenewalAudio {
  enabled=true;private context:AudioContext|null=null;private loop:AudioBufferSourceNode|null=null;private pending:Promise<AudioBuffer>|null=null;private generation=0;private speed:1|2=1;
  unlock(){if(!this.enabled)return;if(!this.context)this.context=new AudioContext();void this.context.resume();}
  async coins(){this.unlock();const ctx=this.context;if(!ctx||!this.enabled||this.loop)return;
    const generation=this.generation;
    try{this.pending??=fetch(GAME_AUDIO.capitalRapidFire).then(r=>{if(!r.ok)throw new Error('audio');return r.arrayBuffer();}).then(a=>ctx.decodeAudioData(a));const buffer=await this.pending;
      if(!this.enabled||generation!==this.generation||this.loop)return;const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;source.playbackRate.value=this.speed;gain.gain.value=.09;source.connect(gain);gain.connect(ctx.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start();this.loop=source;
    }catch{this.pending=null;}
  }
  stop(){this.generation++;this.speed=1;try{this.loop?.stop();}catch{/* already released */}this.loop=null;}
  rate(speed:1|2){this.speed=speed;if(this.loop&&this.context)this.loop.playbackRate.setValueAtTime(speed,this.context.currentTime);}
  cue(won:boolean){if(!this.enabled)return;const element=new Audio(won?FANKIT_AUDIO.victory:FANKIT_AUDIO.defeat);element.volume=.2;void element.play().catch(()=>{});}
}
export const renewalAudio=new RenewalAudio();
