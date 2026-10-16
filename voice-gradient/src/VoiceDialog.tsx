import { voiceDrive } from './voice-motion';
import { defaultSetting1 } from './default-settings';
import { StudySlider } from './StudySlider';
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { dialogTheme } from './dialog-theme';
import { recordingTranscript } from './sample-transcript';
import type { VoiceFeatures } from './voice-analysis';

type Props={audioResponse:number;tones:string[];name:string;features:VoiceFeatures;elapsed:number;duration:number;orb:ReactNode;playing:boolean;loading:boolean;onPlay:()=>void};
const icons=[['Select','35c45.svg'],['Square','bf2c6.svg'],['Draw','d94d4.svg'],['Text','39ed3.svg'],['Note','6071e.svg'],['Frame','ef940.svg'],['Shapes','f2566.svg']];
export function VoiceDialog({audioResponse,tones,name,features,elapsed,duration,orb,playing,loading,onPlay}:Props){
 const [mono,setMono]=useState(defaultSetting1.mono),[tool,setTool]=useState('Select');
 const [edge,setEdge]=useState({...defaultSetting1.edge});
 const edgeControls=[{key:'width',label:'Band width',min:.25,max:3,step:.05},{key:'intensity',label:'Intensity',min:0,max:1.5,step:.05},{key:'glow',label:'Glow',min:0,max:3,step:.05},{key:'blend',label:'Blend',min:0,max:1,step:.01},{key:'background',label:'Background',min:0,max:1,step:.01},{key:'text',label:'Subtitle',min:.5,max:1.5,step:.01}] as const;
 const theme=dialogTheme(tones,name,edge.background,edge.text);
 const transcript=recordingTranscript(elapsed,duration);
 const copy=useRef<HTMLDivElement>(null),measure=useRef<HTMLParagraphElement>(null);
 const [copyHeight,setCopyHeight]=useState(0);
 useEffect(()=>{
  const text=measure.current,scroller=copy.current;
  if(!text||!scroller)return;
  const update=()=>{setCopyHeight(transcript.count?Math.min(80,text.scrollHeight):0);scroller.scrollTop=scroller.scrollHeight;};
  update();const observer=new ResizeObserver(update);observer.observe(text);return()=>observer.disconnect();
 },[transcript.count]);
 const expanded=transcript.count>0;
 const borderTones=name==='Porcelain'?['#D9E9FC','#ADD0FC','#78B4EE','#C2DEFF']:tones;
 const canvas=useRef<HTMLCanvasElement>(null),live=useRef({tones:borderTones,features,audioResponse,mono,expanded,theme,edge});
 live.current={tones:borderTones,features,audioResponse,mono,expanded,theme,edge};
 useEffect(()=>{
  const el=canvas.current!,ctx=el.getContext('2d')!;let frame=0,last=0,phase=0;
  const route=document.createElementNS('http://www.w3.org/2000/svg','path');let geometry='';
  const wash=document.createElement('canvas'),paint=wash.getContext('2d')!;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function draw(now:number){
   const dt=last?Math.min((now-last)/1000,.05):0;last=now;
   const {tones,features:f,audioResponse,mono,theme,edge}=live.current;
   const w=el.clientWidth,h=el.clientHeight,dpr=Math.min(devicePixelRatio,2);
   if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   // Integrate velocity: audio never alters position directly, width or opacity.
   const velocity=6+680*voiceDrive(f)*audioResponse;
   if(!reduced.matches)phase+=dt*velocity;
   const inset=1.5,r=18.5,x=inset,y=inset,right=w-inset,bottom=h-inset;
   const d=`M ${x+r} ${y} H ${right-r} A ${r} ${r} 0 0 1 ${right} ${y+r} V ${bottom-r} A ${r} ${r} 0 0 1 ${right-r} ${bottom} H ${x+r} A ${r} ${r} 0 0 1 ${x} ${bottom-r} V ${y+r} A ${r} ${r} 0 0 1 ${x+r} ${y} Z`;
   if(geometry!==d){route.setAttribute('d',d);geometry=d;}
   const length=route.getTotalLength();
   // A closed color field: no travelling head, tail, dash or hard outline.
   if(wash.width!==el.width||wash.height!==el.height){wash.width=el.width;wash.height=el.height;}
   paint.setTransform(dpr,0,0,dpr,0,0);paint.clearRect(0,0,w,h);
   const colors=tones.map(c=>c.match(/\w\w/g)!.map(v=>parseInt(v,16)));
   const steps=220;
   for(let i=0;i<steps;i++){
    const u=i/steps,angle=(u-phase/length)*Math.PI*2;
    // Overlapping periodic lobes blend across the wrap point without a seam.
    const weights=colors.map((_,j)=>Math.exp((6-5.3*edge.blend)*Math.cos(angle-j*Math.PI/2)));
    const total=weights.reduce((a,b)=>a+b,0);
    const rgb=[0,1,2].map(k=>Math.round(colors.reduce((sum,c,j)=>sum+c[k]*weights[j],0)/total));
    const p=route.getPointAtLength(u*length),q=route.getPointAtLength((i+1)/steps*length);
    paint.globalAlpha=mono?.38+.16*Math.cos(angle):.85;
    paint.strokeStyle=mono?theme.beam:`rgb(${rgb.join(',')})`;
    paint.lineWidth=8*edge.width;paint.lineCap='round';
    paint.beginPath();paint.moveTo(p.x,p.y);paint.lineTo(q.x,q.y);paint.stroke();
   }
   // Feather inward, while preserving the outer rounded silhouette.
   ctx.save();const clip=new Path2D();clip.roundRect(0,0,w,h,20);ctx.clip(clip);
   ctx.filter=`blur(${.5+3.5*edge.glow}px)`;ctx.globalAlpha=Math.min(1,edge.intensity);ctx.drawImage(wash,0,0,w,h);if(edge.intensity>1){ctx.globalAlpha=edge.intensity-1;ctx.drawImage(wash,0,0,w,h);}ctx.restore();
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
 },[]);
 return <section className="dialog-test" aria-label="Conversation preview">
  <div className="dialog-test-heading"><h2>Conversation</h2><div className="border-modes" role="group" aria-label="Border style"><button aria-pressed={!mono} onClick={()=>setMono(false)}>Gradient</button><button aria-pressed={mono} onClick={()=>setMono(true)}>Mono</button></div></div>
  <div className="dialog-expansion-stage">
  <div className={`voice-dialog ${expanded?'expanded':'collapsed'}`} style={{'--dialog-tint':theme.surface,'--dialog-past':theme.past,'--dialog-text':theme.text,'--dialog-shadow':theme.shadow,height:expanded?76+copyHeight:60} as CSSProperties} data-voice-pulse={features.pulse.toFixed(3)}>
   <div ref={copy} className="dialog-copy" role="log" aria-label="Synchronized transcript" aria-live="off" style={{height:copyHeight}}><p ref={measure}><span>{transcript.past}{transcript.past?' ':''}</span><strong>{transcript.current}</strong></p></div>
   <div className="dialog-toolbar" role="toolbar" aria-label="Conversation tools">
    <div className="dialog-tools">{icons.map(([label,asset],i)=><span className="dialog-tool-group" key={label}><button title={label} aria-label={label} aria-pressed={tool===label} onClick={()=>setTool(label)} className={tool===label?'selected':''}><img src={'/dialog-assets/'+(!expanded&&label==='Shapes'?'613dc.svg':asset)} alt="" className={label==='Select'?'select-icon':''}/></button>{i<3&&<img className="dialog-chevron" src="/dialog-assets/f13f8.svg" alt=""/>}</span>)}</div>
    <span className="dialog-divider"><img src="/dialog-assets/d5db6.svg" alt=""/></span>
    <button className="dialog-orb-button" title={playing?'Stop sound':'Play sound'} aria-label={playing?'Stop conversation sound':'Play conversation sound'} disabled={loading} onClick={onPlay}>{orb}</button>
   </div>
   <canvas ref={canvas} className="dialog-border" aria-hidden="true"/>
  </div>
  </div>
  <div className="edge-controls control-grid" role="group" aria-label="Conversation appearance">
   {edgeControls.map(({key,label,min,max,step})=><StudySlider key={key} label={label} ariaLabel={`Border ${label}`} min={min} max={max} step={step} value={edge[key]} text={`${Math.round(edge[key]*100)}%`} onChange={value=>setEdge(previous=>({...previous,[key]:value}))}/>)}
  </div>
 </section>;
}
