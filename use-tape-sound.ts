"use client";

import { useEffect, useRef } from "react";

type Motor = { oscillator: OscillatorNode; gain: GainNode };

export function useTapeSound() {
  const contextRef = useRef<AudioContext | null>(null);
  const motorRef = useRef<Motor | null>(null);

  useEffect(
    () => () => {
      try {
        motorRef.current?.oscillator.stop();
      } catch {}
      motorRef.current = null;
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  const context = () => {
    const AudioContextClass = window.AudioContext;
    const audio = contextRef.current || new AudioContextClass();
    contextRef.current = audio;
    if (audio.state === "suspended") void audio.resume();
    return audio;
  };

  const tone = (frequency: number, duration: number, volume = 0.08) => {
    const audio = context();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audio.currentTime + duration,
    );
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  };

  const noise = (duration: number, volume = 0.05) => {
    const audio = context();
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audio.currentTime + duration,
    );
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  };

  return {
    click() {
      tone(150, 0.045, 0.045);
    },
    paper() {
      noise(0.12, 0.035);
      tone(430, 0.035, 0.02);
    },
    print() {
      tone(95, 0.07, 0.05);
      window.setTimeout(() => tone(130, 0.06, 0.045), 80);
      window.setTimeout(() => noise(0.16, 0.03), 150);
    },
    insert() {
      tone(82, 0.1, 0.09);
      window.setTimeout(() => tone(165, 0.05, 0.055), 90);
    },
    flip() {
      noise(0.18, 0.055);
      window.setTimeout(() => tone(105, 0.07, 0.06), 110);
    },
    lever() {
      tone(72, 0.15, 0.12);
      noise(0.1, 0.04);
      window.setTimeout(() => tone(48, 0.18, 0.07), 130);
    },
    mastered() {
      noise(0.35, 0.025);
      tone(220, 0.18, 0.055);
      window.setTimeout(() => tone(330, 0.24, 0.045), 170);
    },
    motorStart() {
      if (motorRef.current) return;
      const audio = context();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 42;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.028, audio.currentTime + 0.08);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      motorRef.current = { oscillator, gain };
    },
    motorStop() {
      const motor = motorRef.current;
      if (!motor) return;
      const audio = context();
      motor.gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audio.currentTime + 0.08,
      );
      motor.oscillator.stop(audio.currentTime + 0.1);
      motorRef.current = null;
      tone(65, 0.08, 0.04);
    },
  };
}
