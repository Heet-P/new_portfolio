import { createScheduler, type Scheduler } from "./scheduler";
import {
  BASS,
  CHIME,
  CHORDS,
  CLACK,
  DRUMS,
  KEYS,
  MIX,
  MUSIC_FILTER,
  PARAM_EPSILON,
  RAIN,
  REDUCED_MOTION_DEPTH,
  REVERB,
  RUMBLE,
  RUSTLE,
  STAMP,
  TAP,
  TEMPO,
  TUNNEL,
  VINYL,
  WOW,
} from "./soundDesign";

/**
 * The whole sound world as one Web Audio graph, built once when the visitor first turns
 * sound on. Every sound is synthesized: noise and impulse-response buffers are generated
 * here (once), voices are oscillators and filtered noise. All numbers live in soundDesign.ts.
 *
 *   music:    keys + bass + drums -> lowpass (muffled) -> music bus ----> master -> speakers
 *             vinyl crackle -------------------------> music bus      |
 *                                     lowpass -> reverb send -> room --+
 *   ambience: rain, rumble + hum, clacks -> tunnel lowpass -> ambience bus -> master
 *                                                 \-> reverb send (more in tunnels) -> room
 *   cues:     chime, tap, rustle, stamp -> ui bus -> master (chime also -> room)
 *
 * The master starts silent; audioEngine.ts fades it in and out.
 */
export interface SoundGraph {
  /** The fader straight to the speakers (0 = silent). */
  master: GainNode;
  /** Music track + rail clacks + rain drops, on the audio clock. */
  scheduler: Scheduler;
  setSpeed(v: number): void;
  setRain(v: number): void;
  setTunnel(v: number): void;
  chime(): void;
  tap(): void;
  rustle(): void;
  stamp(): void;
}

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** One second-ish of plain white noise, mono. */
function whiteNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Pink-ish noise (Paul Kellet's economy filter over white noise): soft, even, rain-like. */
function pinkNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  fadeLoopEnds(d, ctx.sampleRate);
  return buf;
}

/** Brown (red) noise: integrated white noise, all low end; the body of the rumble. */
function brownNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  fadeLoopEnds(d, ctx.sampleRate);
  return buf;
}

/**
 * Crossfade the last 50 ms of a looped buffer into its first 50 ms, so the loop point has no
 * click (the sample before the wrap lands right next to the one after it).
 */
function fadeLoopEnds(d: Float32Array, rate: number) {
  const n = Math.min(Math.floor(rate * 0.05), Math.floor(d.length / 4));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const j = d.length - n + i;
    d[j] = d[j] * (1 - t) + d[i] * t;
  }
}

/** A looped stretch of vinyl: faint dark hiss, sparse soft clicks, the odd pop. */
function vinylCrackle(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.round(rate * VINYL.seconds), rate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < d.length; i++) {
    lp = lp * VINYL.bedDark + (Math.random() * 2 - 1) * (1 - VINYL.bedDark);
    d[i] = lp * VINYL.bed * 4;
  }
  // A click is a few samples of decaying impulse (rounded: never a single-sample spike).
  const click = (at: number, size: number) => {
    const sign = Math.random() < 0.5 ? -1 : 1;
    const len = 4 + Math.floor(Math.random() * 10);
    for (let k = 0; k < len && at + k < d.length; k++) d[at + k] += sign * size * Math.exp(-k / (len / 3)) * (k === 0 ? 0.5 : 1);
  };
  const clicks = Math.round(VINYL.clicksPerSecond * VINYL.seconds);
  for (let c = 0; c < clicks; c++) click(Math.floor(Math.random() * d.length), rand(VINYL.clickMin, VINYL.clickMax));
  const pops = Math.max(1, Math.round(VINYL.popsPerSecond * VINYL.seconds));
  for (let c = 0; c < pops; c++) click(Math.floor(Math.random() * d.length), VINYL.pop);
  fadeLoopEnds(d, rate);
  return buf;
}

/**
 * The room's impulse response: stereo noise with an exponential decay to -60 dB over
 * REVERB.seconds, low-passed more and more along the tail (real rooms lose the highs first).
 */
function impulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const pre = Math.floor(REVERB.preDelay * rate);
  const len = pre + Math.floor(REVERB.seconds * rate);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const dark = lerp(REVERB.darkStart, REVERB.darkEnd, t);
      lp = lp * dark + (Math.random() * 2 - 1) * (1 - dark);
      // e^-6.9 = -60 dB at the end of the tail.
      d[i] = lp * Math.exp(-6.9 * t) * 2;
    }
  }
  return buf;
}

