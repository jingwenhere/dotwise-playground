import { defaultSetting1 } from './default-settings';
import { StudySlider as Slider } from './StudySlider';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PaletteOrb } from './components/ui/palette-orb';
import './palette.css';
import { VoiceDialog } from './VoiceDialog';
import { useVoiceSample } from './useVoiceSample';
import { voiceDrive, type MotionMode } from './voice-motion';
import { quiet, type VoiceFeatures } from './voice-analysis';
// Original stops: Figma 3364:20819. Rich colours are intentional adaptations.
const palettes = [
  { name: 'Porcelain', original: ['#F9F9F9','#F9F9F9'], tones: ['#F1E7DB','#D8E9FF','#AFD4FC','#EDF5FF'] },
  { name: 'Apricot', original: ['#F9F9F7','#F3E7E3'], tones: ['#FFE8CE','#F7BCC4','#DDAAC4','#FFF1DE'] },
  { name: 'Rose lilac', original: ['#EFD0D4','#E2E4FC'], tones: ['#F3D9DE','#E7BDCF','#AF9AD9','#DAD9F6'] },
  { name: 'Blue apricot', original: ['#CDDAFD','#FFF1E6'], tones: ['#FFE0C1','#BDD8FF','#8C9EE9','#F9C9D7'] },
  { name: 'Aqua lilac', original: ['#DCFCF5','#E2E4FC'], tones: ['#BFF5E4','#A8E0F3','#AD9CE4','#DDD0F6'] },
  { name: 'Cool mint', original: ['#DCFCF5','#F4ECD6'], tones: ['#E8FAFF','#BCEFE8','#76C9D1','#CADFFF'] },
];
function GradientOrb({ index, size, strength, speed, brightness, blend, mode, voice=quiet, audioActive=false, audioResponse=1 }: {index:number;size:number;strength:number;speed:number;brightness:number;blend:number;mode:MotionMode;voice?:VoiceFeatures;audioActive?:boolean;audioResponse?:number}) {
  const p = palettes[index];
  const tones=p.tones;
  const drive=voiceDrive(voice)*audioResponse;
  return <span className="gradient-orb" style={{width:size,height:size}}><PaletteOrb size={size} state="idle" maxDpr={2} pauseOffscreen ariaLabel={`${p.name} gradient orb`}
    colors={{light:tones[0],body:tones[1],shadow:tones[2],accent:tones[3]}} stateVolumes={{idle:{input:0,output:1}}}
    params={{speed:speed*.01+drive*(22+speed*1.3), drift:drive*12, curl:drive*9,shadowArea:index===5?.45:1,motionMode:mode,saturation:strength,brightness,blend,...voice}}/></span>;
}
function PalettePreview() {
  const [selected,setSelected]=useState(defaultSetting1.palette), [strength,setStrength]=useState(defaultSetting1.orb.saturation), [speed,setSpeed]=useState(defaultSetting1.orb.speed);
  const [brightness,setBrightness]=useState(defaultSetting1.orb.brightness),[blend,setBlend]=useState(defaultSetting1.orb.blend);
  const [volume,setVolume]=useState(defaultSetting1.volume);
  const [audioResponse,setAudioResponse]=useState(defaultSetting1.audioResponse);
  const mode:MotionMode=1;
  const audio=useVoiceSample(mode,volume);
  const props={audioResponse,strength,speed,brightness,blend,mode,voice:audio.features,audioActive:audio.playing};
  return <main className="palette-page">
    <header><a href="/">Dotwise</a><div className="header-actions"><span>Voice Mode</span></div></header>
    <section className="palette-study" aria-label="Gradient orb preview">
      <div className="orb-workspace">
      <div className="hero-orb"><GradientOrb index={selected} size={280} {...props}/></div>
      <div className="audio-test control-grid"><button type="button" aria-label={audio.playing?'Stop sound':'Play sound'} title={audio.playing?'Stop sound':'Play sound'} disabled={audio.loading} onClick={()=>void audio.play()}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{audio.playing?<rect x="6" y="6" width="12" height="12" rx="2"/>:<path d="M8 4.8c0-.8.9-1.3 1.6-.9l11 7.2a1.1 1.1 0 0 1 0 1.8l-11 7.2c-.7.4-1.6-.1-1.6-.9Z"/>}</svg></button></div>
      {audio.error&&<p role="alert">{audio.error}</p>}
      <div className="comparison"><span className="row-label">Theme</span><div className="orb-row">{palettes.map((p,i)=><img key={p.name} src={`/palette-reference/${String(i+1).padStart(2,'0')}.svg`} width="52" height="52" alt={`${p.name} theme palette`}/>)}</div>
      <span className="row-label">Voice tube</span><div className="orb-row">{palettes.map((p,i)=><button key={p.name} className="orb-option" aria-label={`Select ${p.name}`} aria-pressed={selected===i} onClick={()=>setSelected(i)}><GradientOrb index={i} size={52} {...props}/></button>)}</div></div>
      <div className="palette-controls control-grid">
        <Slider label="Volume" value={volume} min={0} max={1} step={.01} onChange={setVolume} text={`${Math.round(volume*100)}%`}/>
        <Slider label="Saturation" value={strength} min={0} max={1} step={.01} onChange={setStrength} text={`${Math.round(strength*100)}%`}/>
        <Slider label="Brightness" value={brightness} min={.7} max={1.2} step={.01} onChange={setBrightness} text={`${Math.round(brightness*100)}%`}/>
        <Slider label="Audio response" value={audioResponse} min={0} max={2} step={.05} onChange={setAudioResponse} text={`${Math.round(audioResponse*100)}%`} hint="How strongly sound changes the orb and border flow. Does not change playback volume."/>
        <Slider label="Blend" value={blend} min={0} max={1} step={.01} onChange={setBlend} text={`${Math.round(blend*100)}%`}/>
        <Slider label="Flow speed" value={speed} min={0} max={80} step={1} onChange={setSpeed} text={`${speed}`}/>
      </div>
      </div>
      <VoiceDialog audioResponse={audioResponse} tones={palettes[selected].tones} name={palettes[selected].name} features={audio.features} elapsed={audio.elapsed} duration={audio.duration} playing={audio.playing} loading={audio.loading} onPlay={()=>void audio.play()} orb={<GradientOrb index={selected} size={26} {...props}/>}/>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><PalettePreview/></StrictMode>);
