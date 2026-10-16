// Transfer the blue Figma tonal hierarchy to each theme in perceptual OKLCH.
function lch(hex:string){
 const rgb=hex.match(/\w\w/g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const [r,g,b]=rgb;
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 const a=1.9779984951*l-2.428592205*m+.4505937099*s,b2=.0259040371*l+.7827717662*m-.808675766*s;
 return [.2104542553*l+.793617785*m-.0040720468*s,Math.hypot(a,b2),Math.atan2(b2,a)*180/Math.PI];
}
export function dialogTheme(tones:string[],name:string,background=.18,textStrength=1){
 const anchor=name==='Porcelain'?'#E6EFFE':name==='Apricot'?tones[0]:name==='Rose lilac'?tones[1]:tones[2];
 const hue=lch(anchor)[2],blueHue=lch('#E6EFFE')[2];
 const remap=(hex:string,alpha=1,strength=1)=>{const [l,c,h]=lch(hex);return `oklch(${Math.max(.2,1-(1-l)*strength)} ${c} ${h+hue-blueHue} / ${alpha})`;};
 return {surface:remap('#E6EFFE',background),past:remap('#A1B3D4',1,textStrength),text:remap('#4A638F',1,textStrength),border:remap('#C8E2FF'),beam:remap(name==='Porcelain'?'#609CE0':'#89B8EF'),shadow:remap('#4285F4',name==='Porcelain'?.14:.09)};
}