export function buildGraph(ctx: AudioContext, opts: { reducedMotion: boolean }): SoundGraph {
  const depth = opts.reducedMotion ? REDUCED_MOTION_DEPTH : 1;

  const gain = (value: number, to?: AudioNode) => {
    const g = ctx.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  };
  const filter = (type: BiquadFilterType, freq: number, Q: number, to?: AudioNode) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    if (to) f.connect(to);
    return f;
  };
  const loop = (buffer: AudioBuffer, to: AudioNode) => {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.connect(to);
    // Random start point so the loops never line up the same way twice.
    s.start(0, Math.random() * buffer.duration);
    return s;
  };

  /* ---- buses ---- */
  const master = gain(0, ctx.destination);
  const room = ctx.createConvolver();
  room.buffer = impulseResponse(ctx);
  room.connect(gain(MIX.reverbReturn, master));

  const musicBus = gain(MIX.music, master);
  const musicFilter = filter("lowpass", MUSIC_FILTER.cutoff, MUSIC_FILTER.Q, musicBus);
  musicFilter.connect(gain(MIX.musicReverbSend, room));
  /** Every musical voice goes in here (through the muffling lowpass). */
  const musicIn = gain(1, musicFilter);

  const ambienceBus = gain(MIX.ambience, master);
  const tunnelFilter = filter("lowpass", TUNNEL.openCutoff, 0.5, ambienceBus);
  const ambienceSend = gain(TUNNEL.reverbOpen, room);
  tunnelFilter.connect(ambienceSend);

  const uiBus = gain(MIX.ui, master);
  const chimeSend = gain(CHIME.reverb, room);

  /* ---- shared material ---- */
  const white = whiteNoise(ctx, 2);

  /** Tape wow: one slow LFO, connected to each keys/bass oscillator's detune while it plays. */
  const wow = ctx.createOscillator();
  wow.frequency.value = WOW.rate;
  const wowDepth = gain(WOW.depth);
  wow.connect(wowDepth);
  wow.start();

  /** A musical oscillator with tape wow and a fixed detune; unhooks itself from the LFO when done. */
  const toneOsc = (type: OscillatorType, freq: number, detune: number, to: AudioNode, when: number, end: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    wowDepth.connect(o.detune);
    o.onended = () => {
      try {
        wowDepth.disconnect(o.detune);
      } catch {
        // Already gone (the context was closed): nothing to unhook.
      }
    };
    o.connect(to);
    o.start(when);
    o.stop(end);
    return o;
  };

  /** A burst of band-passed noise with a soft envelope, from a random spot in the noise buffer. */
  const noiseHit = (
    when: number,
    p: { type: BiquadFilterType; freq: number; Q: number; level: number; attack: number; decay: number; length: number },
    to: AudioNode,
  ) => {
    const src = ctx.createBufferSource();
    src.buffer = white;
    const f = filter(p.type, p.freq, p.Q);
    const g = gain(0, to);
    src.connect(f);
    f.connect(g);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(p.level, when + p.attack);
    g.gain.setTargetAtTime(0, when + p.attack, p.decay);
    src.start(when, Math.random() * (white.duration - p.length - 0.05), p.length + 0.05);
  };

  /* ---- music voices ---- */

  const keysNote = (midi: number, when: number, dur: number, vel: number) => {
    const peak = KEYS.level * vel;
    const end = when + dur + KEYS.release * 6;
    const env = gain(0, musicIn);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + KEYS.attack);
    env.gain.setTargetAtTime(peak * KEYS.sustain, when + KEYS.attack, KEYS.decay);
    env.gain.setTargetAtTime(0, when + dur, KEYS.release);
    const f = midiHz(midi);
    const detune = rand(-KEYS.detuneSpread, KEYS.detuneSpread);
    toneOsc("sine", f, detune, env, when, end);
    toneOsc("triangle", f, detune + KEYS.triangleDetune, gain(KEYS.triangleLevel, env), when, end);
    // The tine: two octaves up, gone in a blink: the "electric piano" bite, kept soft.
    const tine = gain(0, musicIn);
    tine.gain.setValueAtTime(0, when);
    tine.gain.linearRampToValueAtTime(KEYS.tineLevel * vel, when + 0.004);
    tine.gain.setTargetAtTime(0, when + 0.004, KEYS.tineDecay);
    toneOsc("sine", f * 4, detune, tine, when, when + KEYS.tineDecay * 8);
  };

  /** Strum a chord: notes land a few ms apart, up or down, each at its own velocity. */
  const strum = (notes: readonly number[], when: number, dur: number, velScale: number) => {
    const gap = rand(KEYS.strumMin, KEYS.strumMax);
    const up = Math.random() < 0.7;
    notes.forEach((n, i) => {
      const k = up ? i : notes.length - 1 - i;
      keysNote(n, when + k * gap, dur - k * gap, velScale * rand(KEYS.velocityMin, KEYS.velocityMax));
    });
  };

  const bassLowpass = filter("lowpass", BASS.cutoff, 0.7, musicIn);
  const bassNote = (midi: number, when: number, vel: number) => {
    const end = when + BASS.decay * 7;
    const env = gain(0, bassLowpass);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(BASS.level * vel, when + BASS.attack);
    env.gain.setTargetAtTime(0, when + BASS.attack, BASS.decay);
    const f = midiHz(midi);
    toneOsc("sine", f, 0, env, when, end);
    toneOsc("triangle", f, 3, gain(BASS.triangleLevel, env), when, end);
  };

  const drumBus = gain(1, musicIn);
  const kick = (when: number, vel: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(DRUMS.kickFrom, when);
    o.frequency.exponentialRampToValueAtTime(DRUMS.kickTo, when + DRUMS.kickDrop);
    const env = gain(0, drumBus);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(DRUMS.kickLevel * vel, when + 0.005);
    env.gain.setTargetAtTime(0, when + 0.005, DRUMS.kickDecay);
    o.connect(env);
    o.start(when);
    o.stop(when + DRUMS.kickDecay * 8);
  };
  const snare = (when: number, vel: number) =>
    noiseHit(
      when,
      { type: "bandpass", freq: DRUMS.snareFreq, Q: DRUMS.snareQ, level: DRUMS.snareLevel * vel, attack: DRUMS.snareAttack, decay: DRUMS.snareDecay, length: 0.35 },
      drumBus,
    );
  const hat = (when: number, vel: number) =>
    noiseHit(
      when,
      { type: "bandpass", freq: DRUMS.hatFreq, Q: DRUMS.hatQ, level: DRUMS.hatLevel * vel, attack: 0.002, decay: DRUMS.hatDecay, length: 0.15 },
      drumBus,
    );

  /* ---- the music track: one call per swung 8th note ---- */
  const beat = 60 / TEMPO.bpm;
  const bar = beat * 4;
  let step = 0;
  let restrike = false;
  let dropIndex = -1;
  /**
   * `when` nudged by a few ms of timing slop, never before 0: right after the context is
   * created the clock is ~0, and Web Audio throws on a negative time (which used to break the
   * Sound toggle's first click now and then).
   */
  const humanize = (when: number) => Math.max(0, when + rand(-TEMPO.humanize, TEMPO.humanize));
  const musicTrack = (when: number) => {
    const pos = step % 8;
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    if (pos === 0) {
      // New bar: decide this bar's small variations so no two passes of the loop match.
      restrike = Math.random() < KEYS.restrikeChance;
      dropIndex = Math.random() < KEYS.dropNoteChance ? 1 + Math.floor(Math.random() * (chord.voicing.length - 2)) : -1;
      const notes = chord.voicing.filter((_, i) => i !== dropIndex);
      strum(notes, when, bar - 0.05, 1);
      bassNote(chord.bass, when, 1);
    }
    // "3-and": a lighter re-strike of the top two notes, now and then.
    if (pos === 5 && restrike) strum(chord.voicing.slice(-2), when, beat * 1.4, 0.55);
    if (pos === 3 && Math.random() < BASS.pickupChance) bassNote(chord.bass, when, 0.55);
    if (pos === 7 && Math.random() < BASS.fifthChance) bassNote(chord.bass + 7, when, 0.6);
    if (Math.random() < DRUMS.kick[pos]) kick(humanize(when), pos === 0 ? 1 : 0.75);
    if (Math.random() < DRUMS.snare[pos]) snare(humanize(when), pos === 7 ? 0.35 : rand(0.85, 1));
    if (Math.random() < DRUMS.hat[pos]) hat(humanize(when), (pos % 2 === 0 ? DRUMS.hatAccent : DRUMS.hatOffbeat) * rand(0.7, 1));
    step++;
    // Swing: the on-beat 8th is longer than the off-beat one.
    return pos % 2 === 0 ? beat * TEMPO.swing : beat * (1 - TEMPO.swing);
  };

  /* ---- always-on loops ---- */
  const vinylGain = gain(VINYL.level, musicBus);
  loop(vinylCrackle(ctx), filter("lowpass", VINYL.cutoff, 0.5, vinylGain));

  const rainGain = gain(0, tunnelFilter);
  loop(pinkNoise(ctx, 6), filter("highpass", RAIN.highpass, 0.5, filter("lowpass", RAIN.lowpass, 0.5, rainGain)));
  const dropsBus = gain(1, tunnelFilter);

  const rumbleGain = gain(RUMBLE.idle, tunnelFilter);
  const rumbleFilter = filter("lowpass", RUMBLE.cutoffIdle, 0.7, rumbleGain);
  loop(brownNoise(ctx, 6), rumbleFilter);
  const humGain = gain(RUMBLE.humLevelIdle, tunnelFilter);
  const hum = ctx.createOscillator();
  hum.frequency.value = RUMBLE.humFreqIdle;
  hum.connect(humGain);
  hum.start();
  const humOctave = ctx.createOscillator();
  humOctave.frequency.value = RUMBLE.humFreqIdle * 2;
  humOctave.connect(gain(RUMBLE.humOctaveLevel, humGain));
  humOctave.start();

  /* ---- scene-driven state ---- */
  const scene = { speed: 0, rain: 0, tunnel: 0 };
  const applied = { speed: -1, rain: -1, tunnel: -1 };
  const changed = (key: keyof typeof scene) => {
    const v = scene[key];
    if (Math.abs(v - applied[key]) < PARAM_EPSILON && !(v === 0 && applied[key] !== 0)) return false;
    applied[key] = v;
    return true;
  };

  const applyMotion = () => {
    const t = ctx.currentTime;
    const s = scene.speed * depth;
    const boost = lerp(1, TUNNEL.rumbleBoost, scene.tunnel);
    rumbleGain.gain.setTargetAtTime(lerp(RUMBLE.idle, RUMBLE.full, s) * boost, t, RUMBLE.smoothing);
    rumbleFilter.frequency.setTargetAtTime(lerp(RUMBLE.cutoffIdle, RUMBLE.cutoffFull, s), t, RUMBLE.smoothing);
    humGain.gain.setTargetAtTime(lerp(RUMBLE.humLevelIdle, RUMBLE.humLevelFull, s), t, RUMBLE.smoothing);
    const hz = lerp(RUMBLE.humFreqIdle, RUMBLE.humFreqFull, s);
    hum.frequency.setTargetAtTime(hz, t, RUMBLE.smoothing * 2);
    humOctave.frequency.setTargetAtTime(hz * 2, t, RUMBLE.smoothing * 2);
  };
  const applyWeather = () => {
    const t = ctx.currentTime;
    const k = scene.tunnel;
    rainGain.gain.setTargetAtTime(RAIN.level * scene.rain * lerp(1, RAIN.inTunnel, k), t, 0.5);
    // Exponential between the two cutoffs: an even darkening to the ear.
    tunnelFilter.frequency.setTargetAtTime(TUNNEL.openCutoff * Math.pow(TUNNEL.closedCutoff / TUNNEL.openCutoff, k), t, 0.2);
    ambienceSend.gain.setTargetAtTime(lerp(TUNNEL.reverbOpen, TUNNEL.reverbClosed, k), t, 0.3);
  };

  /* ---- rail clacks and rain drops, scheduled like the music ---- */
  const thump = (when: number, level: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(CLACK.freqFrom, when);
    o.frequency.exponentialRampToValueAtTime(CLACK.freqTo, when + CLACK.decay * 2);
    const env = gain(0, tunnelFilter);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(level, when + 0.004);
    env.gain.setTargetAtTime(0, when + 0.004, CLACK.decay);
    o.connect(env);
    o.start(when);
    o.stop(when + CLACK.decay * 8);
    noiseHit(
      when,
      { type: "lowpass", freq: CLACK.knockCutoff, Q: 0.7, level: level * CLACK.knockLevel, attack: 0.003, decay: CLACK.decay * 0.7, length: 0.12 },
      tunnelFilter,
    );
  };
  const clackTrack = (when: number) => {
    const s = scene.speed;
    if (s < CLACK.minSpeed) return 0.15; // parked: just check again soon
    const level = CLACK.level * Math.pow(s, 0.7) * depth;
    thump(when, level * rand(1 - CLACK.jitter, 1 + CLACK.jitter));
    thump(when + CLACK.pairGap, level * 0.85 * rand(1 - CLACK.jitter, 1 + CLACK.jitter));
    return Math.max(CLACK.minInterval, CLACK.interval / s);
  };

  const drop = (when: number, level: number) => {
    const o = ctx.createOscillator();
    const f = rand(RAIN.dropFreqMin, RAIN.dropFreqMax);
    o.frequency.setValueAtTime(f, when);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, when + 0.03);
    const env = gain(0, dropsBus);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(level, when + 0.002);
    env.gain.setTargetAtTime(0, when + 0.002, 0.015);
    o.connect(env);
    o.start(when);
    o.stop(when + 0.12);
  };
  const dropTrack = (when: number) => {
    const amount = scene.rain * lerp(1, RAIN.inTunnel, scene.tunnel);
    if (amount < 0.02) return 0.25;
    drop(when, RAIN.dropLevel * amount * rand(0.4, 1));
    // Random (Poisson) gaps: rain has no rhythm.
    return Math.min(4, Math.max(0.05, -Math.log(1 - Math.random()) / (RAIN.dropsPerSecond * amount)));
  };

  const scheduler = createScheduler(() => ctx.currentTime);
  scheduler.add(musicTrack);
  scheduler.add(clackTrack);
  scheduler.add(dropTrack);

  /* ---- one-off cues ---- */
  let lastTap = -1;
  let lastStamp = -1;

  return {
    master,
    scheduler,
    setSpeed(v) {
      scene.speed = v;
      if (changed("speed")) applyMotion();
    },
    setRain(v) {
      scene.rain = v;
      if (changed("rain")) applyWeather();
    },
    setTunnel(v) {
      scene.tunnel = v;
      if (changed("tunnel")) {
        applyWeather();
        applyMotion();
      }
    },
    chime() {
      const t0 = ctx.currentTime + 0.03;
      const out = gain(1, uiBus);
      out.connect(chimeSend);
      CHIME.notes.forEach((n, i) => {
        const when = t0 + i * CHIME.spacing;
        for (const p of CHIME.partials) {
          const o = ctx.createOscillator();
          o.frequency.value = midiHz(n) * p.ratio;
          const env = gain(0, out);
          env.gain.setValueAtTime(0, when);
          env.gain.linearRampToValueAtTime(CHIME.level * p.level, when + CHIME.attack);
          env.gain.setTargetAtTime(0, when + CHIME.attack, p.decay);
          o.connect(env);
          o.start(when);
          o.stop(when + p.decay * 8);
        }
      });
    },
    tap() {
      const when = ctx.currentTime + 0.005;
      if (when - lastTap < TAP.minGap) return;
      lastTap = when;
      const freq = TAP.freq * rand(1 - TAP.freqJitter, 1 + TAP.freqJitter);
      noiseHit(
        when,
        { type: "bandpass", freq, Q: TAP.Q, level: TAP.level, attack: TAP.attack, decay: TAP.decay, length: TAP.length },
        filter("lowpass", TAP.lowpass, 0.5, uiBus),
      );
      // A tiny low "body" under the tap: paper on a table, not a click.
      const o = ctx.createOscillator();
      o.frequency.value = TAP.bodyFreq;
      const env = gain(0, uiBus);
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(TAP.bodyLevel, when + 0.003);
      env.gain.setTargetAtTime(0, when + 0.003, TAP.decay);
      o.connect(env);
      o.start(when);
      o.stop(when + TAP.length);
    },
    rustle() {
      const t0 = ctx.currentTime + 0.01;
      const out = filter("lowpass", RUSTLE.lowpass, 0.5, uiBus);
      for (let i = 0; i < RUSTLE.grains; i++) {
        noiseHit(
          t0 + Math.random() * RUSTLE.spread,
          {
            type: "bandpass",
            freq: rand(RUSTLE.freqMin, RUSTLE.freqMax),
            Q: RUSTLE.Q,
            level: rand(RUSTLE.levelMin, RUSTLE.levelMax),
            attack: rand(RUSTLE.attackMin, RUSTLE.attackMax),
            decay: rand(RUSTLE.decayMin, RUSTLE.decayMax),
            length: 0.3,
          },
          out,
        );
      }
    },
    stamp() {
      const when = ctx.currentTime + 0.005;
      if (when - lastStamp < STAMP.minGap) return;
      lastStamp = when;
      // The thud: a dull burst of low-passed noise (felt more than heard).
      noiseHit(
        when,
        { type: "lowpass", freq: STAMP.lowpass, Q: 0.7, level: STAMP.level, attack: STAMP.attack, decay: STAMP.decay, length: STAMP.length },
        uiBus,
      );
      // The body: a low sine that sags in pitch as the stamp presses down.
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(STAMP.bodyFreq, when);
      o.frequency.exponentialRampToValueAtTime(STAMP.bodyFreqTo, when + STAMP.bodyDecay * 2);
      const env = gain(0, uiBus);
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(STAMP.bodyLevel, when + STAMP.attack);
      env.gain.setTargetAtTime(0, when + STAMP.attack, STAMP.bodyDecay);
      o.connect(env);
      o.start(when);
      o.stop(when + STAMP.length);
    },
  };
}
