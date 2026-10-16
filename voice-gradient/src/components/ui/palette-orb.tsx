import { ShaderOrb, type OrbVariant, type ShaderOrbProps } from './orbkit-core';

// Original colour-field shader: solid silhouette, broad moving colour clouds,
// fine stationary grain. Reuses Orbkit's lifecycle, clock and reduced motion.
const paletteOrb: OrbVariant = {
  key:'dotwise-palette',label:'Dotwise colour field',note:'Crisp grainy mesh sphere',
  params:[{key:"shadowArea",label:"Shadow area",min:.2,max:1,step:.01,default:1},{key:"pulse",label:"Voice force",min:0,max:1.1,step:.01,default:0,response:0},...['drift','curl'].map(key=>({key,label:key,min:0,max:80,step:.01,default:0,integrate:true,response:0})),{key:"motionMode",label:"Motion mode",min:0,max:2,step:1,default:1},{key:"brightness",label:"Brightness",min:.7,max:1.2,step:.01,default:1},{key:"blend",label:"Blend",min:0,max:1,step:.01,default:.5},...(["energy","low","mid","high","centroid","flux"] as const).map(key=>({key,label:key,min:0,max:1,step:.01,default:0,response:0})),{key:'speed',label:'Flow',min:0,max:320,step:1,default:0,integrate:true,response:0},{key:"saturation",label:"Saturation",min:0,max:1,step:.01,default:1}],
  colors:[{key:'light',label:'Light',default:'#ffc2dc'},{key:'body',label:'Body',default:'#db8ad7'},{key:'shadow',label:'Depth',default:'#7978d1'},{key:'accent',label:'Accent',default:'#9fcff8'}],
  frag:`
vec3 toLab(vec3 c){
 c=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
 vec3 lms=mat3(.41222147,.21190350,.08830246,.53633254,.68069955,.28171884,.05144599,.10739696,.62997870)*c;
 lms=pow(max(lms,vec3(0.0)),vec3(1.0/3.0));
 return mat3(.21045426,1.97799850,.02590404,.79361779,-2.42859221,.78277177,-.00407205,.45059371,-.80867577)*lms;
}
vec3 fromLab(vec3 c){
 vec3 lms=mat3(1.,1.,1.,.39633778,-.10556135,-.08948418,.21580376,-.06385417,-1.29148555)*c;
 lms=lms*lms*lms;
 vec3 rgb=mat3(4.07674166,-1.268438,.00419609,-3.30771159,2.6097574,-.70341861,.23096993,-.3413194,1.7076147)*lms;
 rgb=max(rgb,vec3(0.));
 return mix(rgb*12.92,1.055*pow(rgb,vec3(1./2.4))-.055,step(vec3(.0031308),rgb));
}
float spot(vec2 p,vec2 center,vec2 scale){vec2 d=(p-center)*scale;return exp(-dot(d,d)*mix(10.0,1.6,uP_blend));}
void main() {
 vec2 p=orbUV();
 float r=length(p);
 float edge=2.0/min(uRes.x,uRes.y);
 float alpha=1.-smoothstep(.96-edge,.96,r);
 if(alpha<=0.){gl_FragColor=vec4(0.);return;}
 float t=uP_speed*.12;
 // All motion is advected by integrated phases: a syllable changes velocity,
 // never the current position. Separate phases let adjacent colours overtake.
 float drift=uP_drift*.10;
 float curl=uP_curl*.10;
 // Audio changes integrated transport speed only; blend breadth stays fixed.
 vec2 q=p;

 q+=.17*vec2(sin(p.y*2.2+t*.65),cos(p.x*2.0-drift*.7));
 q+=.07*vec2(sin(p.y*3.6-curl*.8),sin(p.x*3.4+drift*.6));
 float a=spot(q,vec2(.58*cos(t*.72+2.5),.55*sin(t*.61+2.5)),vec2(1.05,.9));
 float b=spot(q,vec2(.57*cos(t*.58+.5),.62*sin(t*.7+.5)),vec2(.9,1.1));
 float c=spot(q,vec2(.55*cos(t*.66+4.3),.60*sin(t*.53+4.3)),vec2(.9,1.)/sqrt(uP_shadowArea))*uP_shadowArea;
 float d=spot(q,vec2(.63*cos(t*.56+drift*.22+5.7),.55*sin(t*.64+drift*.17+5.7)),vec2(1.05,1.1));
 float e=spot(q,vec2(.70*cos(t*.48+3.6),.70*sin(t*.57+3.6)),vec2(1.,1.));
 vec3 lab=(toLab(uC_light)*a+toLab(uC_body)*b+toLab(uC_shadow)*c+toLab(uC_body)*e*.65+toLab(uC_accent)*d)/(a+b+c+d+e*.65);
 lab.yz*=uP_saturation;
 lab.x=clamp(lab.x*uP_brightness,0.0,1.0);
 vec3 colour=fromLab(lab);
 float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
 colour+=grain*.022;
 gl_FragColor=vec4(clamp(colour,0.,1.)*alpha,alpha);
}`
};
export function PaletteOrb(props: Omit<ShaderOrbProps,'variant'>){return <ShaderOrb variant={paletteOrb} {...props}/>;}
