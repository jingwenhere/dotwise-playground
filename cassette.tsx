"use client";

import { useRef, useState } from "react";
import { FastForward, Pause, Play, Rewind, Square } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

type CassetteProps = {
  compact?: boolean;
  interactive?: boolean;
  playing?: boolean;
  side?: "A" | "B";
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

export function Cassette({
  compact = false,
  interactive = true,
  playing,
  side = "A",
  onPlay,
  onPause,
  onStop,
  onNext,
  onPrevious,
}: CassetteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const isPlaying = playing ?? internalPlaying;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), {
    stiffness: 180,
    damping: 20,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), {
    stiffness: 180,
    damping: 20,
  });

  const move = (event: React.PointerEvent) => {
    if (!interactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const resetTilt = () => {
    mx.set(0);
    my.set(0);
  };

  const togglePlayback = () => {
    if (isPlaying) onPause?.();
    else onPlay?.();
    if (playing === undefined) setInternalPlaying((value) => !value);
  };

  const stop = () => {
    onStop?.();
    if (playing === undefined) setInternalPlaying(false);
  };

  return (
    <div className="cassette-scene">
      <motion.div
        ref={ref}
        onPointerMove={move}
        onPointerLeave={resetTilt}
        style={interactive ? { rotateX: rx, rotateY: ry } : {}}
        className={`cassette-3d ${compact ? "cassette-compact" : ""}`}
      >
        <div className="cassette-edge cassette-edge-top" />
        <div className="cassette-edge cassette-edge-side" />
        <div className="cassette-shell noise">
          <span className="cassette-screw left-3 top-3" />
          <span className="cassette-screw right-3 top-3" />
          <span className="cassette-screw bottom-3 left-3" />
          <span className="cassette-screw bottom-3 right-3" />
          <div className="cassette-label">
            <div className="flex items-start justify-between">
              <span className="label text-[#b33a2b]">
                Mixtape / Side {side}
              </span>
              <span className="font-mono text-[9px] tracking-widest text-ink/55">
                TYPE I · 60
              </span>
            </div>
            <div className="cassette-rule" />
            <p className="hand cassette-title">
              for all the things
              <br />I couldn’t say
            </p>
            <div className="tape-window">
              <div className={`reel ${isPlaying ? "reel-spin" : ""}`} />
              <div className="tape-run">
                <span />
                <b>{isPlaying ? "▶" : "∞"}</b>
                <span />
              </div>
              <div className={`reel ${isPlaying ? "reel-spin" : ""}`} />
            </div>
          </div>
          <div className="cassette-bottom">
            <span />
            <span />
            <span />
          </div>
        </div>
      </motion.div>
      {interactive && (
        <div className="deck-controls" aria-label="Cassette controls">
          <button aria-label="Previous track" onClick={onPrevious}>
            <Rewind size={14} />
          </button>
          <button
            onClick={togglePlayback}
            aria-label={isPlaying ? "Pause mixtape" : "Play full mixtape"}
            className="deck-play"
          >
            {isPlaying ? (
              <Pause size={15} />
            ) : (
              <Play size={15} className="ml-0.5" />
            )}
          </button>
          <button aria-label="Stop mixtape" onClick={stop}>
            <Square size={12} />
          </button>
          <button aria-label="Next track" onClick={onNext}>
            <FastForward size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
