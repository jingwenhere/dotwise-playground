"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Music2,
  PackageCheck,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DEMO_MIXTAPE } from "@/lib/demo";
import { saveDraft } from "@/lib/storage";
import type { Track } from "@/lib/types";
import {
  SpotifyEmbedPlayer,
  type SpotifyEmbedHandle,
} from "@/components/spotify-embed-player";
import { useTapeSound } from "@/lib/use-tape-sound";

type RitualPhase = "label" | "plan" | "dub" | "flip" | "jcard" | "sealed";
type TapeSide = "A" | "B";
type Allocation = {
  track: Track;
  index: number;
  side: TapeSide;
  overflow: boolean;
};

const WORKING_KEY = "mixtape-working-tape";
const SIDE_CAPACITY_MS = 30 * 60 * 1000;
const SONG_GAP_MS = 2_000;
const FALLBACK_DURATION_MS = 3 * 60 * 1000 + 30_000;
const FALLBACK = DEMO_MIXTAPE.tracks;

function trackLength(track: Track) {
  return track.duration_ms || FALLBACK_DURATION_MS;
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function allocateTape(tracks: Track[], sideBreak: number) {
  let usedA = 0;
  let usedB = 0;
  const allocations: Allocation[] = [];

  tracks.forEach((track, index) => {
    const side: TapeSide = index < sideBreak ? "A" : "B";
    const length = trackLength(track) + SONG_GAP_MS;
    const overflow =
      side === "A"
        ? usedA + length > SIDE_CAPACITY_MS
        : usedB + length > SIDE_CAPACITY_MS;
    if (side === "A") usedA += length;
    else usedB += length;
    allocations.push({ track, index, side, overflow });
  });

  return { allocations, usedA, usedB };
}

export function TapeRoom() {
  const [phase, setPhase] = useState<RitualPhase>("label");
  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState(DEMO_MIXTAPE.cover_image);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>(FALLBACK);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [manualSideBreak, setManualSideBreak] = useState<number | null>(null);
  const [recordedIds, setRecordedIds] = useState<string[]>([]);
  const [tapeSide, setTapeSide] = useState<TapeSide>("A");
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const [signalLevel, setSignalLevel] = useState(8);
  const [sourceNonce, setSourceNonce] = useState(0);
  const [dubbingId, setDubbingId] = useState<string | null>(null);
  const [dubProgress, setDubProgress] = useState(0);
  const [dubElapsedMs, setDubElapsedMs] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const playerRef = useRef<SpotifyEmbedHandle>(null);
  const dubIntervalRef = useRef<number | null>(null);
  const sfx = useTapeSound();

  const resolvedSideBreak = tracks.length
    ? Math.min(
        tracks.length,
        Math.max(1, manualSideBreak ?? Math.ceil(tracks.length / 2)),
      )
    : 0;
  const tape = useMemo(
    () => allocateTape(tracks, resolvedSideBreak),
    [tracks, resolvedSideBreak],
  );
  const sideBreak = tape.allocations.filter((item) => item.side === "A").length;
  const nextAllocation = tape.allocations.find(
    (item) => item.side === tapeSide && !recordedIds.includes(item.track.id),
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WORKING_KEY) || "null");
      if (saved) {
        setTitle(saved.title || "");
        setRecipient(saved.recipient || "");
        setDescription(saved.description || "");
        setCover(saved.cover || DEMO_MIXTAPE.cover_image);
        setTracks(saved.tracks || []);
        setManualSideBreak(
          typeof saved.manualSideBreak === "number"
            ? saved.manualSideBreak
            : null,
        );
        setRecordedIds(saved.recordedIds || []);
        setTapeSide(saved.tapeSide === "B" ? "B" : "A");
        if (saved.phase === "sealed" && saved.tracks?.length) {
          setPhase("sealed");
        } else if (saved.phase === "dub" || saved.phase === "flip") {
          setPhase(saved.phase);
        } else if (
          saved.recordedIds?.length === saved.tracks?.length &&
          saved.tracks?.length
        ) {
          setPhase("jcard");
        } else if (saved.tracks?.length) {
          setPhase("plan");
        } else if (saved.title || saved.recipient) {
          setPhase("label");
        }
      }
    } catch {
      localStorage.removeItem(WORKING_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!title && !recipient && tracks.length === 0) {
      localStorage.removeItem(WORKING_KEY);
      return;
    }
    localStorage.setItem(
      WORKING_KEY,
      JSON.stringify({
        title,
        recipient,
        description,
        cover,
        tracks,
        manualSideBreak,
        recordedIds,
        tapeSide,
        phase,
      }),
    );
  }, [
    hydrated,
    phase,
    title,
    recipient,
    description,
    cover,
    tracks,
    manualSideBreak,
    recordedIds,
    tapeSide,
  ]);

  useEffect(() => {
    if (phase !== "plan" || !query.trim()) {
      setResults(FALLBACK);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(query)}`,
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        setResults(
          data.tracks.map((track: Track, index: number) => ({
            ...track,
            id: `spotify-${track.spotify_track_id}-${index}`,
            note: "",
            position: { x: 0, y: 0 },
          })),
        );
      } catch {
        setResults(FALLBACK);
        toast.error("Spotify 连接失效，请重新连接后再搜索");
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [phase, query]);

  useEffect(
    () => () => {
      if (dubIntervalRef.current) window.clearInterval(dubIntervalRef.current);
    },
    [],
  );

  const addTrack = (track: Track) => {
    if (
      tracks.some((item) => item.spotify_track_id === track.spotify_track_id)
    ) {
      toast("这首歌已经写在便笺上了");
      return;
    }
    const added: Track = {
      ...track,
      id: crypto.randomUUID(),
      note: "",
      position: { x: 0, y: 0 },
    };
    const nextTracks = [...tracks, added];
    const nextBreak = Math.min(
      nextTracks.length,
      Math.max(1, manualSideBreak ?? Math.ceil(nextTracks.length / 2)),
    );
    const nextTape = allocateTape(nextTracks, nextBreak);
    if (nextTape.allocations.some((item) => item.overflow)) {
      toast.error("C60 磁带已经放不下这首歌了");
      return;
    }
    sfx.paper();
    setTracks(nextTracks);
    toast.success("已写入待录便笺，还没有录进磁带");
  };

  const moveTrack = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    if (recordedIds.includes(tracks[index].id)) {
      toast("已经录入的歌曲需要重新录制，不能直接移动");
      return;
    }
    sfx.click();
    const next = [...tracks];
    [next[index], next[target]] = [next[target], next[index]];
    setTracks(next);
  };

  const setSideBStart = (index: number) => {
    if (index <= 0 || phase !== "plan") return;
    const nextTape = allocateTape(tracks, index);
    if (nextTape.allocations.some((item) => item.overflow)) {
      toast.error("这样分面会超过单面 30 分钟，请换一个分界点");
      return;
    }
    sfx.paper();
    setManualSideBreak(index);
    setTapeSide("A");
    toast.success(`SIDE B 将从第 ${index + 1} 首开始`);
  };

  const cueTrack = (track: Track) => {
    if (
      phase === "dub" &&
      nextAllocation &&
      track.id !== nextAllocation.track.id
    ) {
      toast("磁带需要按录音单顺序写入，请先 CUE 标记的下一首");
      return;
    }
    sfx.click();
    setSourceReady(false);
    setSourcePlaying(false);
    setSignalLevel(8);
    setSourceNonce((value) => value + 1);
    setActiveTrack(track);
  };

  const stopSource = () => {
    playerRef.current?.pause();
    sfx.motorStop();
  };

  const finishDub = (track: Track) => {
    if (dubIntervalRef.current) window.clearInterval(dubIntervalRef.current);
    dubIntervalRef.current = null;
    const nextRecorded = [...recordedIds, track.id];
    setRecordedIds(nextRecorded);
    setDubProgress(100);
    setDubbingId(null);
    setSourcePlaying(false);
    setSignalLevel(8);
    playerRef.current?.pause();
    sfx.motorStop();
    sfx.print();

    const remainingOnSide = tape.allocations.some(
      (item) => item.side === tapeSide && !nextRecorded.includes(item.track.id),
    );
    if (remainingOnSide) {
      toast.success("整首 Spotify 歌曲已写入磁带。现在可以 CUE 下一首");
    } else {
      const hasNextSide = tape.allocations.some(
        (item) => item.side === "B" && !nextRecorded.includes(item.track.id),
      );
      toast.success(
        tapeSide === "A" && hasNextSide
          ? "SIDE A 已录完。确认后再手动弹出并翻面"
          : `SIDE ${tapeSide} 已录完。确认后再进入包装`,
      );
    }
  };

  const startDub = () => {
    if (
      !nextAllocation ||
      dubbingId ||
      !sourceReady ||
      activeTrack?.id !== nextAllocation.track.id
    )
      return;
    const track = nextAllocation.track;
    sfx.lever();
    sfx.motorStart();
    setActiveTrack(track);
    setDubbingId(track.id);
    setDubProgress(0);
    setDubElapsedMs(0);
    setSourcePlaying(false);
    setSignalLevel(8);
    playerRef.current?.play();
    const started = Date.now();
    dubIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setDubElapsedMs(elapsed);
      setSignalLevel(
        Math.min(
          94,
          32 +
            Math.abs(Math.sin(elapsed / 173)) * 34 +
            Math.abs(Math.sin(elapsed / 421)) * 22,
        ),
      );
      setDubProgress(
        Math.min(99, (elapsed / Math.max(1, trackLength(track))) * 100),
      );
    }, 250);
  };

  const stopDub = () => {
    if (!dubbingId) return;
    const track = tape.allocations.find(
      (item) => item.track.id === dubbingId,
    )?.track;
    if (!track) return;
    finishDub(track);
  };

  const flipTape = () => {
    if (flipping) return;
    sfx.flip();
    setFlipping(true);
    window.setTimeout(() => {
      setTapeSide("B");
      setFlipping(false);
      setDubProgress(0);
      setPhase("dub");
    }, 760);
  };

  const publish = () => {
    saveDraft({
      id: "my-mixtape",
      title,
      recipient,
      description,
      cover_image: cover,
      mood: "Nostalgic",
      published: true,
      side_break: sideBreak,
      tracks: tracks.map((track, index) => ({
        ...track,
        position: { x: 100 + index * 55, y: 100 + index * 35 },
      })),
    });
    sfx.mastered();
    setPhase("sealed");
    navigator.clipboard?.writeText(`${location.origin}/mixtape/my-mixtape`);
    toast.success("卡带盒已合上，分享链接已复制");
  };

  const reset = () => {
    stopSource();
    setPhase("label");
    setTitle("");
    setRecipient("");
    setDescription("");
    setCover(DEMO_MIXTAPE.cover_image);
    setTracks([]);
    setManualSideBreak(null);
    setRecordedIds([]);
    setTapeSide("A");
    setActiveTrack(null);
    setSourceReady(false);
    setSourcePlaying(false);
    setSignalLevel(8);
    setQuery("");
    localStorage.removeItem(WORKING_KEY);
  };

  const phaseCopy: Record<RitualPhase, string> = {
    label: "WRITE THE LABEL",
    plan: "CHOOSE THE SONGS",
    dub: `DUBBING SIDE ${tapeSide}`,
    flip: "END OF SIDE A",
    jcard: "MAKE THE J-CARD",
    sealed: "A GIFT, SEALED",
  };

  return (
    <div className={`dom-room ritual-room focus-${phase}`}>
      <div className="room-ceiling" />
      <div className="room-back">
        <div className="neon-sign">
          MIXTAPE STUDIO<small>TOKYO / 1994 / AFTER DARK</small>
        </div>
        <div className="wall-poster poster-one">
          <span>音</span>
          <b>
            NIGHT
            <br />
            FREQUENCY
          </b>
          <small>FM 84.7</small>
        </div>
        <div className="wall-poster poster-two">
          <b>
            MEMORIES
            <br />
            ON TAPE
          </b>
          <i>1994</i>
        </div>
        <div className="studio-shelf">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="room-floor" />
      <div className="room-desk" />
      <div className="studio-speaker speaker-left" aria-hidden="true">
        <i />
        <i />
        <span>MONITOR 01</span>
      </div>
      <div className="studio-speaker speaker-right" aria-hidden="true">
        <i />
        <i />
        <span>MONITOR 02</span>
      </div>
      <div className="desk-lamp" aria-hidden="true">
        <i />
        <span />
      </div>
      <div className="coiled-cable" aria-hidden="true" />

      <header className="ritual-hud">
        <span>STUDIO 01 · C60 · {phaseCopy[phase]}</span>
        <div>
          <i className={dubbingId ? "live" : ""} />
          {dubbingId
            ? sourcePlaying
              ? "RECORDING"
              : "THREADING LEADER"
            : "READY"}
          <button onClick={reset}>NEW TAPE</button>
        </div>
      </header>

      <section className="source-station" aria-label="Spotify 音源机">
        <div className="source-bezel">
          <header>
            <span>SPOTIFY SOURCE / LINE IN</span>
            <div>
              <i>
                {phase === "plan"
                  ? "SEARCH"
                  : activeTrack
                    ? sourceReady
                      ? "CUED"
                      : "LOADING"
                    : "IDLE"}
              </i>
              <a href="/api/auth/spotify">CONNECT</a>
            </div>
          </header>
          {phase === "plan" ? (
            <>
              <label className="source-search">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索 Spotify 歌曲或艺人"
                />
              </label>
              <div className="source-results">
                {searching ? (
                  <p>SEARCHING…</p>
                ) : (
                  results.map((track) => (
                    <button key={track.id} onClick={() => addTrack(track)}>
                      <Image src={track.image} alt="" width={42} height={42} />
                      <span>
                        <b>{track.title}</b>
                        <small>
                          {track.artist} · {formatTime(trackLength(track))}
                        </small>
                      </span>
                      <i>＋</i>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : activeTrack ? (
            <div className="source-player">
              <div className="source-now-playing">
                <Image src={activeTrack.image} alt="" width={48} height={48} />
                <span>
                  <small>
                    {dubbingId
                      ? sourcePlaying
                        ? "RECORDING FROM SOURCE"
                        : "THREADING LEADER · WAIT FOR SOUND…"
                      : sourceReady
                        ? "SOURCE READY"
                        : "LOADING SPOTIFY SOURCE…"}
                  </small>
                  <b>{activeTrack.title}</b>
                  <i>{activeTrack.artist}</i>
                </span>
              </div>
              <SpotifyEmbedPlayer
                key={`${activeTrack.id}-${sourceNonce}`}
                ref={playerRef}
                track={activeTrack}
                autoPlay={false}
                onReady={() => setSourceReady(true)}
                onPlaybackStarted={() => setSourcePlaying(true)}
                onPlaybackUpdate={(state) => {
                  if (dubbingId) {
                    setSourcePlaying(!state.isPaused && !state.isBuffering);
                  }
                }}
              />
            </div>
          ) : (
            <div className="source-idle">
              <Music2 size={24} />
              <span>{phase === "dub" ? "从右侧便笺选择 CUE" : "等待音源"}</span>
            </div>
          )}
        </div>
      </section>

      <section
        className={`ritual-deck ${dubbingId ? "is-recording" : ""}`}
        aria-label="中央卡带机"
      >
        <div className="ritual-deck-top">
          <span>M-60 MEMORY RECORDER</span>
          <i>TYPE I · NORMAL BIAS</i>
        </div>
        <div className={`cassette-bay ${flipping ? "is-flipping" : ""}`}>
          <div className="ritual-cassette">
            <div className="ritual-cassette-label">
              {phase === "label" ? (
                <div className="inline-label-form">
                  <label>
                    Title
                    <input
                      autoFocus
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Songs for when…"
                    />
                  </label>
                  <label>
                    For
                    <input
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      placeholder="Recipient"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <small>
                    {phase === "plan"
                      ? "MIXTAPE / SIDE A + B"
                      : `MIXTAPE / SIDE ${tapeSide}`}
                  </small>
                  <strong>{title || "UNTITLED MEMORY"}</strong>
                  <span>FOR {recipient || "________"}</span>
                </>
              )}
            </div>
            <div className="ritual-reels">
              <i />
              <span>
                {dubbingId
                  ? `REC ${formatTime(dubElapsedMs)}`
                  : phase === "plan"
                    ? `A ${sideBreak} · B ${tracks.length - sideBreak}`
                    : `SIDE ${tapeSide}`}
              </span>
              <i />
            </div>
          </div>
        </div>
        <div
          className="ritual-vu"
          aria-label="Spotify 播放活动指示，不代表真实分贝"
        >
          <i
            style={{
              width: `${dubbingId && sourcePlaying ? signalLevel : 8}%`,
            }}
          />
          <span>SPOTIFY</span>
          <span>SIGNAL</span>
          <span>ACTIVITY</span>
          <span>NOT dB</span>
        </div>
        <div className="ritual-counter">
          <span>{formatTime(tapeSide === "A" ? tape.usedA : tape.usedB)}</span>
          <i> / 30:00 · SIDE {tapeSide}</i>
        </div>
        <div className="ritual-controls">
          {phase === "label" && (
            <button
              className="primary-key"
              disabled={!title.trim() || !recipient.trim()}
              onClick={() => {
                sfx.insert();
                setPhase("plan");
              }}
            >
              INSERT TAPE
            </button>
          )}
          {phase === "plan" && (
            <button
              className="primary-key"
              disabled={
                !tracks.length || tape.allocations.some((item) => item.overflow)
              }
              onClick={() => {
                sfx.insert();
                setTapeSide("A");
                setPhase("dub");
              }}
            >
              START DUBBING
            </button>
          )}
          {phase === "dub" && (
            <>
              {nextAllocation ? (
                <>
                  <button
                    disabled={
                      Boolean(dubbingId) ||
                      (sourceReady &&
                        activeTrack?.id === nextAllocation.track.id)
                    }
                    onClick={() => cueTrack(nextAllocation.track)}
                  >
                    {dubbingId
                      ? "RECORDING"
                      : activeTrack?.id === nextAllocation.track.id
                        ? sourceReady
                          ? "SOURCE CUED"
                          : "RETRY CUE"
                        : "CUE SOURCE"}
                  </button>
                  <button
                    className="record-key"
                    disabled={
                      Boolean(dubbingId) ||
                      !sourceReady ||
                      activeTrack?.id !== nextAllocation.track.id
                    }
                    onClick={startDub}
                  >
                    {dubbingId
                      ? "RECORDING…"
                      : activeTrack?.id === nextAllocation.track.id &&
                          !sourceReady
                        ? "WAITING FOR SOURCE"
                        : "REC + PLAY"}
                  </button>
                  <button disabled={!dubbingId} onClick={stopDub}>
                    STOP · COMMIT FULL TRACK
                  </button>
                </>
              ) : tapeSide === "A" &&
                tape.allocations.some(
                  (item) =>
                    item.side === "B" && !recordedIds.includes(item.track.id),
                ) ? (
                <button className="flip-key" onClick={() => setPhase("flip")}>
                  FINISH SIDE A · EJECT
                </button>
              ) : (
                <button
                  className="primary-key"
                  onClick={() => setPhase("jcard")}
                >
                  CHECK TAPE · MAKE J-CARD
                </button>
              )}
            </>
          )}
          {phase === "flip" && (
            <button className="flip-key" onClick={flipTape}>
              <RotateCcw size={16} /> EJECT · FLIP TO SIDE B
            </button>
          )}
        </div>
      </section>

      <section
        className={`dub-sheet ${phase === "jcard" || phase === "sealed" ? "is-folded" : ""}`}
        aria-label="待录歌曲便笺"
      >
        <header>
          <div>
            <small>HANDWRITTEN DUB SHEET</small>
            <b>SIDE A / SIDE B</b>
          </div>
          <span>{tracks.length} SONGS</span>
        </header>
        <div className="capacity-lines">
          <span>
            <i
              style={{
                width: `${Math.min(100, (tape.usedA / SIDE_CAPACITY_MS) * 100)}%`,
              }}
            />
            A · {formatTime(tape.usedA)} / 30:00
          </span>
          <span>
            <i
              style={{
                width: `${Math.min(100, (tape.usedB / SIDE_CAPACITY_MS) * 100)}%`,
              }}
            />
            B · {formatTime(tape.usedB)} / 30:00
          </span>
        </div>
        <ol>
          {tape.allocations.length === 0 ? (
            <li className="sheet-empty">从左侧音源机挑歌，它们会先写在这里</li>
          ) : (
            tape.allocations.map(({ track, index, side }) => {
              const recorded = recordedIds.includes(track.id);
              const isNext =
                nextAllocation?.track.id === track.id && phase === "dub";
              return (
                <li
                  key={track.id}
                  className={`${recorded ? "recorded" : ""} ${isNext ? "next" : ""}`}
                >
                  <button
                    className="sheet-cue"
                    onClick={() => cueTrack(track)}
                    aria-label={`Cue ${track.title}`}
                  >
                    ▶
                  </button>
                  <span>
                    <button
                      className={`side-mark ${side === "B" ? "is-side-b" : ""}`}
                      disabled={phase !== "plan" || index === 0}
                      onClick={() => setSideBStart(index)}
                      aria-label={`从 ${track.title} 开始 SIDE B`}
                    >
                      {side}
                      {String(
                        side === "A" ? index + 1 : index - sideBreak + 1,
                      ).padStart(2, "0")}
                    </button>
                    <b>{track.title}</b>
                    <i>{formatTime(trackLength(track))}</i>
                  </span>
                  <input
                    aria-label={`${track.title} 的留言`}
                    value={track.note}
                    onChange={(event) =>
                      setTracks(
                        tracks.map((item) =>
                          item.id === track.id
                            ? { ...item, note: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="写一句话…"
                  />
                  <div className="sheet-actions">
                    <button
                      disabled={recorded}
                      aria-label="上移"
                      onClick={() => moveTrack(index, -1)}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      disabled={recorded}
                      aria-label="下移"
                      onClick={() => moveTrack(index, 1)}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      disabled={recorded}
                      aria-label="删除"
                      onClick={() =>
                        setTracks(tracks.filter((item) => item.id !== track.id))
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {recorded && <em>RECORDED</em>}
                </li>
              );
            })
          )}
        </ol>
        {phase === "plan" && (
          <p>
            点击曲目前的 A/B 编号，可以决定从哪一首开始 SIDE B；然后再开始录音。
          </p>
        )}
      </section>

      <section
        className={`jcard-station ${phase === "jcard" ? "active" : ""}`}
        aria-label="J-card 制作台"
      >
        <div className="jcard-paper">
          <div
            className="jcard-cover"
            style={{
              backgroundImage: `linear-gradient(rgba(18,20,16,.08),rgba(18,20,16,.35)),url(${cover})`,
            }}
          >
            <small>FOR {recipient || "YOU"}</small>
            <strong>{title || "UNTITLED MEMORY"}</strong>
          </div>
          {phase === "jcard" && (
            <div className="jcard-fields">
              <label>
                写给对方的话
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Little moments from our summer…"
                />
              </label>
              <label>
                封面图片 URL
                <input
                  value={cover}
                  onChange={(event) => setCover(event.target.value)}
                />
              </label>
              <button onClick={publish}>
                <PackageCheck size={16} /> FOLD J-CARD & CLOSE CASE
              </button>
            </div>
          )}
        </div>
      </section>

      {phase === "flip" && (
        <div className="ritual-hint">A 面录完了 · 弹出卡带并翻到 B 面</div>
      )}
      {phase === "jcard" && (
        <div className="ritual-hint">录音检查完成 · 在右侧完成包装</div>
      )}

      {phase === "sealed" && (
        <section className="sealed-case">
          <div className="case-lid">
            <Check size={22} />
            <small>MADE FOR {recipient.toUpperCase()}</small>
            <h1>{title}</h1>
            <span>{tracks.length} SONGS · SIDE A / SIDE B</span>
          </div>
          <div className="sealed-actions">
            <a href="/mixtape/my-mixtape">OPEN THE GIFT ↗</a>
            <button onClick={reset}>MAKE ANOTHER</button>
          </div>
        </section>
      )}

      <div className="scanlines pointer-events-none absolute inset-0" />
    </div>
  );
}
