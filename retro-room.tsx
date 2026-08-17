"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import {
  CassetteTape as Tape,
  Check,
  Disc3,
  MousePointer2,
  Radio,
} from "lucide-react";
type Phase = "look" | "label" | "songs" | "record" | "done";
const SONGS = ["Midnight City", "Plastic Love", "Space Song"];
function Reel({ x, recording }: { x: number; recording: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (recording && ref.current) ref.current.rotation.z -= d * 4;
  });
  return (
    <group position={[x, 0.15, 0.31]}>
      <mesh ref={ref}>
        <cylinderGeometry args={[0.34, 0.34, 0.12, 20]} />
        <meshStandardMaterial
          color="#242620"
          roughness={0.38}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <torusGeometry args={[0.18, 0.045, 8, 24]} />
        <meshStandardMaterial color="#d6c49b" />
      </mesh>
    </group>
  );
}
function Deck({
  phase,
  onStart,
  onRecord,
}: {
  phase: Phase;
  onStart: () => void;
  onRecord: () => void;
}) {
  const active = phase === "look";
  const recording = phase === "record" || phase === "done";
  return (
    <group position={[0, 0.15, 0.2]} rotation={[-0.08, 0, 0]}>
      <mesh
        castShadow
        receiveShadow
        onClick={active ? onStart : undefined}
        onPointerOver={(e) => {
          if (active) {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <boxGeometry args={[5, 2.75, 0.55]} />
        <meshStandardMaterial
          color={active ? "#d7c79f" : "#c3b58f"}
          emissive={active ? "#6f5e3c" : "#000"}
          emissiveIntensity={active ? 0.12 : 0}
          roughness={0.48}
          metalness={0.14}
        />
      </mesh>
      <mesh position={[0, 0.17, 0.31]}>
        <boxGeometry args={[4.25, 1.75, 0.08]} />
        <meshStandardMaterial color="#eee1c2" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.03, 0.38]}>
        <boxGeometry args={[2.9, 0.78, 0.06]} />
        <meshStandardMaterial color="#191b18" roughness={0.28} />
      </mesh>
      <Reel x={-1.03} recording={recording} />
      <Reel x={1.03} recording={recording} />
      <Text
        position={[-1.78, 0.77, 0.39]}
        fontSize={0.14}
        color="#a64232"
        anchorX="left"
      >
        MIXTAPE / SIDE A
      </Text>
      <Text
        position={[-1.78, 0.49, 0.39]}
        fontSize={0.2}
        color="#292b26"
        anchorX="left"
      >
        MEMORY RECORDER
      </Text>
      {[-1.45, -0.55, 0.35, 1.25].map((x, i) => (
        <mesh
          key={x}
          position={[x, -0.96, 0.38]}
          onClick={i === 2 && phase === "record" ? onRecord : undefined}
          onPointerOver={(e) => {
            if (i === 2 && phase === "record") {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }
          }}
          onPointerOut={() => (document.body.style.cursor = "default")}
        >
          <boxGeometry args={[0.64, 0.34, 0.22]} />
          <meshStandardMaterial
            color={i === 2 ? "#bd4937" : "#383a34"}
            emissive={i === 2 && phase === "record" ? "#7e2119" : "#000"}
            emissiveIntensity={0.8}
            roughness={0.35}
            metalness={0.4}
          />
        </mesh>
      ))}
      {phase === "look" && (
        <Text
          position={[0, -1.55, 0.2]}
          fontSize={0.16}
          color="#d85b43"
          anchorX="center"
        >
          CLICK THE BLANK TAPE TO BEGIN
        </Text>
      )}
      {phase === "record" && (
        <Text
          position={[0.35, -0.96, 0.53]}
          fontSize={0.09}
          color="#fff0d3"
          anchorX="center"
        >
          REC
        </Text>
      )}
    </group>
  );
}
function SongCrates({
  phase,
  selected,
  onSelect,
}: {
  phase: Phase;
  selected: number[];
  onSelect: (i: number) => void;
}) {
  return (
    <group position={[4.1, -0.72, -0.7]} rotation={[0, -0.22, 0]}>
      {SONGS.map((song, i) => (
        <group
          key={song}
          position={[i * 0.72 - 1.05, i * 0.05, 0]}
          rotation={[0, 0, (i - 1) * 0.04]}
          onClick={() => phase === "songs" && onSelect(i)}
          onPointerOver={(e) => {
            if (phase === "songs") {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }
          }}
          onPointerOut={() => (document.body.style.cursor = "default")}
        >
          <mesh castShadow>
            <boxGeometry args={[0.62, 1.25, 0.1]} />
            <meshStandardMaterial
              color={["#b94c39", "#46786f", "#b59c58"][i]}
              emissive={selected.includes(i) ? "#a77a38" : "#000"}
              emissiveIntensity={selected.includes(i) ? 0.65 : 0}
              roughness={0.65}
            />
          </mesh>
          <Text
            position={[0, 0, 0.065]}
            fontSize={0.075}
            maxWidth={0.5}
            textAlign="center"
            color="#f1e7cd"
          >
            {song.toUpperCase()}
          </Text>
        </group>
      ))}
    </group>
  );
}
function CRT({ phase }: { phase: Phase }) {
  const copy = {
    look: "INSERT BLANK TAPE",
    label: "LABEL TERMINAL ACTIVE",
    songs: "SELECT TRACKS →",
    record: "ARMED. PRESS REC",
    done: "MIXTAPE COMPLETE",
  }[phase];
  return (
    <group position={[-4.25, 0.2, -1.5]} rotation={[0, 0.35, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.25, 1.8, 1.45]} />
        <meshStandardMaterial color="#383a34" roughness={0.46} />
      </mesh>
      <mesh position={[0, 0.08, 0.75]}>
        <boxGeometry args={[1.72, 1.14, 0.06]} />
        <meshStandardMaterial
          color="#132219"
          emissive="#5b8d67"
          emissiveIntensity={1.05}
        />
      </mesh>
      <Text
        position={[-0.68, 0.22, 0.8]}
        fontSize={0.13}
        color="#a4d29e"
        anchorX="left"
      >
        MIXTAPE.OS
      </Text>
      <Text
        position={[-0.68, -0.08, 0.8]}
        fontSize={0.105}
        maxWidth={1.35}
        color="#79a777"
        anchorX="left"
      >
        {copy}
      </Text>
      <Text
        position={[-0.68, -0.36, 0.8]}
        fontSize={0.07}
        color="#638d65"
        anchorX="left"
      >
        REC LEVEL ▮▮▮▮▯
      </Text>
    </group>
  );
}
function Room({
  phase,
  setPhase,
  selected,
  setSelected,
}: {
  phase: Phase;
  setPhase: (p: Phase) => void;
  selected: number[];
  setSelected: (v: number[]) => void;
}) {
  return (
    <>
      <color attach="background" args={["#111310"]} />
      <fog attach="fog" args={["#111310", 10, 21]} />
      <ambientLight intensity={1.25} />
      <hemisphereLight intensity={1.3} color="#f2d7a0" groundColor="#20251e" />
      <spotLight
        position={[-4, 7, 5]}
        angle={0.55}
        penumbra={0.7}
        intensity={95}
        color="#ffd08b"
        castShadow
      />
      <pointLight position={[5, 3, 2]} intensity={35} color="#70a79c" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#30332b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2, -4.5]}>
        <boxGeometry args={[16, 8, 0.2]} />
        <meshStandardMaterial color="#292c25" roughness={0.9} />
      </mesh>
      <gridHelper
        args={[24, 24, "#4b5043", "#353a31"]}
        position={[0, -1.98, 0]}
      />
      <mesh position={[0, -1.48, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[9, 0.35, 5]} />
        <meshStandardMaterial color="#604a34" roughness={0.7} />
      </mesh>
      <Deck
        phase={phase}
        onStart={() => setPhase("label")}
        onRecord={() => setPhase("done")}
      />
      <CRT phase={phase} />
      <SongCrates
        phase={phase}
        selected={selected}
        onSelect={(i) =>
          setSelected(
            selected.includes(i)
              ? selected.filter((x) => x !== i)
              : [...selected, i],
          )
        }
      />
      <group position={[4.3, 2, -3.8]}>
        <Text fontSize={0.32} color="#d45a43">
          MIXTAPE STUDIO
        </Text>
        <Text position={[0, -0.4, 0]} fontSize={0.11} color="#d8c8a6">
          TOKYO / 1994 / AFTER DARK
        </Text>
      </group>
    </>
  );
}
export function RetroRoom() {
  const [phase, setPhase] = useState<Phase>("look");
  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const advanceLabel = () => {
    if (title.trim() && recipient.trim()) setPhase("songs");
  };
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: [0, 0.5, 9.7], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Room
          phase={phase}
          setPhase={setPhase}
          selected={selected}
          setSelected={setSelected}
        />
      </Canvas>
      <div className="scanlines pointer-events-none absolute inset-0" />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between p-5 font-mono text-[10px] tracking-[.15em] text-[#a4b29b] md:p-8">
        <span>MIXTAPE.OS / ROOM 01</span>
        <span className="text-[#d45a43]">● REC STANDBY</span>
      </header>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
        <i className="absolute left-1/2 top-0 h-5 w-px bg-white/45" />
        <i className="absolute left-0 top-1/2 h-px w-5 bg-white/45" />
      </div>
      {phase === "look" && (
        <button
          className="deck-hit-zone"
          aria-label="开始制作 mixtape"
          onClick={() => setPhase("label")}
        />
      )}
      {phase === "look" && (
        <div className="game-hint">
          <MousePointer2 size={15} /> 点击桌上的空白卡带开始制作
        </div>
      )}
      {phase === "label" && (
        <section className="diegetic-panel">
          <p>CASSETTE LABEL WRITER / STEP 01</p>
          <label>
            标题
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Songs for when…"
            />
          </label>
          <label>
            送给谁
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="For…"
            />
          </label>
          <button
            disabled={!title.trim() || !recipient.trim()}
            onClick={advanceLabel}
          >
            PRINT LABEL ↵
          </button>
        </section>
      )}
      {phase === "songs" && (
        <section className="game-objective">
          <Disc3 size={17} />
          <div>
            <b>从右侧唱片箱选择歌曲</b>
            <span>{selected.length} TRACKS LOADED</span>
          </div>
          {selected.length > 0 && (
            <button onClick={() => setPhase("record")}>LOAD TAPE →</button>
          )}
        </section>
      )}
      {phase === "record" && (
        <div className="game-hint">
          <Radio size={15} /> 按下录音机上发光的红色 REC 键
        </div>
      )}
      {phase === "done" && (
        <section className="completion-card">
          <Check size={22} />
          <p>TAPE RECORDED</p>
          <h1>{title}</h1>
          <span>
            FOR {recipient.toUpperCase()} · {selected.length} TRACKS
          </span>
          <button
            onClick={() => {
              setPhase("look");
              setTitle("");
              setRecipient("");
              setSelected([]);
            }}
          >
            <Tape size={15} /> MAKE ANOTHER
          </button>
        </section>
      )}
    </div>
  );
}
