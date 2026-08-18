// chordDetection.js
// Detects individual notes played on a guitar from live audio, then
// derives the chord from that note set. Two-stage design:
//   1) findGuitarNotes: real per-note pitch detection with harmonic subtraction
//   2) chromaFromAnalyser: thin wrapper kept for backward compatibility

const A4 = 440;
const MIN_MIDI = 38; // D2 - a little below low E2, safety margin
const MAX_MIDI = 88; // E6 - generous upper bound for high voicings

function midiToFreq(midi) {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

function freqToBin(freq, sampleRate, fftSize) {
  return Math.round((freq * fftSize) / sampleRate);
}

// Reads the magnitude (linear, not dB) at a given frequency, searching
// a small window of bins to tolerate slight tuning drift.
function magnitudeAt(freq, data, sampleRate, fftSize) {
  const center = freqToBin(freq, sampleRate, fftSize);
  const window = 2;
  let best = -Infinity;
  for (let k = Math.max(1, center - window); k <= Math.min(data.length - 1, center + window); k++) {
    if (data[k] > best) best = data[k];
  }
  return best === -Infinity ? 0 : Math.pow(10, best / 20);
}

export function findGuitarNotes(analyser, sampleRate, maxNotes = 6) {
  const bins = analyser.frequencyBinCount;
  const fftSize = analyser.fftSize;
  const data = new Float32Array(bins);
  analyser.getFloatFrequencyData(data);

  // Working copy of linear magnitudes we can subtract from.
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
      // Decaying subtraction: fundamental removed fully, higher
      // harmonics partially, matching a plucked string's natural decay.
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
      if (fundamental < globalMax * 0.06) continue; // too quiet to trust

      // Reward notes whose harmonic series is actually present -
      // this is what separates a real note from a stray overtone.
      const h2 = readMag(f0 * 2);
      const h3 = readMag(f0 * 3);
      const score = fundamental + h2 * 0.5 + h3 * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestMidi = midi;
      }
    }

    if (bestMidi === -1 || bestScore < globalMax * 0.08) break;

    detected.push(bestMidi);
    subtractHarmonics(bestMidi);
  }

  return detected.sort((a, b) => a - b);
}

// Kept for backward compatibility with existing App.jsx wiring.
// Returns unique pitch classes (0-11), same shape as before.
export function chromaFromAnalyser(analyser, sampleRate) {
  const notes = findGuitarNotes(analyser, sampleRate);
  const pcs = [...new Set(notes.map((m) => ((m % 12) + 12) % 12))];
  return pcs.sort((a, b) => a - b);
}

// New: full note names with octave, for display (e.g. "E2", "B3", "G#4").
const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteNamesFromAnalyser(analyser, sampleRate) {
  const notes = findGuitarNotes(analyser, sampleRate);
  return notes.map((midi) => {
    const letter = NOTE_LETTERS[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${letter}${octave}`;
  });
}
