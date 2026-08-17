"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleStop, Play, Radio, RotateCcw, SlidersHorizontal, Video } from "lucide-react";

type Arrangement="single"|"pair"|"triad"|"orbit";
type Settings={arrangement:Arrangement;size:number;spacing:number;aspect:number;cursorSize:number;softness:number;trail:number;memory:number;pull:number;holdGrowth:number;colorA:string;colorB:string;colorAngle:number};
type TrailPoint={x:number;y:number;born:number;speed:number;angle:number};
type Pin={x:number;y:number;r:number;life:number;target:number};
type RecordedPoint={t:number;x:number;y:number;down:boolean};

const defaults:Settings={arrangement:"single",size:126,spacing:150,aspect:1,cursorSize:48,softness:28,trail:.58,memory:1.25,pull:.64,holdGrowth:.75,colorA:"#111214",colorB:"#ff5b7f",colorAngle:24};
const MAX_POS=8,MAX_NEG=32;
const vertex=`#version 300 es
in vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
#define MAX_POS 8
#define MAX_NEG 32
uniform vec2 u_resolution;
uniform int u_posCount;
uniform int u_negCount;
uniform vec4 u_positive[MAX_POS];
uniform vec4 u_negative[MAX_NEG];
uniform float u_negAngle[MAX_NEG];
uniform float u_softness;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_colorAngle;
uniform float u_inverted;
uniform vec4 u_pointer;
out vec4 outColor;
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/max(k,.001);return min(a,b)-h*h*k*.25;}
float smax(float a,float b,float k){return-smin(-a,-b,k);}
float ellipse(vec2 p,vec4 shape,float angle){float c=cos(angle),s=sin(angle);p-=shape.xy;p=mat2(c,s,-s,c)*p;vec2 radius=max(shape.zw,vec2(.001));float d=length(p/radius)-1.;return d*min(radius.x,radius.y);}
void main(){
  vec2 p=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y);float positive=1e5,negative=1e5;
  for(int i=0;i<MAX_POS;i++){if(i>=u_posCount)break;positive=smin(positive,ellipse(p,u_positive[i],0.),u_softness);}
  for(int i=0;i<MAX_NEG;i++){if(i>=u_negCount)break;negative=smin(negative,ellipse(p,u_negative[i],u_negAngle[i]),u_softness*.7);}
  float field=negative<9e4?smax(positive,-negative,u_softness*.52):positive;float aa=max(1.,fwidth(field)*1.2),mask=1.-smoothstep(-aa,aa,field);
  vec2 direction=vec2(cos(u_colorAngle),sin(u_colorAngle));float colorT=clamp(.5+dot(p-u_resolution*.5,direction)/max(u_resolution.x,u_resolution.y)*.72,0.,1.);vec3 ink=mix(u_colorA,u_colorB,colorT);
  vec3 normal=mix(vec3(1.),ink,mask),inverse=mix(ink,vec3(1.),mask),color=mix(normal,inverse,u_inverted);
  if(u_pointer.w>.5){float ring=1.-smoothstep(.7,1.9,abs(length(p-u_pointer.xy)-u_pointer.z));vec3 ringColor=mix(vec3(.12),vec3(.92),u_inverted);color=mix(color,ringColor,ring*.32);}
  outColor=vec4(color,1.);
}`;

function compileProgram(gl:WebGL2RenderingContext){const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)??"Shader error");return shader};const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??"Program error");return program}
function hexRgb(hex:string){const value=hex.slice(1);return[parseInt(value.slice(0,2),16)/255,parseInt(value.slice(2,4),16)/255,parseInt(value.slice(4,6),16)/255]}

