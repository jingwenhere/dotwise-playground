"use client";

import { useEffect, useRef, useState } from "react";

type Scene = "fuse" | "cut" | "orbit" | "bridge" | "chain";
type Point = { x: number; y: number };

const scenes: { id: Scene; name: string; note: string }[] = [
  { id: "fuse", name: "Fuse", note: "Two fields cohere into one volume." },
  { id: "cut", name: "Cut", note: "A moving negative shape removes mass." },
  { id: "orbit", name: "Orbit", note: "A hollow centre holds a tilted orbit." },
  { id: "bridge", name: "Bridge", note: "Separate dots are pulled into a soft ligament." },
  { id: "chain", name: "Chain", note: "One dot becomes a connected sequence." },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const length = (a: Point) => Math.hypot(a.x, a.y);
const normalize = (a: Point) => { const l = length(a) || 1; return { x: a.x / l, y: a.y / l }; };

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const display = step < 1 ? value.toFixed(2) : Math.round(value).toString();
  return <label className="boolean-range"><span>{label}</span><output>{display}</output><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function DotwiseBooleanLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ a: { x: -105, y: 0 }, b: { x: 105, y: 0 }, drag: "" as "a" | "b" | "", last: 0 });
  const [scene, setScene] = useState<Scene>("bridge");
  const [radius, setRadius] = useState(94);
  const [stretch, setStretch] = useState(1.28);
  const [tension, setTension] = useState(.72);
  const [rotation, setRotation] = useState(28);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
    };
    const centre = () => ({ x: width * .44, y: height * .5 });
    const position = (point: Point) => ({ x: centre().x + point.x, y: centre().y + point.y });
    const ellipse = (point: Point, rx: number, ry: number, angle: number, fill = "#111214") => {
      const p = position(point);
      context.save();
      context.translate(p.x, p.y);
      context.rotate(angle);
      context.beginPath();
      context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      context.fillStyle = fill;
      context.fill();
      context.restore();
    };
    const bridge = (a: Point, b: Point, r: number, inverse = false) => {
      const pa = position(a), pb = position(b), direction = normalize(sub(pb, pa));
      const normal = { x: -direction.y, y: direction.x };
      const distance = Math.max(1, length(sub(pb, pa)));
      const neck = clamp(r * (1.05 - distance / (r * 5.2)) * tension, r * .12, r * .74);
      const pull = clamp(distance * .2, r * .16, r * .65);
      context.save();
      context.beginPath();
      context.moveTo(pa.x + normal.x * r * .72, pa.y + normal.y * r * .72);
      context.bezierCurveTo(pa.x + direction.x * pull + normal.x * neck, pa.y + direction.y * pull + normal.y * neck, pb.x - direction.x * pull + normal.x * neck, pb.y - direction.y * pull + normal.y * neck, pb.x + normal.x * r * .72, pb.y + normal.y * r * .72);
      context.lineTo(pb.x - normal.x * r * .72, pb.y - normal.y * r * .72);
      context.bezierCurveTo(pb.x - direction.x * pull - normal.x * neck, pb.y - direction.y * pull - normal.y * neck, pa.x + direction.x * pull - normal.x * neck, pa.y + direction.y * pull - normal.y * neck, pa.x - normal.x * r * .72, pa.y - normal.y * r * .72);
      context.closePath();
      context.fillStyle = inverse ? "#fff" : "#111214";
      context.fill();
      context.restore();
    };
    const animate = (time: number) => {
      const current = state.current;
      const elapsed = time - current.last;
      current.last = time;
      if (motion && !reduced && !current.drag) {
        const t = time / 1000;
        const targets = scene === "chain"
          ? [{ x: -128 + Math.cos(t * .82) * 26, y: Math.sin(t * .63) * 78 }, { x: 118 + Math.sin(t * .86) * 34, y: -Math.cos(t * .56) * 56 }]
          : [{ x: -104 + Math.cos(t * .7) * 32, y: Math.sin(t * .85) * 47 }, { x: 105 + Math.sin(t * .6) * 38, y: -Math.cos(t * .72) * 50 }];
        current.a.x += (targets[0].x - current.a.x) * Math.min(.07, elapsed * .004);
        current.a.y += (targets[0].y - current.a.y) * Math.min(.07, elapsed * .004);
        current.b.x += (targets[1].x - current.b.x) * Math.min(.07, elapsed * .004);
        current.b.y += (targets[1].y - current.b.y) * Math.min(.07, elapsed * .004);
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = "#fbfbfa";
      context.fillRect(0, 0, width, height);
      const a = current.a, b = current.b;
      const angle = rotation * Math.PI / 180;
      if (scene === "fuse") {
        bridge(a, b, radius);
        ellipse(a, radius, radius * stretch, angle);
        ellipse(b, radius, radius * stretch, angle);
      }
      if (scene === "cut") {
        ellipse({ x: 0, y: 0 }, radius * 1.72, radius * 1.72, 0);
        context.save();
        context.globalCompositeOperation = "destination-out";
        ellipse(b, radius * .9, radius * stretch, angle);
        context.restore();
      }
      if (scene === "orbit") {
        ellipse({ x: 0, y: 0 }, radius * 1.62, radius * 1.62, 0);
        context.save();
        context.globalCompositeOperation = "destination-out";
        ellipse(b, radius * .62, radius * stretch, angle);
        context.restore();
      }
      if (scene === "bridge") {
        bridge(a, b, radius);
        ellipse(a, radius, radius, 0);
        ellipse(b, radius, radius, 0);
        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        context.save();
        context.globalCompositeOperation = "destination-out";
        ellipse(middle, radius * .38, radius * .25, angle);
        context.restore();
      }
      if (scene === "chain") {
        const delta = sub(b, a), unit = normalize(delta);
        const p1 = { x: a.x, y: a.y };
        const p2 = { x: a.x + delta.x * .5 - unit.y * radius * .34, y: a.y + delta.y * .5 + unit.x * radius * .34 };
        const p3 = { x: b.x, y: b.y };
        bridge(p1, p2, radius * .72);
        bridge(p2, p3, radius * .72);
        ellipse(p1, radius * .74, radius * .74, 0);
        ellipse(p2, radius * .62, radius * .62, 0);
        ellipse(p3, radius * .74, radius * .74, 0);
      }
      context.save();
      context.strokeStyle = "rgba(17,18,20,.18)";
      context.lineWidth = 1;
      context.setLineDash([4, 6]);
      const pa = position(a), pb = position(b);
      context.beginPath(); context.moveTo(pa.x, pa.y); context.lineTo(pb.x, pb.y); context.stroke();
      context.restore();
      frame = requestAnimationFrame(animate);
    };
    const pointer = (event: PointerEvent) => ({ x: event.clientX - centre().x, y: event.clientY - centre().y });
    const down = (event: PointerEvent) => {
      const p = pointer(event), current = state.current;
      current.drag = length(sub(p, current.a)) < length(sub(p, current.b)) ? "a" : "b";
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const current = state.current;
      if (!current.drag) return;
      const p = pointer(event);
      current[current.drag] = { x: clamp(p.x, -width * .32, width * .16), y: clamp(p.y, -height * .36, height * .36) };
    };
    const up = () => { state.current.drag = ""; };
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    frame = requestAnimationFrame(animate);
    return () => { window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); cancelAnimationFrame(frame); };
  }, [scene, radius, stretch, tension, rotation, motion]);

  const active = scenes.find((item) => item.id === scene)!;
  return <main className="boolean-lab" id="main">
    <canvas ref={canvasRef} className="boolean-canvas" aria-label="Interactive Dotwise positive and negative geometry" />
    <header className="boolean-brand"><span className="boolean-mark"><i /><i /><i /><i /></span><span>dotwise</span><small>Boolean motion studies</small></header>
    <aside className="boolean-panel">
      <div className="boolean-panel-head"><div><p>Dotwise playground</p><h1>Positive / negative</h1></div><button className="boolean-play" aria-label={motion ? "Pause motion" : "Play motion"} data-active={motion} onClick={() => setMotion((value) => !value)}>{motion ? "II" : ">"}</button></div>
      <section><div className="boolean-section-label"><span>Relationship</span><span>01</span></div><div className="boolean-scenes">{scenes.map((item) => <button key={item.id} data-active={scene === item.id} onClick={() => setScene(item.id)}><b>{item.name}</b><span>{item.note}</span></button>)}</div></section>
      <section><div className="boolean-section-label"><span>Form</span><span>02</span></div><Range label="Base radius" value={radius} min={44} max={150} step={1} onChange={setRadius} /><Range label="Ellipse stretch" value={stretch} min={.55} max={2.2} step={.01} onChange={setStretch} /><Range label="Connection tension" value={tension} min={.15} max={1} step={.01} onChange={setTension} /><Range label="Orbit rotation" value={rotation} min={-180} max={180} step={1} onChange={setRotation} /></section>
      <footer><span>Drag either dot on the field</span><strong>{active.name}</strong></footer>
    </aside>
  </main>;
}
