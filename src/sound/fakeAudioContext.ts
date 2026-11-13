/**
 * A tiny stand-in for the Web Audio API, for tests only (jsdom has no AudioContext).
 *
 * It implements just the slice the engine uses and records what matters to the tests:
 * which nodes are connected to the destination, every AudioParam's latest *target* (a ramp
 * or setTarget jumps `value` straight to where it is heading), and how many sources were made.
 * Time comes from Date.now(), so vitest's fake timers move the audio clock too.
 */

/** Browsers throw a RangeError for automation scheduled before time 0; so does the fake. */
function checkTime(t: number) {
  if (!Number.isFinite(t) || t < 0) throw new RangeError(`Time must be a finite non-negative number: ${t}`);
}

class FakeParam {
  value: number;
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(v: number, t: number) {
    checkTime(t);
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    checkTime(t);
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    checkTime(t);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    checkTime(t);
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  /** Nodes connected into this one (only tracked for the destination). */
  sources: FakeNode[] = [];
  constructor(readonly ctx: FakeAudioContext) {}
  connect<T>(dest: T): T {
    if (dest instanceof FakeNode) dest.sources.push(this);
    return dest;
  }
  disconnect() {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
}

class FakeDelay extends FakeNode {
  delayTime = new FakeParam(0);
}

class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
  normalize = true;
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  started = false;
  start() {
    this.started = true;
  }
  stop() {}
}

class FakeOscillator extends FakeSource {
  type = "sine";
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
}

class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  playbackRate = new FakeParam(1);
}

class FakeBuffer {
  private readonly data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(c: number) {
    return this.data[c];
  }
}

export class FakeAudioContext {
  /** Low rate: the engine generates its noise/impulse buffers once, and tests stay fast. */
  readonly sampleRate = 8000;
  state: "running" | "suspended" | "closed" = "running";
  readonly destination = new FakeNode(this);
  /** How many sound sources (oscillators + buffer sources) have been created. */
  sourceCount = 0;
  private readonly t0 = Date.now();

  get currentTime() {
    return (Date.now() - this.t0) / 1000;
  }

  /** The gain node wired straight to the speakers: the engine's master fader. */
  master(): FakeGain {
    return this.destination.sources[0] as FakeGain;
  }

  createGain() {
    return new FakeGain(this);
  }
  createBiquadFilter() {
    return new FakeFilter(this);
  }
  createDelay() {
    return new FakeDelay(this);
  }
  createConvolver() {
    return new FakeConvolver(this);
  }
  createOscillator() {
    this.sourceCount++;
    return new FakeOscillator(this);
  }
  createBufferSource() {
    this.sourceCount++;
    return new FakeBufferSource(this);
  }
  createBuffer(channels: number, length: number, rate: number) {
    return new FakeBuffer(channels, length, rate);
  }
  resume() {
    if (this.state !== "closed") this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    if (this.state !== "closed") this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

/** An in-memory Storage. */
export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

/** A Storage that throws on every access, like some private-browsing modes. */
export function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException("denied", "SecurityError");
  };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

/** A minimal document: an event target with a writable `hidden` flag. */
export function fakeDocument(): Document & { hidden: boolean } {
  return Object.assign(new EventTarget(), { hidden: false }) as unknown as Document & { hidden: boolean };
}