function Control({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void}){const width=(value-min)/(max-min)*100,shown=step<.1?value.toFixed(2):step<1?value.toFixed(1):Math.round(value).toString();return <div className="instrument-control"><i style={{width:`${width}%`}}/><span>{label}</span><input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Number(event.target.value))}/><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={shown} onChange={event=>{const next=Number(event.target.value);if(Number.isFinite(next))onChange(Math.max(min,Math.min(max,next)))}}/></div>}
function Segmented<T extends string>({items,value,onChange}:{items:{id:T;label:string}[];value:T;onChange:(value:T)=>void}){return <div className="instrument-segmented">{items.map(item=><button type="button" key={item.id} data-active={value===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>)}</div>}

export function DotwiseNegativeInstrument(){
  const canvasRef=useRef<HTMLCanvasElement>(null),settingsRef=useRef(defaults),pinsRef=useRef<Pin[]>([]),trailRef=useRef<TrailPoint[]>([]),recordedRef=useRef<RecordedPoint[]>([]),captureRef=useRef({active:false,start:0,last:0}),loopRef=useRef({active:false,start:0,duration:1}),recorderRef=useRef<MediaRecorder|null>(null);
  const [settings,setSettingsState]=useState(defaults),[panel,setPanel]=useState(true),[capturing,setCapturing]=useState(false),[looping,setLooping]=useState(false),[inverted,setInverted]=useState(false),[videoRecording,setVideoRecording]=useState(false);
  const invertedRef=useRef(false);
  const set=useCallback(<K extends keyof Settings>(key:K,value:Settings[K])=>setSettingsState(previous=>{const next={...previous,[key]:value};settingsRef.current=next;return next}),[]);
  const download=(name:string,blob:Blob)=>{const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const reset=()=>{settingsRef.current={...defaults};pinsRef.current=[];trailRef.current=[];recordedRef.current=[];captureRef.current.active=false;loopRef.current.active=false;invertedRef.current=false;setSettingsState({...defaults});setCapturing(false);setLooping(false);setInverted(false)};
  const toggleCapture=()=>{if(captureRef.current.active){captureRef.current.active=false;const points=recordedRef.current;if(points.length>1)loopRef.current.duration=Math.max(350,points.at(-1)!.t);setCapturing(false)}else{recordedRef.current=[];captureRef.current={active:true,start:performance.now(),last:0};loopRef.current.active=false;setLooping(false);setCapturing(true)}};
  const toggleLoop=()=>{if(recordedRef.current.length<2)return;loopRef.current.active=!loopRef.current.active;loopRef.current.start=performance.now();setLooping(loopRef.current.active)};
  const release=()=>{loopRef.current.active=false;setLooping(false);pinsRef.current.forEach(pin=>pin.target=0);trailRef.current=[]};
  const exportPNG=()=>canvasRef.current?.toBlob(blob=>blob&&download("dotwise-negative-motion.png",blob),"image/png");
  const exportJSON=()=>download("dotwise-negative-motion.json",new Blob([JSON.stringify({version:10,system:"negative-cursor-instrument",settings,pins:pinsRef.current,gesture:recordedRef.current},null,2)],{type:"application/json"}));
  const toggleVideo=()=>{if(videoRecording){recorderRef.current?.stop();return}const canvas=canvasRef.current,mime=["video/mp4;codecs=avc1.42E01E","video/mp4"].find(type=>MediaRecorder.isTypeSupported(type));if(!canvas||!mime)return;const stream=canvas.captureStream(60),chunks:BlobPart[]=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000});recorderRef.current=recorder;recorder.ondataavailable=event=>event.data.size&&chunks.push(event.data);recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());download("dotwise-negative-motion.mp4",new Blob(chunks,{type:mime}));recorderRef.current=null;setVideoRecording(false)};recorder.start();setVideoRecording(true)};

  useEffect(()=>{
    const canvas=canvasRef.current!,gl=canvas.getContext("webgl2",{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)return;const program=compileProgram(gl);gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attribute=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    const uniform=(name:string)=>gl.getUniformLocation(program,name),uResolution=uniform("u_resolution"),uPosCount=uniform("u_posCount"),uNegCount=uniform("u_negCount"),uPositive=uniform("u_positive"),uNegative=uniform("u_negative"),uNegAngle=uniform("u_negAngle"),uSoftness=uniform("u_softness"),uColorA=uniform("u_colorA"),uColorB=uniform("u_colorB"),uColorAngle=uniform("u_colorAngle"),uInverted=uniform("u_inverted"),uPointer=uniform("u_pointer");
    let width=0,height=0,dpr=1,frame=0,lastTrailAt=0;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches,pointer={x:-999,y:-999,lastX:-999,lastY:-999,active:false,down:false,downAt:0,downX:0,downY:0,speed:0,angle:0};
    const resize=()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);gl.viewport(0,0,canvas.width,canvas.height)};
    const center=()=>({x:width<760?width*.5:width*.39,y:height*.49});
    const bases=()=>{const s=settingsRef.current,c=center(),gap=s.spacing,result:{x:number;y:number;rx:number;ry:number}[]=[];if(s.arrangement==="single")result.push({x:c.x,y:c.y,rx:s.size*s.aspect,ry:s.size});if(s.arrangement==="pair")result.push({x:c.x-gap*.48,y:c.y,rx:s.size*.78*s.aspect,ry:s.size*.78},{x:c.x+gap*.48,y:c.y,rx:s.size*.78*s.aspect,ry:s.size*.78});if(s.arrangement==="triad")[-Math.PI/2,Math.PI/6,Math.PI*5/6].forEach(angle=>result.push({x:c.x+Math.cos(angle)*gap*.62,y:c.y+Math.sin(angle)*gap*.62,rx:s.size*.58*s.aspect,ry:s.size*.58}));if(s.arrangement==="orbit")[0,1,2,3].forEach(index=>{const angle=index*Math.PI/2;result.push({x:c.x+Math.cos(angle)*gap*.62,y:c.y+Math.sin(angle)*gap*.62,rx:s.size*.46*s.aspect,ry:s.size*.46})});return result};
    const signedDistance=(x:number,y:number,shape:{x:number;y:number;rx:number;ry:number})=>(Math.hypot((x-shape.x)/shape.rx,(y-shape.y)/shape.ry)-1)*Math.min(shape.rx,shape.ry);
    const insideLogo=(x:number,y:number)=>bases().some(shape=>signedDistance(x,y,shape)<0);
    const addTrail=(now:number)=>{const s=settingsRef.current;if(!pointer.active||s.trail<=.01||now-lastTrailAt<18)return;const distance=Math.hypot(pointer.x-pointer.lastX,pointer.y-pointer.lastY);if(distance<2)return;trailRef.current.push({x:pointer.x,y:pointer.y,born:now,speed:pointer.speed,angle:pointer.angle});if(trailRef.current.length>26)trailRef.current.shift();lastTrailAt=now};
    const position=(event:PointerEvent)=>{const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}};
    const move=(event:PointerEvent)=>{const p=position(event),dx=pointer.lastX<-100?0:p.x-pointer.x,dy=pointer.lastY<-100?0:p.y-pointer.y;pointer.lastX=pointer.x;pointer.lastY=pointer.y;pointer.x=p.x;pointer.y=p.y;pointer.angle=Math.atan2(dy,dx);pointer.speed=pointer.speed*.58+Math.hypot(dx,dy)*.42;pointer.active=true};
    const down=(event:PointerEvent)=>{move(event);pointer.down=true;pointer.downAt=performance.now();pointer.downX=pointer.x;pointer.downY=pointer.y;canvas.setPointerCapture(event.pointerId)};
    const up=(event:PointerEvent)=>{const moved=Math.hypot(pointer.x-pointer.downX,pointer.y-pointer.downY);if(moved<8&&insideLogo(pointer.x,pointer.y)){const pins=pinsRef.current,nearest=pins.findIndex(pin=>Math.hypot(pin.x-pointer.x,pin.y-pointer.y)<pin.r*.8);if(nearest>=0)pins[nearest].target=0;else pins.push({x:pointer.x,y:pointer.y,r:settingsRef.current.cursorSize,life:0,target:1})}pointer.down=false;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)};
    const leave=()=>{if(!pointer.down&&!loopRef.current.active){pointer.active=false;pointer.speed=0}};
    const doubleClick=()=>{invertedRef.current=!invertedRef.current;setInverted(invertedRef.current)};
    const render=(now:number)=>{const s=settingsRef.current;
      if(loopRef.current.active&&recordedRef.current.length>1){const points=recordedRef.current,t=(now-loopRef.current.start)%loopRef.current.duration;let index=0;while(index<points.length-2&&points[index+1].t<t)index++;const a=points[index],b=points[index+1],mix=(t-a.t)/Math.max(1,b.t-a.t),nx=a.x+(b.x-a.x)*mix,ny=a.y+(b.y-a.y)*mix,dx=nx-pointer.x,dy=ny-pointer.y;pointer.lastX=pointer.x;pointer.lastY=pointer.y;pointer.x=nx;pointer.y=ny;pointer.down=a.down;pointer.active=true;pointer.angle=Math.atan2(dy,dx);pointer.speed=pointer.speed*.55+Math.hypot(dx,dy)*.45}
      if(captureRef.current.active&&pointer.active&&now-captureRef.current.last>16){recordedRef.current.push({t:now-captureRef.current.start,x:pointer.x,y:pointer.y,down:pointer.down});captureRef.current.last=now;if(now-captureRef.current.start>6000){captureRef.current.active=false;loopRef.current.duration=recordedRef.current.at(-1)?.t??1000;setCapturing(false)}}
      if(!reduced)addTrail(now);const base=bases(),positiveData=new Float32Array(MAX_POS*4),negativeData=new Float32Array(MAX_NEG*4),angleData=new Float32Array(MAX_NEG);let posCount=base.length,negCount=0;
      base.forEach((shape,index)=>positiveData.set([shape.x*dpr,shape.y*dpr,shape.rx*dpr,shape.ry*dpr],index*4));
      if(pointer.active){let nearest=base[0],best=Infinity;for(const shape of base){const d=signedDistance(pointer.x,pointer.y,shape);if(Math.abs(d)<Math.abs(best)){best=d;nearest=shape}}if(best>0&&best<240&&posCount<MAX_POS){const dx=pointer.x-nearest.x,dy=pointer.y-nearest.y,d=Math.hypot(dx,dy)||1,influence=(1-best/240)**2*s.pull,edgeX=nearest.x+dx/d*nearest.rx,edgeY=nearest.y+dy/d*nearest.ry,lobe=s.size*(.12+influence*.36)*(pointer.down?1.18:1);positiveData.set([edgeX*dpr,edgeY*dpr,lobe*dpr,lobe*dpr],posCount++*4)}}
      const addNegative=(x:number,y:number,rx:number,ry:number,angle=0)=>{if(negCount>=MAX_NEG||rx<.5||ry<.5)return;negativeData.set([x*dpr,y*dpr,rx*dpr,ry*dpr],negCount*4);angleData[negCount]=angle;negCount++};
      pinsRef.current.forEach(pin=>{pin.life+=(pin.target-pin.life)*.12;addNegative(pin.x,pin.y,pin.r*pin.life,pin.r*pin.life)});pinsRef.current=pinsRef.current.filter(pin=>pin.life>.015||pin.target>0);
      const memory=Math.max(.12,s.memory)*1000;trailRef.current=trailRef.current.filter(point=>now-point.born<memory);for(const point of trailRef.current){const life=1-(now-point.born)/memory,r=s.cursorSize*s.trail*life,stretch=1+Math.min(1.6,point.speed*.055);addNegative(point.x,point.y,r*stretch,r/Math.sqrt(stretch),point.angle)}
      let cursorRadius=s.cursorSize;if(pointer.down)cursorRadius*=1+Math.min(1,(now-pointer.downAt)/900)*s.holdGrowth;const cursorStretch=1+Math.min(1.9,pointer.speed*.06);if(pointer.active)addNegative(pointer.x,pointer.y,cursorRadius*cursorStretch,cursorRadius/Math.sqrt(cursorStretch),pointer.angle);
      const a=hexRgb(s.colorA),b=hexRgb(s.colorB);gl.useProgram(program);gl.uniform2f(uResolution,canvas.width,canvas.height);gl.uniform1i(uPosCount,posCount);gl.uniform1i(uNegCount,negCount);gl.uniform4fv(uPositive,positiveData);gl.uniform4fv(uNegative,negativeData);gl.uniform1fv(uNegAngle,angleData);gl.uniform1f(uSoftness,s.softness*dpr);gl.uniform3f(uColorA,a[0],a[1],a[2]);gl.uniform3f(uColorB,b[0],b[1],b[2]);gl.uniform1f(uColorAngle,s.colorAngle*Math.PI/180);gl.uniform1f(uInverted,invertedRef.current?1:0);gl.uniform4f(uPointer,pointer.x*dpr,pointer.y*dpr,cursorRadius*dpr,pointer.active?1:0);gl.drawArrays(gl.TRIANGLES,0,6);pointer.speed*=.92;frame=requestAnimationFrame(render)};
    resize();addEventListener("resize",resize);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);canvas.addEventListener("pointerleave",leave);canvas.addEventListener("dblclick",doubleClick);frame=requestAnimationFrame(render);return()=>{cancelAnimationFrame(frame);removeEventListener("resize",resize);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);canvas.removeEventListener("pointerleave",leave);canvas.removeEventListener("dblclick",doubleClick);gl.deleteProgram(program);gl.deleteBuffer(buffer)};
  },[]);

  return <main id="main" className="instrument-shell" data-inverted={inverted}><canvas ref={canvasRef} className="instrument-canvas" aria-label="Interactive negative dot logo instrument"/><header className="instrument-brand"><span>{Array.from({length:9},(_,index)=><i key={index}/>)}</span>dotwise</header><div className="instrument-hint">Move through the logo · Hold to open · Click to pin · Double-click to invert</div>
    <div className="instrument-transport"><button type="button" data-active={capturing} onClick={toggleCapture}>{capturing?<><CircleStop size={13}/>Stop</>:<><Radio size={13}/>Capture</>}</button><button type="button" data-active={looping} disabled={recordedRef.current.length<2} onClick={toggleLoop}><Play size={13}/>Loop</button><button type="button" onClick={release}>Release</button></div>
    {panel?<aside className="instrument-panel"><div className="instrument-panel-header"><div><h1>Negative Instrument</h1><p>One cursor · positive / negative motion · V10</p></div><div><button type="button" aria-label="Reset" onClick={reset}><RotateCcw size={16}/></button><button type="button" aria-label="Hide controls" onClick={()=>setPanel(false)}><SlidersHorizontal size={17}/></button></div></div>
      <section><header><span>Logo</span><em>01</em></header><Segmented items={[{id:"single",label:"Single"},{id:"pair",label:"Pair"},{id:"triad",label:"Triad"},{id:"orbit",label:"Orbit"}]} value={settings.arrangement} onChange={value=>set("arrangement",value)}/><Control label="Dot size" value={settings.size} min={42} max={190} step={1} onChange={value=>set("size",value)}/><Control label="Spacing" value={settings.spacing} min={50} max={280} step={1} onChange={value=>set("spacing",value)}/><Control label="Aspect" value={settings.aspect} min={.5} max={2} step={.01} onChange={value=>set("aspect",value)}/></section>
      <section><header><span>Negative cursor</span><em>02</em></header><Control label="Cursor size" value={settings.cursorSize} min={12} max={110} step={1} onChange={value=>set("cursorSize",value)}/><Control label="Boolean softness" value={settings.softness} min={2} max={70} step={1} onChange={value=>set("softness",value)}/><Control label="Trail amount" value={settings.trail} min={0} max={1} step={.01} onChange={value=>set("trail",value)}/><Control label="Hold growth" value={settings.holdGrowth} min={0} max={1.5} step={.01} onChange={value=>set("holdGrowth",value)}/></section>
      <section><header><span>Motion memory</span><em>03</em></header><Control label="Trail memory" value={settings.memory} min={.15} max={3.5} step={.05} onChange={value=>set("memory",value)}/><Control label="Edge attraction" value={settings.pull} min={0} max={1} step={.01} onChange={value=>set("pull",value)}/><p className="instrument-note">Capture records up to six seconds of cursor motion. Loop replays the exact gesture with its original speed.</p></section>
      <section><header><span>Color</span><em>04</em></header><div className="instrument-colors"><label><span>Primary</span><input aria-label="Primary color" type="color" value={settings.colorA} onChange={event=>set("colorA",event.target.value)}/></label><label><span>Secondary</span><input aria-label="Secondary color" type="color" value={settings.colorB} onChange={event=>set("colorB",event.target.value)}/></label></div><Control label="Color angle" value={settings.colorAngle} min={0} max={360} step={1} onChange={value=>set("colorAngle",value)}/></section>
      <section><header><span>Export</span><em>05</em></header><div className="instrument-export"><button type="button" onClick={exportPNG}>PNG</button><button type="button" onClick={exportJSON}>JSON</button><button type="button" data-recording={videoRecording} onClick={toggleVideo}>{videoRecording?<CircleStop size={12}/>:<Video size={12}/>} {videoRecording?"Stop MP4":"MP4"}</button></div></section>
    </aside>:<button type="button" className="instrument-show" aria-label="Show controls" onClick={()=>setPanel(true)}><SlidersHorizontal size={18}/></button>}
  </main>;
}
