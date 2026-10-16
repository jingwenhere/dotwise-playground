export type VoiceFeatures = { energy:number; low:number; mid:number; high:number; centroid:number; flux:number; pulse:number };
export const quiet:VoiceFeatures={energy:0,low:0,mid:0,high:0,centroid:0,flux:0,pulse:0};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function analyseVoice(wave:Float32Array, spectrum:Float32Array, sampleRate:number, fftSize:number, previous?:Float32Array):VoiceFeatures {
  const rms=Math.sqrt(wave.reduce((sum,x)=>sum+x*x,0)/wave.length);
  const db=20*Math.log10(Math.max(rms,1e-8));
  // Preserve amplitude contrast instead of clipping louder syllables at -20 dB.
  const energy=clamp(Math.pow(Math.max(0,rms-.003)/.18,.7));
  function band(lo:number,hi:number){
    let power=0, count=0;
    for(let i=Math.ceil(lo*fftSize/sampleRate);i<Math.min(spectrum.length,Math.ceil(hi*fftSize/sampleRate));i++){power+=10**(spectrum[i]/10);count++;}
    return energy*clamp((10*Math.log10(Math.max(power/Math.max(count,1),1e-10))+80)/45);
  }
  let total=0,weighted=0,rise=0;
  for(let i=1;i<spectrum.length;i++){
    const hz=i*sampleRate/fftSize;
    const magnitude=Number.isFinite(spectrum[i])?10**(spectrum[i]/20):0;
    if(hz>=80&&hz<8000){total+=magnitude;weighted+=magnitude*hz;rise+=Math.max(0,magnitude-(previous?.[i]??magnitude));}
    if(previous)previous[i]=magnitude;
  }
  const centroid=energy*clamp((weighted/Math.max(total,1e-8)-250)/3000);
  const flux=energy*clamp(rise/Math.max(total,.001)*3);
  return {energy,centroid,flux,pulse:0,low:band(80,300),mid:band(300,2000),high:band(2000,8000)};
}
