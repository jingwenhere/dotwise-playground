"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

type Polarity = "add" | "cut";
type BlendMode = "normal" | "multiply" | "screen";
type SdfSettings = {
  dotSize:number; aspect:number; maxDots:number; smoothness:number; viscosity:number;
  neck:number; breakDistance:number; breakSpeed:number; elasticity:number; damping:number;
  breathe:number; colorA:string; colorB:string; colorMix:number; blend:BlendMode; polarity:Polarity;
};
type SoftDot = {id:number;x:number;y:number;vx:number;vy:number;r:number;targetR:number;angle:number;polarity:number;color:number;phase:number};
type SoftEdge = {a:number;b:number;active:number;target:number;neck:number};

const defaults:SdfSettings={dotSize:76,aspect:1,maxDots:8,smoothness:62,viscosity:.72,neck:.3,breakDistance:150,breakSpeed:22,elasticity:.055,damping:.9,breathe:0,colorA:"#111214",colorB:"#ff5b7f",colorMix:.72,blend:"multiply",polarity:"add"};
const MAX_DOTS=8;

function Slider({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void}){
  const progress=(value-min)/(max-min)*100,shown=step<.1?value.toFixed(2):step<1?value.toFixed(1):Math.round(value).toString();
  return <div className="sdf-control"><i style={{width:`${progress}%`}}/><span>{label}</span><input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Number(event.target.value))}/><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={shown} onChange={event=>{const next=Number(event.target.value);if(Number.isFinite(next))onChange(Math.max(min,Math.min(max,next)))}}/></div>;
}

function Segmented<T extends string>({items,value,onChange}:{items:{id:T;label:string}[];value:T;onChange:(value:T)=>void}){
  return <div className="sdf-segmented">{items.map(item=><button key={item.id} data-active={item.id===value} onClick={()=>onChange(item.id)}>{item.label}</button>)}</div>;
}

function hexRgb(hex:string){const value=hex.replace("#","");return [parseInt(value.slice(0,2),16)/255,parseInt(value.slice(2,4),16)/255,parseInt(value.slice(4,6),16)/255]}

const vertexShader=`#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;

const fragmentShader=`#version 300 es
precision highp float;
#define MAX_DOTS 8
uniform vec2 u_resolution;
uniform int u_dotCount;
uniform int u_edgeCount;
uniform vec4 u_dots[MAX_DOTS];
uniform vec4 u_shapes[MAX_DOTS];
uniform vec4 u_edges[MAX_DOTS];
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_smooth;
uniform float u_colorMix;
uniform int u_blend;
out vec4 outColor;

float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
float ellipseSdf(vec2 p,vec4 dot,vec4 shape){float c=cos(shape.y),s=sin(shape.y);p-=dot.xy;p=mat2(c,s,-s,c)*p;p.x/=max(.2,shape.x);return length(p)-dot.z;}
float bridgeSdf(vec2 p,vec4 a,vec4 b,float neck){vec2 ab=b.xy-a.xy;float l2=max(dot(ab,ab),1.);float t=clamp(dot(p-a.xy,ab)/l2,0.,1.);vec2 q=a.xy+ab*t;float ends=mix(a.z*.42,b.z*.42,t);float center=pow(sin(3.14159265*t),.72);float radius=mix(ends,neck,center);return length(p-q)-radius;}
vec3 blendColor(vec3 base,vec3 top,int mode){if(mode==1)return base*top;if(mode==2)return 1.-(1.-base)*(1.-top);return top;}

