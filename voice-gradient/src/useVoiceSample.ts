import { useEffect, useRef, useState } from 'react';
import { analyseVoice, quiet, type VoiceFeatures } from './voice-analysis';
import { createMotionFilter, type MotionMode } from './voice-motion';
export function useVoiceSample(mode:MotionMode,volume=.6){
  const modeRef=useRef(mode);
  useEffect(()=>{modeRef.current=mode;},[mode]);
  const [elapsed,setElapsed]=useState(0);
  const [duration,setDuration]=useState(8.4),[loading,setLoading]=useState(false);
  const [features,setFeatures]=useState<VoiceFeatures>(quiet);
  const [playing,setPlaying]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
  const engine=useRef<{context:AudioContext;source:AudioBufferSourceNode;inputGain:GainNode;frame:number}|null>(null);
  const volumeRef=useRef(volume);
  useEffect(()=>{
    volumeRef.current=volume;
    const current=engine.current;
    if(current)current.inputGain.gain.setTargetAtTime(volume/.6,current.context.currentTime,.025);
  },[volume]);
  const starting=useRef(false),generation=useRef(0);
  function stop(){
    generation.current++;
    const old=engine.current;engine.current=null;
    if(old){cancelAnimationFrame(old.frame);old.source.onended=null;try{old.source.stop();}catch{}void old.context.close();}
    setPlaying(false);setFeatures(quiet);setProgress(0);setElapsed(0);
  }
  useEffect(()=>()=>{generation.current++;const old=engine.current;if(old){cancelAnimationFrame(old.frame);old.source.onended=null;try{old.source.stop();}catch{}void old.context.close();}},[]);
  async function play(){
    if(engine.current){stop();return;}if(starting.current)return;
    starting.current=true;setLoading(true);setError('');const id=++generation.current;let ctx:AudioContext|undefined;
    try{
      ctx=new AudioContext();await ctx.resume();
      if(id!==generation.current){await ctx.close();return;}
      const response=await fetch('/audio/english-linda-johnson.wav');
      if(!response.ok)throw new Error('Audio unavailable');
      const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
      if(id!==generation.current){await ctx.close();return;}
      setDuration(buffer.duration);
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=0;
      const gain=ctx.createGain();gain.gain.value=.6;
      // Preserve the original preset at 60%; analyse the user-adjusted signal.
      const inputGain=ctx.createGain();inputGain.gain.value=volumeRef.current/.6;
      source.connect(inputGain);inputGain.connect(analyser);analyser.connect(gain);gain.connect(ctx.destination);
      const current={context:ctx,source,inputGain,frame:0};engine.current=current;
      const wave=new Float32Array(analyser.fftSize),spectrum=new Float32Array(analyser.frequencyBinCount);
      const previous=new Float32Array(analyser.frequencyBinCount);
      const start=ctx.currentTime;let last=0;const filter=createMotionFilter();
      function tick(now:number){
        if(engine.current!==current)return;
        if(now-last>=16){
          const dt=Math.min((now-last)/1000,.1);last=now;
          analyser.getFloatTimeDomainData(wave);analyser.getFloatFrequencyData(spectrum);
          const target=analyseVoice(wave,spectrum,current.context.sampleRate,analyser.fftSize,previous);
          const outputs=filter(target,dt);
          setElapsed(Math.max(0,current.context.currentTime-start-(current.context.outputLatency||0)));
          setFeatures(outputs[modeRef.current]);setProgress(((current.context.currentTime-start)%buffer.duration)/buffer.duration);
        }
        current.frame=requestAnimationFrame(tick);
      }
      source.onended=()=>{if(engine.current===current)stop();};source.start();setPlaying(true);current.frame=requestAnimationFrame(tick);
    }catch{if(ctx)void ctx.close();setError('Unable to play audio. Please try again.');setPlaying(false);}finally{starting.current=false;setLoading(false);}
  }
  return {elapsed,features,playing,progress,duration,loading,error,play};
}
