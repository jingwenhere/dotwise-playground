"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, RotateCcw, Shuffle, SlidersHorizontal, X } from "lucide-react";

type MotionOp="origin"|"divide"|"portal"|"orbit"|"eclipse"|"transfer"|"invert"|"chain"|"collapse";
type Interaction="scrub"|"distort"|"trigger";
type Shape={x:number;y:number;rx:number;ry:number;rotation:number};
type Scene={positive:Shape[];negative:Shape[]};
type MotionSettings={scale:number;spread:number;aspect:number;voidScale:number;viscosity:number;duration:number;hold:number;distortion:number;colorA:string;colorB:string;gradientAngle:number;interaction:Interaction};

const opOptions:{id:MotionOp;label:string}[]=[
  {id:"origin",label:"Origin"},{id:"divide",label:"Divide"},{id:"portal",label:"Portal"},{id:"orbit",label:"Orbit"},{id:"eclipse",label:"Eclipse"},{id:"transfer",label:"Transfer"},{id:"invert",label:"Invert"},{id:"chain",label:"Chain"},{id:"collapse",label:"Collapse"},
];
const defaults:MotionSettings={scale:1,spread:1,aspect:1,voidScale:1,viscosity:.46,duration:7.5,hold:.12,distortion:.42,colorA:"#111214",colorB:"#ff5b7f",gradientAngle:18,interaction:"scrub"};
const initialSequence:MotionOp[]=["origin","divide","portal","eclipse","transfer","collapse"];
const blank=():Shape=>({x:500,y:350,rx:0,ry:0,rotation:0});
const slots=(count=4)=>Array.from({length:count},blank);

function sceneFor(operation:MotionOp,phase:number):Scene{
  const positive=slots(),negative=slots();
  if(operation==="origin"||operation==="collapse")positive[0]={x:500,y:350,rx:92,ry:92,rotation:0};
  if(operation==="divide"){
    positive[0]={x:390,y:350,rx:67,ry:67,rotation:0};positive[1]={x:560,y:260,rx:59,ry:59,rotation:0};positive[2]={x:570,y:440,rx:63,ry:63,rotation:0};
  }
  if(operation==="portal"){
    positive[0]={x:500,y:350,rx:152,ry:146,rotation:0};negative[0]={x:500,y:350,rx:66,ry:54,rotation:-24};
  }
  if(operation==="orbit"){
    const angle=phase*Math.PI*2-.65;positive[0]={x:500,y:350,rx:150,ry:145,rotation:0};negative[0]={x:500+Math.cos(angle)*62,y:350+Math.sin(angle)*48,rx:58,ry:46,rotation:angle*180/Math.PI+18};
  }
  if(operation==="eclipse"){
    positive[0]={x:500,y:350,rx:151,ry:145,rotation:0};negative[0]={x:552,y:345,rx:91,ry:62,rotation:32};
  }
  if(operation==="transfer"){
    const travel=.5-.5*Math.cos(phase*Math.PI);positive[0]={x:380,y:350,rx:92,ry:92,rotation:0};positive[1]={x:620,y:350,rx:92,ry:92,rotation:0};negative[0]={x:380+travel*240,y:350-Math.sin(phase*Math.PI)*55,rx:46,ry:38,rotation:phase*160-40};
  }
  if(operation==="invert"){
    positive[0]={x:500,y:350,rx:158,ry:151,rotation:0};positive[1]={x:500,y:350,rx:48,ry:48,rotation:0};negative[0]={x:450,y:350,rx:72,ry:72,rotation:0};negative[1]={x:550,y:350,rx:72,ry:72,rotation:0};
  }
  if(operation==="chain"){
    [350,450,550,650].forEach((x,index)=>positive[index]={x,y:350+Math.sin(index*Math.PI)*28,rx:58,ry:index%2?48:58,rotation:index%2?28:-18});negative[0]={x:450,y:350,rx:24,ry:24,rotation:0};negative[1]={x:550,y:350,rx:24,ry:24,rotation:0};
  }
  return{positive,negative};
}

const clamp=(value:number,min=0,max=1)=>Math.min(max,Math.max(min,value));
const ease=(value:number)=>value*value*(3-2*value);
const interpolateShape=(a:Shape,b:Shape,t:number):Shape=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,rx:a.rx+(b.rx-a.rx)*t,ry:a.ry+(b.ry-a.ry)*t,rotation:a.rotation+(b.rotation-a.rotation)*t});

function Control({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void}){
  const width=(value-min)/(max-min)*100,shown=step<.1?value.toFixed(2):step<1?value.toFixed(1):Math.round(value).toString();
  return <div className="motion-control"><i style={{width:`${width}%`}}/><span>{label}</span><input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Number(event.target.value))}/><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={shown} onChange={event=>{const next=Number(event.target.value);if(Number.isFinite(next))onChange(Math.max(min,Math.min(max,next)))}}/></div>;
}