void main(){
  vec2 p=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y);
  float positive=1e5,negative=1e5,nearest=1e5,second=1e5;int nearestIndex=0;
  for(int i=0;i<MAX_DOTS;i++){
    if(i>=u_dotCount)break;
    float d=ellipseSdf(p,u_dots[i],u_shapes[i]);
    if(u_dots[i].w>0.)positive=smin(positive,d,u_smooth);else negative=smin(negative,d,u_smooth);
    float normalized=d/max(1.,u_dots[i].z);
    if(normalized<nearest){second=nearest;nearest=normalized;nearestIndex=i;}else if(normalized<second){second=normalized;}
  }
  for(int i=0;i<MAX_DOTS;i++){
    if(i>=u_edgeCount)break;
    vec4 edge=u_edges[i];if(edge.w<.005)continue;int ia=int(edge.x+.5),ib=int(edge.y+.5);vec4 a=u_dots[ia],b=u_dots[ib];float d=bridgeSdf(p,a,b,edge.z)+(1.-edge.w)*max(a.z,b.z)*.72;
    if(a.w>0.&&b.w>0.)positive=smin(positive,d,u_smooth*.72);else if(a.w<0.&&b.w<0.)negative=smin(negative,d,u_smooth*.72);
  }
  float field=negative<9e4?smax(positive,-negative,u_smooth*.58):positive;
  float aa=max(1.,fwidth(field)*1.25),mask=1.-smoothstep(-aa,aa,field);
  float alternate=mod(float(nearestIndex),2.);float proximity=1.-smoothstep(.02,.55,abs(second-nearest));
  vec3 primary=mix(u_colorA,u_colorB,alternate*u_colorMix);vec3 secondary=mix(u_colorA,u_colorB,(1.-alternate)*u_colorMix);
  vec3 ink=mix(primary,blendColor(primary,secondary,u_blend),proximity*u_colorMix*.7);
  outColor=vec4(mix(vec3(1.),ink,mask),1.);
}`;

function makeProgram(gl:WebGL2RenderingContext){
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)??"Shader compile failed");return shader};
  const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexShader));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentShader));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??"Shader link failed");return program;
}

export function DotwiseSdfLab(){
  const canvasRef=useRef<HTMLCanvasElement>(null),settingsRef=useRef(defaults),dotsRef=useRef<SoftDot[]>([]),edgesRef=useRef<SoftEdge[]>([]),recorderRef=useRef<MediaRecorder|null>(null);
  const [settings,setSettingsState]=useState(defaults),[panel,setPanel]=useState(true),[recording,setRecording]=useState(false);
  const set=useCallback(<K extends keyof SdfSettings>(key:K,value:SdfSettings[K])=>setSettingsState(previous=>{const next={...previous,[key]:value};if(key==="dotSize"){const ratio=Number(value)/Math.max(1,previous.dotSize);dotsRef.current.forEach(dot=>dot.targetR*=ratio)}settingsRef.current=next;return next}),[]);
  const download=(name:string,blob:Blob)=>{const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const reset=()=>{settingsRef.current={...defaults};setSettingsState({...defaults});const canvas=canvasRef.current,w=canvas?.clientWidth??innerWidth,h=canvas?.clientHeight??innerHeight;dotsRef.current=[{id:1,x:w*.38,y:h*.5,vx:0,vy:0,r:defaults.dotSize,targetR:defaults.dotSize,angle:0,polarity:1,color:0,phase:0}];edgesRef.current=[]};
  const exportPNG=()=>canvasRef.current?.toBlob(blob=>blob&&download("dotwise-sdf.png",blob),"image/png");
  const exportJSON=()=>download("dotwise-sdf.json",new Blob([JSON.stringify({version:8,engine:"sdf",settings,dots:dotsRef.current,edges:edgesRef.current},null,2)],{type:"application/json"}));
  const exportVideo=()=>{if(recording){recorderRef.current?.stop();return}const canvas=canvasRef.current,mime=["video/mp4;codecs=avc1.42E01E","video/mp4"].find(type=>MediaRecorder.isTypeSupported(type));if(!canvas||!mime)return;const stream=canvas.captureStream(60),chunks:BlobPart[]=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000});recorderRef.current=recorder;recorder.ondataavailable=event=>event.data.size&&chunks.push(event.data);recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());download("dotwise-sdf-motion.mp4",new Blob(chunks,{type:mime}));setRecording(false);recorderRef.current=null};recorder.start();setRecording(true)};

  useEffect(()=>{
    const canvas=canvasRef.current!,gl=canvas.getContext("webgl2",{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)return;
    const program=makeProgram(gl);gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const location=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
    const uniform=(name:string)=>gl.getUniformLocation(program,name),uResolution=uniform("u_resolution"),uDotCount=uniform("u_dotCount"),uEdgeCount=uniform("u_edgeCount"),uDots=uniform("u_dots"),uShapes=uniform("u_shapes"),uEdges=uniform("u_edges"),uColorA=uniform("u_colorA"),uColorB=uniform("u_colorB"),uSmooth=uniform("u_smooth"),uColorMix=uniform("u_colorMix"),uBlend=uniform("u_blend");
    let width=0,height=0,dpr=1,frame=0,last=performance.now(),nextId=2;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer={x:0,y:0,lastX:0,lastY:0,speed:0,down:false,mode:"none" as "none"|"move"|"bud"|"new",dot:-1,edge:-1};
    const resize=()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);if(!dotsRef.current.length)dotsRef.current=[{id:1,x:width*.38,y:height*.5,vx:0,vy:0,r:defaults.dotSize,targetR:defaults.dotSize,angle:0,polarity:1,color:0,phase:0}]};
    const hit=(x:number,y:number)=>{let best=-1,distance=Infinity;dotsRef.current.forEach((dot,index)=>{const d=Math.hypot(x-dot.x,y-dot.y);if(d<dot.r*settingsRef.current.aspect&&d<distance){best=index;distance=d}});return{index:best,distance}};
    const position=(event:PointerEvent)=>{const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}};
    const move=(event:PointerEvent)=>{const p=position(event),dx=p.x-pointer.x,dy=p.y-pointer.y;pointer.lastX=pointer.x;pointer.lastY=pointer.y;pointer.x=p.x;pointer.y=p.y;pointer.speed=pointer.speed*.55+Math.hypot(dx,dy)*.45;if(pointer.down&&pointer.dot>=0){const dot=dotsRef.current[pointer.dot];dot.vx=dx*.9;dot.vy=dy*.9;dot.x=p.x;dot.y=p.y;if(pointer.mode==="bud"||pointer.mode==="new")dot.targetR=Math.min(settingsRef.current.dotSize*1.15,Math.max(settingsRef.current.dotSize*.48,dot.targetR+Math.hypot(dx,dy)*.04))}else if(!pointer.down){const found=hit(p.x,p.y);canvas.dataset.zone=found.index<0?"new":found.distance>dotsRef.current[found.index].r*.58?"bud":"move"}}
    const down=(event:PointerEvent)=>{move(event);pointer.down=true;pointer.speed=0;const found=hit(pointer.x,pointer.y),s=settingsRef.current,dots=dotsRef.current;if(found.index>=0){const parent=dots[found.index],onRim=found.distance>parent.r*.58&&dots.length<Math.min(MAX_DOTS,s.maxDots);if(onRim){const child:SoftDot={id:nextId++,x:pointer.x,y:pointer.y,vx:0,vy:0,r:8,targetR:s.dotSize*.72,angle:Math.atan2(pointer.y-parent.y,pointer.x-parent.x),polarity:s.polarity==="add"?1:-1,color:dots.length%2,phase:Math.random()*6.28};dots.push(child);edgesRef.current.push({a:found.index,b:dots.length-1,active:1,target:1,neck:s.dotSize*s.neck});pointer.mode="bud";pointer.dot=dots.length-1;pointer.edge=edgesRef.current.length-1}else{pointer.mode="move";pointer.dot=found.index}}else if(dots.length<Math.min(MAX_DOTS,s.maxDots)){dots.push({id:nextId++,x:pointer.x,y:pointer.y,vx:0,vy:0,r:8,targetR:s.dotSize*.76,angle:0,polarity:s.polarity==="add"?1:-1,color:dots.length%2,phase:Math.random()*6.28});pointer.mode="new";pointer.dot=dots.length-1}canvas.setPointerCapture(event.pointerId)};
    const up=(event:PointerEvent)=>{if(pointer.edge>=0){const edge=edgesRef.current[pointer.edge],a=dotsRef.current[edge.a],b=dotsRef.current[edge.b],gap=Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;if(gap>settingsRef.current.breakDistance||pointer.speed>settingsRef.current.breakSpeed)edge.target=0}pointer.down=false;pointer.mode="none";pointer.dot=-1;pointer.edge=-1;canvas.dataset.zone="new";if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)};
    const doubleClick=(event:MouseEvent)=>{const rect=canvas.getBoundingClientRect(),found=hit(event.clientX-rect.left,event.clientY-rect.top);if(found.index>=0){const dots=dotsRef.current,positive=dots.filter(dot=>dot.polarity>0).length;if(dots[found.index].polarity<0||positive>1)dots[found.index].polarity*=-1}};
    const render=(now:number)=>{const dt=Math.min(2,(now-last)/16.667);last=now;const s=settingsRef.current,dots=dotsRef.current,edges=edgesRef.current;
      if(!reduced){for(const edge of edges){edge.active+=(edge.target-edge.active)*.16;const a=dots[edge.a],b=dots[edge.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,gap=d-a.r-b.r,relative=Math.hypot(a.vx-b.vx,a.vy-b.vy),strain=Math.max(0,gap)/Math.max(1,s.breakDistance),effort=Math.min(1,strain*.75+relative/Math.max(1,s.breakSpeed)*.55);edge.neck=Math.max(1,s.dotSize*s.neck*(1-effort*.92)*edge.active);if(edge.target>0&&gap>s.breakDistance*1.25)edge.target=0;if(edge.target>0&&gap>0){const force=gap*s.elasticity*edge.active,ux=dx/d,uy=dy/d;if(pointer.dot!==edge.a){a.vx+=ux*force;a.vy+=uy*force}if(pointer.dot!==edge.b){b.vx-=ux*force;b.vy-=uy*force}}}
        for(let i=0;i<dots.length;i++){const dot=dots[i];if(dot.polarity<0&&pointer.dot!==i){let nearest:SoftDot|null=null,best=Infinity;for(const candidate of dots){if(candidate.polarity<0)continue;const distance=Math.hypot(candidate.x-dot.x,candidate.y-dot.y);if(distance<best){best=distance;nearest=candidate}}if(nearest){const dx=nearest.x-dot.x,dy=nearest.y-dot.y,d=Math.hypot(dx,dy)||1,target=Math.max(8,nearest.r*.34),force=Math.max(0,d-target)*.0028*s.viscosity;dot.vx+=dx/d*force;dot.vy+=dy/d*force}}
          dot.r+=(dot.targetR-dot.r)*.12;if(pointer.dot!==i){dot.x+=dot.vx*dt;dot.y+=dot.vy*dt;dot.vx*=Math.pow(s.damping,dt);dot.vy*=Math.pow(s.damping,dt)}const margin=dot.r*.7;if(dot.x<margin){dot.x=margin;dot.vx=Math.abs(dot.vx)*.45}if(dot.x>width-margin){dot.x=width-margin;dot.vx=-Math.abs(dot.vx)*.45}if(dot.y<margin){dot.y=margin;dot.vy=Math.abs(dot.vy)*.45}if(dot.y>height-margin){dot.y=height-margin;dot.vy=-Math.abs(dot.vy)*.45}}}
      const dotData=new Float32Array(MAX_DOTS*4),shapeData=new Float32Array(MAX_DOTS*4),edgeData=new Float32Array(MAX_DOTS*4);dots.slice(0,MAX_DOTS).forEach((dot,index)=>{const breath=reduced?1:1+Math.sin(now*.0018+dot.phase)*s.breathe*.012;dotData.set([dot.x*dpr,dot.y*dpr,dot.r*dpr*breath,dot.polarity],index*4);shapeData.set([s.aspect,dot.angle,dot.color,1],index*4)});edges.slice(0,MAX_DOTS).forEach((edge,index)=>edgeData.set([edge.a,edge.b,edge.neck*dpr,edge.active],index*4));const a=hexRgb(s.colorA),b=hexRgb(s.colorB);gl.useProgram(program);gl.uniform2f(uResolution,canvas.width,canvas.height);gl.uniform1i(uDotCount,Math.min(MAX_DOTS,dots.length));gl.uniform1i(uEdgeCount,Math.min(MAX_DOTS,edges.length));gl.uniform4fv(uDots,dotData);gl.uniform4fv(uShapes,shapeData);gl.uniform4fv(uEdges,edgeData);gl.uniform3f(uColorA,a[0],a[1],a[2]);gl.uniform3f(uColorB,b[0],b[1],b[2]);gl.uniform1f(uSmooth,s.smoothness*dpr*(.25+s.viscosity*.75));gl.uniform1f(uColorMix,s.colorMix);gl.uniform1i(uBlend,s.blend==="multiply"?1:s.blend==="screen"?2:0);gl.drawArrays(gl.TRIANGLES,0,6);frame=requestAnimationFrame(render)};
    resize();addEventListener("resize",resize);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);canvas.addEventListener("dblclick",doubleClick);frame=requestAnimationFrame(render);return()=>{cancelAnimationFrame(frame);removeEventListener("resize",resize);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);canvas.removeEventListener("dblclick",doubleClick);gl.deleteProgram(program);gl.deleteBuffer(buffer)};
  },[]);

  return <main id="main" className="sdf-shell"><canvas ref={canvasRef} className="sdf-canvas" data-zone="new" aria-label="Dotwise implicit geometry playground"/><header className="sdf-brand"><span>{Array.from({length:9},(_,index)=><i key={index}/>)}</span>dotwise</header><div className="sdf-hint"><b>Drag center</b> to move · <b>Drag rim</b> to bud · <b>Double click</b> to invert</div>
    {panel?<aside className="sdf-panel"><div className="sdf-panel-header"><div><h1>Dotwise Playground</h1><p>Implicit geometry · V8</p></div><div><button aria-label="Reset" onClick={reset}><RotateCcw size={16}/></button><button aria-label="Hide controls" onClick={()=>setPanel(false)}><SlidersHorizontal size={17}/></button></div></div>
      <section><header><span>Dot system</span><em>01</em></header><Slider label="Dot size" value={settings.dotSize} min={24} max={130} step={1} onChange={value=>set("dotSize",value)}/><Slider label="Aspect" value={settings.aspect} min={.45} max={2.4} step={.01} onChange={value=>set("aspect",value)}/><Slider label="Maximum dots" value={settings.maxDots} min={2} max={8} step={1} onChange={value=>set("maxDots",value)}/></section>
      <section><header><span>Boolean geometry</span><em>02</em></header><Segmented items={[{id:"add",label:"Positive"},{id:"cut",label:"Negative"}]} value={settings.polarity} onChange={value=>set("polarity",value)}/><p className="sdf-note">Controls the next dot pulled from a rim. Double-click an existing dot to invert it.</p><Slider label="Fusion range" value={settings.smoothness} min={4} max={110} step={1} onChange={value=>set("smoothness",value)}/><Slider label="Viscosity" value={settings.viscosity} min={0} max={1} step={.01} onChange={value=>set("viscosity",value)}/></section>
      <section><header><span>Elastic motion</span><em>03</em></header><Slider label="Resting neck" value={settings.neck} min={.04} max={.7} step={.01} onChange={value=>set("neck",value)}/><Slider label="Break distance" value={settings.breakDistance} min={30} max={260} step={1} onChange={value=>set("breakDistance",value)}/><Slider label="Break speed" value={settings.breakSpeed} min={4} max={50} step={1} onChange={value=>set("breakSpeed",value)}/><Slider label="Elastic memory" value={settings.elasticity} min={0} max={.14} step={.005} onChange={value=>set("elasticity",value)}/><Slider label="Damping" value={settings.damping} min={.72} max={.98} step={.005} onChange={value=>set("damping",value)}/><Slider label="Breathing" value={settings.breathe} min={0} max={3} step={.05} onChange={value=>set("breathe",value)}/></section>
      <section><header><span>Chromatic space</span><em>04</em></header><div className="sdf-colors"><label><span>Primary</span><input aria-label="Primary color" type="color" value={settings.colorA} onChange={event=>set("colorA",event.target.value)}/></label><label><span>Secondary</span><input aria-label="Secondary color" type="color" value={settings.colorB} onChange={event=>set("colorB",event.target.value)}/></label></div><Slider label="Color relation" value={settings.colorMix} min={0} max={1} step={.01} onChange={value=>set("colorMix",value)}/><Segmented items={[{id:"normal",label:"Normal"},{id:"multiply",label:"Multiply"},{id:"screen",label:"Screen"}]} value={settings.blend} onChange={value=>set("blend",value)}/></section>
      <section><header><span>Export</span><em>05</em></header><div className="sdf-export"><button onClick={exportPNG}>PNG</button><button onClick={exportJSON}>JSON</button><button data-recording={recording} onClick={exportVideo}>{recording?"Stop MP4":"MP4"}</button></div></section>
    </aside>:<button className="sdf-show" aria-label="Show controls" onClick={()=>setPanel(true)}><SlidersHorizontal size={18}/></button>}
  </main>;
}
