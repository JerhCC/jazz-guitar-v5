// chordDetection.js
const A4 = 440;
const MIN_MIDI = 38;
const MAX_MIDI = 88;
const MARGIN_DB = 15;
const FLOOR_MIN = -95; // floor can never drift below this — prevents runaway drift
const FLOOR_MAX = -40;
const CONSECUTIVE_FRAMES_NEEDED = 3; // require sustained signal, not one blip

let noiseFloor = -80;
let aboveThresholdCount = 0;
export let lastPeakDb = -Infinity;
export let lastNoiseFloor = -80;

function midiToFreq(midi) {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

function freqToBin(freq, sampleRate, fftSize) {
  return Math.round((freq * fftSize) / sampleRate);
}

export function findGuitarNotes(analyser, sampleRate, maxNotes = 6) {
  const bins = analyser.frequencyBinCount;
  const fftSize = analyser.fftSize;
  const data = new Float32Array(bins);
  analyser.getFloatFrequencyData(data);

  let peakDb = -Infinity;
  for (let k = 1; k < bins; k++) {
    if (data[k] > peakDb) peakDb = data[k];
  }
  lastPeakDb = peakDb;

  const isAboveFloor = peakDb >= noiseFloor + MARGIN_DB;

  if (!isAboveFloor) {
    // Quiet frame: nudge the floor toward it, but never below FLOOR_MIN
    noiseFloor = Math.max(FLOOR_MIN, Math.min(FLOOR_MAX, noiseFloor * 0.95 + peakDb * 0.05));
    lastNoiseFloor = noiseFloor;
    aboveThresholdCount = 0;
    return [];
  }
  lastNoiseFloor = noiseFloor;
  aboveThresholdCount++;

  // Require sustained signal across a few frames before trusting it —
  // filters out single-frame spikes (taps, clicks, transient noise).
  if (aboveThresholdCount < CONSECUTIVE_FRAMES_NEEDED) return [];

  const spectrum = new Float32Array(bins);
  for (let k = 0; k < bins; k++) spectrum[k] = Math.pow(10, data[k] / 20);

  const readMag = (freq) => {
    const center = freqToBin(freq, sampleRate, fftSize);
    const window = 2;
    let best = 0;
    for (let k = Math.max(1, center - window); k <= Math.min(bins - 1, center + window); k++) {
      if (spectrum[k] > best) best = spectrum[k];
    }
    return best;
  };

  const subtractHarmonics = (midi) => {
    const f0 = midiToFreq(midi);
    for (let h = 1; h <= 8; h++) {
      const freq = f0 * h;
      if (freq > sampleRate / 2) break;
      const center = freqToBin(freq, sampleRate, fftSize);
      const window = 2;
      const factor = 1 / h;
      for (let k = Math.max(1, center - window); k <= Math.min(bins - 1, center + window); k++) {
        spectrum[k] = Math.max(0, spectrum[k] - spectrum[k] * factor);
      }
    }
  };

  const detected = [];
  const globalMax = Math.max(...spectrum);
  if (globalMax <= 0) return [];

  for (let pass = 0; pass < maxNotes; pass++) {
    let bestMidi = -1;
    let bestScore = 0;

    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
      const f0 = midiToFreq(midi);
      if (f0 * 2 > sampleRate / 2) break;
      const fundamental = readMag(f0);
      if (fundamental < globalMax * 0.1) continue;

      const h2 = readMag(f0 * 2);
      const h3 = readMag(f0 * 3);
      const score = fundamental + h2 * 0.5 + h3 * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestMidi = midi;
      }
    }

    if (bestMidi === -1 || bestScore < globalMax * 0.15) break;

    detected.push(bestMidi);
    subtractHarmonics(bestMidi);
  }

  return detected.sort((a, b) => a - b);
}

export function chromaFromAnalyser(analyser, sampleRate) {
  const notes = findGuitarNotes(analyser, sampleRate);
  const pcs = [...new Set(notes.map((m) => ((m % 12) + 12) % 12))];
  return pcs.sort((a, b) => a - b);
}

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteNamesFromAnalyser(analyser, sampleRate) {
  const notes = findGuitarNotes(analyser, sampleRate);
  return notes.map((midi) => {
    const letter = NOTE_LETTERS[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${letter}${octave}`;
  });
}