function Segmented<T extends string>({items,value,onChange}:{items:{id:T;label:string}[];value:T;onChange:(value:T)=>void}){return <div className="motion-segmented">{items.map(item=><button type="button" key={item.id} data-active={value===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>)}</div>}

export function DotwiseMotionComposer(){
  const svgRef=useRef<SVGSVGElement>(null),positiveRefs=useRef<(SVGEllipseElement|null)[]>([]),negativeRefs=useRef<(SVGEllipseElement|null)[]>([]),positiveBlurRef=useRef<SVGFEGaussianBlurElement>(null),negativeBlurRef=useRef<SVGFEGaussianBlurElement>(null),timelineRef=useRef<HTMLDivElement>(null),stageLabelRef=useRef<HTMLSpanElement>(null);
  const settingsRef=useRef(defaults),sequenceRef=useRef(initialSequence),playingRef=useRef(true),progressRef=useRef(0),targetProgressRef=useRef(0),scrubUntilRef=useRef(0),pointerRef=useRef({x:500,y:350,active:false,velocity:0,lastX:500,lastY:350});
  const [settings,setSettingsState]=useState(defaults),[sequence,setSequenceState]=useState<MotionOp[]>(initialSequence),[playing,setPlayingState]=useState(true),[panel,setPanel]=useState(true);
  const set=useCallback(<K extends keyof MotionSettings>(key:K,value:MotionSettings[K])=>setSettingsState(previous=>{const next={...previous,[key]:value};settingsRef.current=next;return next}),[]);
  const setSequence=(next:MotionOp[])=>{sequenceRef.current=next;setSequenceState(next)};
  const setPlaying=(next:boolean)=>{playingRef.current=next;setPlayingState(next)};
  const seek=(value:number)=>{progressRef.current=clamp(value);targetProgressRef.current=clamp(value);scrubUntilRef.current=performance.now()+900};
  const remix=()=>{const middle=opOptions.filter(item=>!(["origin","collapse"] as MotionOp[]).includes(item.id)),count=Math.max(3,sequence.length-2),next:MotionOp[]=["origin"];for(let index=0;index<count;index++)next.push(middle[Math.floor(Math.random()*middle.length)].id);next.push("collapse");setSequence(next.slice(0,7));seek(0)};
  const reset=()=>{settingsRef.current={...defaults};sequenceRef.current=[...initialSequence];setSettingsState({...defaults});setSequenceState([...initialSequence]);seek(0);setPlaying(true)};
  const download=(name:string,blob:Blob)=>{const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const exportJSON=()=>download("dotwise-motion-system.json",new Blob([JSON.stringify({version:9,system:"positive-negative-motion",sequence,settings},null,2)],{type:"application/json"}));
  const exportSVG=()=>{const svg=svgRef.current;if(!svg)return;const copy=svg.cloneNode(true) as SVGSVGElement;copy.setAttribute("xmlns","http://www.w3.org/2000/svg");download("dotwise-motion-frame.svg",new Blob([new XMLSerializer().serializeToString(copy)],{type:"image/svg+xml"}))};

  useEffect(()=>{
    let frame=0,last=performance.now();const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduced)setPlaying(false);
    const render=(now:number)=>{const delta=Math.min(.05,(now-last)/1000);last=now;const s=settingsRef.current,seq=sequenceRef.current,manual=now<scrubUntilRef.current;
      if(playingRef.current&&!manual&&!reduced)progressRef.current=(progressRef.current+delta/Math.max(1,s.duration))%1;else progressRef.current+=(targetProgressRef.current-progressRef.current)*.16;
      const count=Math.max(2,seq.length),scaled=progressRef.current*(count-1),index=Math.min(count-2,Math.floor(scaled)),raw=scaled-index,hold=Math.min(.42,s.hold),transition=clamp((raw-hold)/(1-hold*2)),t=ease(transition),from=sceneFor(seq[index]??"origin",progressRef.current),to=sceneFor(seq[index+1]??"collapse",progressRef.current),fluid=Math.sin(Math.PI*transition)*s.viscosity,blur=fluid*10;
      positiveBlurRef.current?.setAttribute("stdDeviation",blur.toFixed(2));negativeBlurRef.current?.setAttribute("stdDeviation",(blur*.86).toFixed(2));
      const pointer=pointerRef.current,distort=(shape:Shape)=>{if(s.interaction!=="distort"||!pointer.active||shape.rx<1)return shape;const dx=shape.x-pointer.x,dy=shape.y-pointer.y,d=Math.hypot(dx,dy)||1,influence=Math.max(0,1-d/260)*s.distortion,velocity=Math.min(1,pointer.velocity/30);return{...shape,x:shape.x-dx/d*influence*(24+velocity*38),y:shape.y-dy/d*influence*(24+velocity*38),rx:shape.rx*(1+influence*velocity*.28),ry:shape.ry*(1-influence*velocity*.12)}};
      const update=(elements:(SVGEllipseElement|null)[],a:Shape[],b:Shape[],negative=false)=>elements.forEach((element,shapeIndex)=>{if(!element)return;let shape=distort(interpolateShape(a[shapeIndex]??blank(),b[shapeIndex]??blank(),t)),x=500+(shape.x-500)*s.spread,y=350+(shape.y-350)*s.spread,rx=shape.rx*s.scale*s.aspect,ry=shape.ry*s.scale;if(negative){rx*=s.voidScale;ry*=s.voidScale}element.setAttribute("cx",x.toFixed(2));element.setAttribute("cy",y.toFixed(2));element.setAttribute("rx",Math.max(0,rx).toFixed(2));element.setAttribute("ry",Math.max(0,ry).toFixed(2));element.setAttribute("transform",`rotate(${shape.rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);element.style.opacity=rx>.35&&ry>.35?"1":"0"});
      update(positiveRefs.current,from.positive,to.positive);update(negativeRefs.current,from.negative,to.negative,true);
      timelineRef.current?.style.setProperty("--motion-progress",`${progressRef.current*100}%`);if(stageLabelRef.current)stageLabelRef.current.textContent=`${seq[index]??"Origin"} → ${seq[index+1]??"Collapse"}`;
      frame=requestAnimationFrame(render)};frame=requestAnimationFrame(render);return()=>cancelAnimationFrame(frame);
  },[]);

  const pointerPosition=(event:React.PointerEvent)=>{const rect=event.currentTarget.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width*1000,y:(event.clientY-rect.top)/rect.height*700}};
  const onPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{const p=pointerPosition(event),pointer=pointerRef.current;pointer.velocity=pointer.velocity*.5+Math.hypot(p.x-pointer.lastX,p.y-pointer.lastY)*.5;pointer.lastX=p.x;pointer.lastY=p.y;pointer.x=p.x;pointer.y=p.y;pointer.active=true;if(settingsRef.current.interaction==="scrub"){const rect=event.currentTarget.getBoundingClientRect();targetProgressRef.current=clamp((event.clientX-rect.left)/rect.width);scrubUntilRef.current=performance.now()+600}};
  const onPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{if(settingsRef.current.interaction==="trigger"){const seq=sequenceRef.current,current=Math.round(progressRef.current*(seq.length-1)),next=(current+1)%(seq.length-1);seek(next/(seq.length-1))}event.currentTarget.setPointerCapture(event.pointerId)};

  const angle=settings.gradientAngle*Math.PI/180,x=Math.cos(angle)*50,y=Math.sin(angle)*50;
  return <main id="main" className="motion-shell"><div className="motion-stage" onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerLeave={()=>{pointerRef.current.active=false;pointerRef.current.velocity=0}}>
    <svg ref={svgRef} className="motion-svg" viewBox="0 0 1000 700" role="img" aria-label="Dotwise positive and negative motion composition">
      <defs><linearGradient id="motion-color" x1={`${50-x}%`} y1={`${50-y}%`} x2={`${50+x}%`} y2={`${50+y}%`}><stop offset="0" stopColor={settings.colorA}/><stop offset="1" stopColor={settings.colorB}/></linearGradient>
        <filter id="motion-positive-goo" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB"><feGaussianBlur ref={positiveBlurRef} stdDeviation="0" result="blur"/><feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"/></filter>
        <filter id="motion-negative-goo" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB"><feGaussianBlur ref={negativeBlurRef} stdDeviation="0" result="blur"/><feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"/></filter>
        <mask id="motion-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="700"><rect width="1000" height="700" fill="#000"/><g filter="url(#motion-positive-goo)">{slots().map((_,index)=><ellipse key={`p-${index}`} ref={element=>{positiveRefs.current[index]=element}} fill="#fff"/>)}</g><g filter="url(#motion-negative-goo)">{slots().map((_,index)=><ellipse key={`n-${index}`} ref={element=>{negativeRefs.current[index]=element}} fill="#000"/>)}</g></mask>
      </defs><rect width="1000" height="700" fill="url(#motion-color)" mask="url(#motion-mask)"/>
    </svg></div>
    <header className="motion-brand"><span>{Array.from({length:9},(_,index)=><i key={index}/>)}</span>dotwise</header>
    <div className="motion-timeline" ref={timelineRef}><div className="motion-timeline-meta"><span ref={stageLabelRef}>Origin → Divide</span><button type="button" onClick={()=>setPlaying(!playing)}>{playing?<><Pause size={12}/>Pause</>:<><Play size={12}/>Play</>}</button></div><div className="motion-track" onPointerDown={event=>{const rect=event.currentTarget.getBoundingClientRect();seek((event.clientX-rect.left)/rect.width)}}><i/>{sequence.map((operation,index)=><button type="button" key={`${operation}-${index}`} style={{left:`${index/(sequence.length-1)*100}%`}} aria-label={`Seek to ${operation}`} onClick={event=>{event.stopPropagation();seek(index/(sequence.length-1))}}><b/><span>{operation}</span></button>)}</div></div>
    {panel?<aside className="motion-panel"><div className="motion-panel-header"><div><h1>Dotwise Motion</h1><p>Positive / negative identity system · V9</p></div><div><button type="button" aria-label="Reset" onClick={reset}><RotateCcw size={16}/></button><button type="button" aria-label="Hide controls" onClick={()=>setPanel(false)}><SlidersHorizontal size={17}/></button></div></div>
      <section><header><span>Composition</span><em>01</em></header><Control label="Logo scale" value={settings.scale} min={.45} max={1.7} step={.01} onChange={value=>set("scale",value)}/><Control label="Dot spacing" value={settings.spread} min={.35} max={1.8} step={.01} onChange={value=>set("spread",value)}/><Control label="Dot aspect" value={settings.aspect} min={.45} max={2.1} step={.01} onChange={value=>set("aspect",value)}/><Control label="Negative scale" value={settings.voidScale} min={.25} max={1.6} step={.01} onChange={value=>set("voidScale",value)}/></section>
      <section><header><span>Motion sequence</span><em>02</em></header><div className="motion-sequence-actions"><button type="button" onClick={remix}><Shuffle size={13}/>Remix</button><button type="button" disabled={sequence.length>=7} onClick={()=>setSequence([...sequence.slice(0,-1),"orbit",sequence.at(-1)??"collapse"])}><Plus size={13}/>Add step</button></div><div className="motion-sequence-list">{sequence.map((operation,index)=><div key={`${index}-${operation}`}><span>{String(index+1).padStart(2,"0")}</span><select aria-label={`Motion step ${index+1}`} value={operation} onChange={event=>{const next=[...sequence];next[index]=event.target.value as MotionOp;setSequence(next)}}>{opOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select><button type="button" aria-label={`Remove step ${index+1}`} disabled={sequence.length<=3} onClick={()=>setSequence(sequence.filter((_,itemIndex)=>itemIndex!==index))}><X size={12}/></button></div>)}</div></section>
      <section><header><span>Transition material</span><em>03</em></header><p className="motion-note">Viscosity appears only between states. Every key state remains clean Boolean geometry.</p><Control label="Viscosity" value={settings.viscosity} min={0} max={1} step={.01} onChange={value=>set("viscosity",value)}/><Control label="Keyframe hold" value={settings.hold} min={0} max={.34} step={.01} onChange={value=>set("hold",value)}/><Control label="Loop duration" value={settings.duration} min={2.5} max={18} step={.1} onChange={value=>set("duration",value)}/></section>
      <section><header><span>Interaction mapping</span><em>04</em></header><Segmented items={[{id:"scrub",label:"Scrub"},{id:"distort",label:"Distort"},{id:"trigger",label:"Trigger"}]} value={settings.interaction} onChange={value=>set("interaction",value)}/><p className="motion-note">{settings.interaction==="scrub"?"Move horizontally to control the motion timeline.":settings.interaction==="distort"?"Move near the logo to bend the active positive and negative shapes.":"Click the canvas to advance to the next motion state."}</p>{settings.interaction==="distort"&&<Control label="Distortion force" value={settings.distortion} min={0} max={1} step={.01} onChange={value=>set("distortion",value)}/>}</section>
      <section><header><span>Color system</span><em>05</em></header><div className="motion-colors"><label><span>Primary</span><input aria-label="Primary color" type="color" value={settings.colorA} onChange={event=>set("colorA",event.target.value)}/></label><label><span>Secondary</span><input aria-label="Secondary color" type="color" value={settings.colorB} onChange={event=>set("colorB",event.target.value)}/></label></div><Control label="Gradient angle" value={settings.gradientAngle} min={0} max={360} step={1} onChange={value=>set("gradientAngle",value)}/></section>
      <section><header><span>Export</span><em>06</em></header><div className="motion-export"><button type="button" onClick={exportSVG}>SVG frame</button><button type="button" onClick={exportJSON}>Motion JSON</button></div></section>
    </aside>:<button type="button" className="motion-show" aria-label="Show controls" onClick={()=>setPanel(true)}><SlidersHorizontal size={18}/></button>}
  </main>;
}
