import { createAudioEngine, type AudioEngine } from "./audioEngine";

let engine: AudioEngine | null = null;

/**
 * The page's one sound engine, created on first use in the browser (never during server
 * rendering: only event handlers, effects and the toggle's store subscription call this).
 * Creating it is cheap: no AudioContext exists until the visitor turns sound on.
 */
export function getSound(): AudioEngine {
  engine ??= createAudioEngine();
  return engine;
}
