import { quiet, type VoiceFeatures } from './voice-analysis';
export type MotionMode = 0 | 1 | 2;
// Dual envelope: sustained energy transports the field; a fast envelope follows
// syllables. Frame-rate independent adaptation of Orbio's attack/release model.
export function createMotionFilter(){
 const value={...quiet};
 return (raw:VoiceFeatures,dt:number):VoiceFeatures[]=>{
  const frames=Math.max(0,Math.min(dt,.1))*60;
  const follow=(old:number,target:number,attack:number,release:number)=>
   old+(target-old)*(1-Math.pow(1-(target>old?attack:release),frames));
  value.energy=follow(value.energy,raw.energy,.35,.09);
  value.pulse=follow(value.pulse,raw.energy,.8,.34);
  for(const key of ['low','mid','high','centroid','flux'] as const)value[key]=follow(value[key],raw[key],.45,.16);
  return [0,1,2].map(()=>({...value}));
 };
}

// Shared audible rhythm for the orb and border. Keep syllables, reject the noise floor.
export function voiceDrive(features:VoiceFeatures){
 const level=Math.max(0,Math.min(1,(features.pulse-.045)/.955));
 // Positive fast-minus-slow energy marks syllable attacks, without position jumps.
 const onset=Math.max(0,features.pulse-features.energy);
 return Math.min(1,Math.pow(level,.65)+onset*.9);
}
