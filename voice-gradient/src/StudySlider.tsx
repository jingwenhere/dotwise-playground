import type { CSSProperties } from 'react';

type Props={label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void;text:string;ariaLabel?:string;hint?:string};
export function StudySlider({label,value,min,max,step,onChange,text,ariaLabel,hint}:Props){
 return <label className="study-slider" title={hint}>
  <span>{label}</span><output>{text}</output>
  <input aria-label={ariaLabel||label} type="range" min={min} max={max} step={step} value={value} style={{'--fill':`${(value-min)/(max-min)*100}%`} as CSSProperties} onChange={e=>onChange(Number(e.target.value))}/>
 </label>;
}
