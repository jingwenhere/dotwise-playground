"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CirclePlus, RotateCcw, Sparkles } from "lucide-react";

type Point = { x: number; y: number };
type Phase = "outside" | "edge" | "inside" | "shared";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const shown = step < 1 ? value.toFixed(2) : Math.round(value).toString();
  return <label className="playful-slider"><span>{label}</span><output>{shown}</output><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function DotwisePlayfulVoid() {
  const svgRef = useRef<SVGSVGElement>(null);
  const state = useRef({ small: { x: 645, y: 366 }, target: { x: 645, y: 366 }, drag: false, started: 0, centerSide: 1, last: 0 });
  const [position, setPosition] = useState<Point>({ x: 645, y: 366 });
  const [phase, setPhase] = useState<Phase>("outside");
  const [largeRadius, setLargeRadius] = useState(166);
  const [smallRadius, setSmallRadius] = useState(72);
  const [third, setThird] = useState(false);
  const [shared, setShared] = useState(.5);
  const [status, setStatus] = useState("Drag the warm circle toward the dark one");

  const center = { x: 420, y: 365 };
  const getPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 860, y: (event.clientY - rect.top) / rect.height * 730 };
  }, []);

  const settle = useCallback((point: Point) => {
    const d = distance(point, center);
    const edge = largeRadius + smallRadius;
    if (d < largeRadius * .72) {
      setPhase("inside"); setStatus("Peek: the circle becomes an offset void");
    } else if (d < edge + 38) {
      const dx = point.x - center.x, dy = point.y - center.y, unit = Math.max(1, Math.hypot(dx, dy));
      const snap = { x: center.x + dx / unit * (largeRadius + smallRadius * .68), y: center.y + dy / unit * (largeRadius + smallRadius * .68) };
      state.current.target = snap; setPhase("edge"); setStatus("Click and hold at the contact point to share area");
    } else { setPhase("outside"); setStatus("A quick pass through the centre will invert the relationship"); }
  }, [largeRadius, smallRadius]);

  useEffect(() => {
    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const current = state.current;
      if (!current.drag && !reduced) {
        current.small.x += (current.target.x - current.small.x) * .18;
        current.small.y += (current.target.y - current.small.y) * .18;
        if (Math.abs(current.small.x - position.x) > .08 || Math.abs(current.small.y - position.y) > .08) setPosition({ x: current.small.x, y: current.small.y });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const down = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = getPoint(event);
    if (distance(point, position) > smallRadius * 1.28) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    state.current.drag = true; state.current.started = performance.now();
    setStatus("Hold to transfer area · drag through the centre to invert");
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!state.current.drag) return;
    const point = getPoint(event);
    const previous = state.current.small;
    if ((previous.x - center.x) * (point.x - center.x) < 0 && distance(point, center) < largeRadius * .35) {
      state.current.centerSide *= -1; setPhase("inside"); setStatus("Invert: positive and negative have swapped sides");
    }
    state.current.small = point; state.current.target = point; setPosition(point);
    if (performance.now() - state.current.started > 420 && distance(point, center) < largeRadius + smallRadius) {
      setPhase("shared"); setShared(clamp(.35 + (center.x - point.x) / largeRadius * .18, .2, .8)); setStatus("Share: the two circles keep one total area");
    }
  };
  const up = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!state.current.drag) return;
    state.current.drag = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    settle(state.current.small);
  };
  const reset = () => {
    const start = { x: 645, y: 366 };
    state.current.small = start; state.current.target = start; state.current.centerSide = 1;
    setPosition(start); setPhase("outside"); setShared(.5); setStatus("Drag the warm circle toward the dark one");
  };

  const hole = phase === "inside" || phase === "shared";
  const sharedLarge = phase === "shared" ? largeRadius * (1.12 - shared * .24) : largeRadius;
  const sharedSmall = phase === "shared" ? smallRadius * (.72 + shared * .72) : smallRadius;
  const holePoint = hole ? { x: clamp(position.x, center.x - sharedLarge * .56, center.x + sharedLarge * .56), y: clamp(position.y, center.y - sharedLarge * .56, center.y + sharedLarge * .56) } : position;

  return <main className="playful-shell">
    <header className="playful-brand"><span>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</span><b>dotwise</b><em>relation studies / v16</em></header>
    <svg ref={svgRef} className="playful-stage" viewBox="0 0 860 730" role="img" aria-label="Interactive positive and negative circle study" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <defs><mask id="dotwise-void"><rect width="860" height="730" fill="white" />{hole && <circle cx={holePoint.x} cy={holePoint.y} r={sharedSmall} fill="black" />}</mask></defs>
      <circle cx={center.x} cy={center.y} r={sharedLarge} fill="#171719" mask="url(#dotwise-void)" />
      {phase === "edge" && <circle cx={position.x} cy={position.y} r={smallRadius + 7} fill="none" stroke="rgba(23,23,25,.16)" strokeWidth="1" />}
      {!hole && <circle className="playful-small" cx={position.x} cy={position.y} r={smallRadius} fill="#ff6a61" />}
      {hole && <circle className="playful-hole-outline" cx={holePoint.x} cy={holePoint.y} r={sharedSmall} fill="none" stroke="rgba(255,106,97,.62)" strokeWidth="2" />}
      {third && <circle cx={center.x + 224} cy={center.y - 112} r={smallRadius * .52} fill="#8aa7ff" />}
      {third && phase === "inside" && <path d={`M ${holePoint.x + sharedSmall} ${holePoint.y} C ${holePoint.x + sharedSmall + 26} ${holePoint.y - 20}, ${center.x + 195} ${center.y - 124}, ${center.x + 198} ${center.y - 112}`} fill="none" stroke="#171719" strokeWidth="2" strokeLinecap="round" />}
    </svg>
    <aside className="playful-panel">
      <div className="playful-panel-head"><div><p>dot / void</p><h1>Circle play</h1></div><button type="button" aria-label="Reset scene" title="Reset scene" onClick={reset}><RotateCcw size={16} /></button></div>
      <section><header><span>Interaction</span><small>01</small></header><div className="playful-story"><span data-active={phase === "outside"}>Approach</span><span data-active={phase === "edge"}>Catch</span><span data-active={phase === "inside"}>Peek</span><span data-active={phase === "shared"}>Share</span></div><p>{status}</p></section>
      <section><header><span>Geometry</span><small>02</small></header><Slider label="Outer circle" value={largeRadius} min={110} max={220} step={1} onChange={setLargeRadius} /><Slider label="Warm circle" value={smallRadius} min={36} max={112} step={1} onChange={setSmallRadius} />{phase === "shared" && <Slider label="Area share" value={shared} min={.2} max={.8} step={.01} onChange={setShared} />}</section>
      <section><header><span>Composition</span><small>03</small></header><button type="button" className="playful-third" data-active={third} onClick={() => setThird(value => !value)}><CirclePlus size={15} />{third ? "Remove third circle" : "Add third circle"}</button><p>Third circle stays independent until it becomes part of a later relation.</p></section>
      <footer><Sparkles size={14} /> Drag · hold · pass through</footer>
    </aside>
  </main>;
}
