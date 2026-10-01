"use client";

import type { SimonColor } from "@simon/shared-types";
import { useCallback, useEffect, useRef } from "react";

const FREQUENCIES: Record<SimonColor, number> = {
  green: 329.63,
  red: 261.63,
  yellow: 392,
  blue: 196,
};

export function useSimonAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
    },
    [],
  );

  return useCallback((color: SimonColor, duration = 0.22) => {
    const context = audioContextRef.current ?? new window.AudioContext();
    audioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(FREQUENCIES[color], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }, []);
}
