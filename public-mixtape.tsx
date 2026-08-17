"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Headphones, Play, X } from "lucide-react";
import { Logo } from "./logo";
import { Cassette } from "./cassette";
import { DEMO_MIXTAPE } from "@/lib/demo";
import { loadDraft } from "@/lib/storage";
import type { Mixtape } from "@/lib/types";
import {
  SpotifyEmbedPlayer,
  type SpotifyEmbedHandle,
  type SpotifyPlaybackState,
} from "@/components/spotify-embed-player";
import { useTapeSound } from "@/lib/use-tape-sound";

export function PublicMixtape({ id }: { id: string }) {
  const [mix, setMix] = useState<Mixtape>(DEMO_MIXTAPE);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const [playbackState, setPlaybackState] =
    useState<SpotifyPlaybackState | null>(null);
  const playerRef = useRef<SpotifyEmbedHandle>(null);
  const advancingRef = useRef(false);
  const sfx = useTapeSound();
  const activeTrack = activeIndex === null ? null : mix.tracks[activeIndex];
  const split = Math.min(
    mix.tracks.length,
    mix.side_break ?? mix.tracks.length,
  );
  const activeSide = activeIndex !== null && activeIndex >= split ? "B" : "A";

  useEffect(() => {
    if (id !== DEMO_MIXTAPE.id) setMix(loadDraft());
  }, [id]);

  useEffect(() => {
    advancingRef.current = false;
    setPlaybackState(null);
  }, [activeIndex]);

  const playFrom = (index: number) => {
    sfx.click();
    sfx.motorStart();
    setSequencePlaying(true);
    if (activeIndex === index) playerRef.current?.play();
    else setActiveIndex(index);
  };

  const nextTrack = () => {
    if (!mix.tracks.length) return;
    setActiveIndex((current) => {
      if (current === null) return 0;
      if (current >= mix.tracks.length - 1) {
        setSequencePlaying(false);
        sfx.motorStop();
        return current;
      }
      return current + 1;
    });
  };

  const previousTrack = () => {
    if (!mix.tracks.length) return;
    setActiveIndex((current) => Math.max(0, (current ?? 0) - 1));
  };

  const updatePlayback = (state: SpotifyPlaybackState) => {
    setPlaybackState(state);
    const ended =
      state.duration > 0 &&
      state.position >= state.duration - 800 &&
      state.isPaused;
    if (ended && sequencePlaying && !advancingRef.current) {
      advancingRef.current = true;
      nextTrack();
    } else if (state.isPaused && state.position > 0 && !ended) {
      setSequencePlaying(false);
      sfx.motorStop();
    }
  };

  return (
    <main id="main" className="min-h-screen pb-52">
      <header className="flex h-[76px] items-center justify-between border-b border-ink/10 px-5 md:px-10">
        <Logo />
        <Link href="/" className="text-sm font-semibold hover:text-tomato">
          Make your own ↗
        </Link>
      </header>
      <section className="mx-auto grid max-w-[1280px] gap-14 px-5 py-14 md:grid-cols-[.9fr_1.1fr] md:px-10 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:sticky md:top-12 md:self-start"
        >
          <p className="label text-tomato">{mix.recipient}</p>
          <h1 className="hand mt-5 text-[clamp(58px,7vw,96px)] leading-[.83] tracking-[-.045em]">
            {mix.title}
          </h1>
          <p className="mt-7 max-w-[45ch] text-[16px] leading-7 text-ink/60">
            {mix.description}
          </p>
          <div className="mt-10">
            <Cassette
              compact
              playing={sequencePlaying}
              side={activeSide}
              onPlay={() => {
                if (!mix.tracks.length) return;
                sfx.motorStart();
                setSequencePlaying(true);
                if (activeIndex === null) setActiveIndex(0);
                else playerRef.current?.play();
              }}
              onPause={() => {
                playerRef.current?.pause();
                setSequencePlaying(false);
                sfx.motorStop();
              }}
              onStop={() => {
                playerRef.current?.pause();
                setSequencePlaying(false);
                setActiveIndex(null);
                sfx.motorStop();
              }}
              onNext={nextTrack}
              onPrevious={previousTrack}
            />
            <div className="public-tape-status" aria-live="polite">
              {activeTrack ? (
                <>
                  <span>
                    {sequencePlaying
                      ? playbackState?.isBuffering
                        ? "THREADING / BUFFERING"
                        : "PLAYING"
                      : "PAUSED"}{" "}
                    · SIDE {activeSide}
                  </span>
                  <b>
                    {String((activeIndex ?? 0) + 1).padStart(2, "0")} /{" "}
                    {String(mix.tracks.length).padStart(2, "0")} ·{" "}
                    {activeTrack.title}
                  </b>
                </>
              ) : (
                <span>PRESS PLAY TO HEAR THE FULL MIXTAPE</span>
              )}
            </div>
          </div>
        </motion.div>
        <div>
          <div className="flex items-end justify-between border-b border-ink/15 pb-4">
            <div>
              <p className="label text-ink/40">Side A / B</p>
              <h2 className="mt-2 text-lg font-semibold">The track list</h2>
            </div>
            <span className="text-sm tabular-nums text-ink/40">
              {String(mix.tracks.length).padStart(2, "0")} songs
            </span>
          </div>
          {(["A", "B"] as const).map((side) => {
            const sideTracks =
              side === "A"
                ? mix.tracks.slice(0, split)
                : mix.tracks.slice(split);
            const offset = side === "A" ? 0 : split;
            return (
              <section className="mt-8" key={side}>
                <div className="flex items-center justify-between border-b-2 border-ink pb-2">
                  <h3 className="label">Side {side}</h3>
                  <span className="text-xs tabular-nums text-ink/40">
                    {sideTracks.length} tracks
                  </span>
                </div>
                {sideTracks.length === 0 ? (
                  <p className="border-b border-ink/10 py-8 text-center text-xs text-ink/35">
                    This side was left blank.
                  </p>
                ) : (
                  <ol className="divide-y divide-ink/10">
                    {sideTracks.map((track, sideIndex) => {
                      const index = offset + sideIndex;
                      return (
                        <motion.li
                          key={track.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.12 + index * 0.06 }}
                          className="grid grid-cols-[34px_64px_1fr_auto] items-center gap-3 py-5"
                        >
                          <span className="text-xs tabular-nums text-ink/35">
                            {String(sideIndex + 1).padStart(2, "0")}
                          </span>
                          <Image
                            src={track.image}
                            alt=""
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-md object-cover"
                          />
                          <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-semibold">
                              {track.title}
                            </h3>
                            <p className="mt-0.5 text-xs text-ink/45">
                              {track.artist}
                            </p>
                            {track.note && (
                              <p className="hand mt-2 text-[17px] leading-5 text-ink/65">
                                “{track.note}”
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => playFrom(index)}
                            aria-label={`在页面内播放 ${track.title}`}
                            className={`grid h-11 w-11 place-items-center rounded-full border border-ink/15 transition-colors duration-150 hover:bg-ink hover:text-white active:scale-[.96] ${activeIndex === index ? "bg-ink text-white" : ""}`}
                          >
                            <Play size={15} className="ml-0.5" />
                          </button>
                        </motion.li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
          <a
            href={`https://open.spotify.com/track/${(activeTrack ?? mix.tracks[0])?.spotify_track_id}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-dark mt-8 w-full"
          >
            <Headphones size={18} /> Open in Spotify <ArrowUpRight size={16} />
          </a>
          <div className="mt-16 border-t border-ink/10 pt-7 text-center">
            <p className="hand text-2xl">Made for you, on purpose.</p>
            <p className="mt-2 text-xs text-ink/40">
              This mixtape lives on Mixtape. Music plays on Spotify.
            </p>
          </div>
        </div>
      </section>
      {activeTrack && (
        <aside className="public-spotify-player" aria-label="Spotify 播放器">
          <div>
            <span>
              FULL MIXTAPE · {String((activeIndex ?? 0) + 1).padStart(2, "0")}/
              {String(mix.tracks.length).padStart(2, "0")} · {activeTrack.title}
            </span>
            <button
              aria-label="关闭播放器"
              onClick={() => {
                sfx.motorStop();
                setSequencePlaying(false);
                setActiveIndex(null);
              }}
            >
              <X size={15} />
            </button>
          </div>
          <SpotifyEmbedPlayer
            key={activeTrack.id}
            ref={playerRef}
            track={activeTrack}
            autoPlay={sequencePlaying}
            onPlaybackStarted={() => setSequencePlaying(true)}
            onPlaybackUpdate={updatePlayback}
          />
        </aside>
      )}
    </main>
  );
}
