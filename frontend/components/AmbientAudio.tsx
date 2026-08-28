"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const AUDIO_SRC = "/audio/ambient_terminal_preview.wav";
const DEFAULT_VOLUME = 0.18;

type UiSound = "hover" | "click";

export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const lastHoverAt = useRef(0);
  const lastClickAt = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = DEFAULT_VOLUME;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function getAudioContext() {
    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      contextRef.current = new AudioContextClass();
    }
    if (contextRef.current.state === "suspended") void contextRef.current.resume();
    return contextRef.current;
  }

  function playUiSound(kind: UiSound) {
    const now = performance.now();
    const lastPlayed = kind === "hover" ? lastHoverAt : lastClickAt;
    const cooldown = kind === "hover" ? 70 : 35;
    if (now - lastPlayed.current < cooldown) return;
    lastPlayed.current = now;

    const context = getAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const duration = kind === "hover" ? 0.055 : 0.105;
    const baseFrequency = kind === "hover" ? 1180 : 690;
    const peakGain = Math.max(0.006, volumeRef.current * (kind === "hover" ? 0.045 : 0.075));

    oscillator.type = kind === "hover" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(baseFrequency, start);
    if (kind === "click") oscillator.frequency.exponentialRampToValueAtTime(520, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    function isInteractiveButton(target: EventTarget | null): target is HTMLButtonElement {
      return target instanceof HTMLElement && Boolean(target.closest("button, [role=button]"));
    }

    function handlePointerOver(event: PointerEvent) {
      const button = isInteractiveButton(event.target) ? event.target.closest("button, [role=button]") : null;
      if (!(button instanceof HTMLElement) || button.getAttribute("aria-disabled") === "true") return;
      if (button instanceof HTMLButtonElement && button.disabled) return;
      const related = event.relatedTarget;
      if (related instanceof Node && button.contains(related)) return;
      playUiSound("hover");
    }

    function handleClick(event: MouseEvent) {
      const button = isInteractiveButton(event.target) ? event.target.closest("button, [role=button]") : null;
      if (!(button instanceof HTMLElement) || button.getAttribute("aria-disabled") === "true") return;
      if (button instanceof HTMLButtonElement && button.disabled) return;
      playUiSound("click");
    }

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  async function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    if (enabled) {
      audio.pause();
      setEnabled(false);
      setBlocked(false);
      return;
    }

    try {
      getAudioContext();
      await audio.play();
      setEnabled(true);
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  }

  return (
    <div className="ambient-audio" aria-label="Ambient sound controls">
      <button
        type="button"
        className={`ambient-audio-toggle${enabled ? " is-on" : ""}`}
        onClick={() => void toggleAudio()}
        aria-pressed={enabled}
        aria-label={enabled ? "Mute ambient sound" : "Play ambient sound"}
        title={blocked ? "Click to allow ambient sound" : undefined}
      >
        <span className="ambient-audio-bars" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <span>{enabled ? "Sound on" : "Sound off"}</span>
      </button>
      {enabled && (
        <label className="ambient-audio-volume">
          <input
            type="range"
            min="0"
            max="0.4"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            style={{ "--slider-fill": `${(volume / 0.4) * 100}%` } as CSSProperties}
            aria-label="Ambient sound volume"
          />
        </label>
      )}
      {blocked && <span className="ambient-audio-hint">Click to enable</span>}
    </div>
  );
}
