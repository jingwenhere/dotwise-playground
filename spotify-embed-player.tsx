"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Track } from "@/lib/types";

type EmbedController = {
  play: () => void | Promise<void>;
  pause: () => void | Promise<void>;
  destroy: () => void;
  addListener: (
    event: string,
    callback: (event: { data: Record<string, unknown> }) => void,
  ) => void;
};

export type SpotifyPlaybackState = {
  playingURI?: string;
  isPaused: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { width: string; height: number; uri: string },
    callback: (controller: EmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;

function loadSpotifyApi() {
  if (spotifyApiPromise) return spotifyApiPromise;
  spotifyApiPromise = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    if (!document.querySelector('script[data-mixtape-spotify-api="true"]')) {
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.dataset.mixtapeSpotifyApi = "true";
      document.body.appendChild(script);
    }
  });
  return spotifyApiPromise;
}

export type SpotifyEmbedHandle = {
  play: () => void;
  pause: () => void;
};

export const SpotifyEmbedPlayer = forwardRef<
  SpotifyEmbedHandle,
  {
    track: Track;
    autoPlay?: boolean;
    onReady?: () => void;
    onPlaybackStarted?: () => void;
    onPlaybackUpdate?: (state: SpotifyPlaybackState) => void;
  }
>(function SpotifyEmbedPlayer(
  { track, autoPlay = true, onReady, onPlaybackStarted, onPlaybackUpdate },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  const onReadyRef = useRef(onReady);
  const autoPlayRef = useRef(autoPlay);
  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onPlaybackUpdateRef = useRef(onPlaybackUpdate);
  const [ready, setReady] = useState(false);
  onReadyRef.current = onReady;
  autoPlayRef.current = autoPlay;
  onPlaybackStartedRef.current = onPlaybackStarted;
  onPlaybackUpdateRef.current = onPlaybackUpdate;

  useImperativeHandle(ref, () => ({
    play: () => void controllerRef.current?.play(),
    pause: () => void controllerRef.current?.pause(),
  }));

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadSpotifyApi().then((api) => {
      if (cancelled || !hostRef.current) return;
      hostRef.current.replaceChildren();
      api.createController(
        hostRef.current,
        {
          width: "100%",
          height: 152,
          uri: `spotify:track:${track.spotify_track_id}`,
        },
        (controller) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          controllerRef.current = controller;
          controller.addListener("ready", () => {
            setReady(true);
            onReadyRef.current?.();
            if (autoPlayRef.current) void controller.play();
          });
          controller.addListener("playback_started", () => {
            onPlaybackStartedRef.current?.();
          });
          controller.addListener("playback_update", (event) => {
            onPlaybackUpdateRef.current?.(
              event.data as unknown as SpotifyPlaybackState,
            );
          });
        },
      );
    });
    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [track.spotify_track_id]);

  return (
    <div className="spotify-embed-shell">
      <div className="spotify-embed-host" ref={hostRef} />
      <button
        className="spotify-play-tape"
        disabled={!ready}
        onClick={() => void controllerRef.current?.play()}
      >
        {ready ? "▶ PLAY TAPE" : "LOADING PLAYER…"}
      </button>
    </div>
  );
});
