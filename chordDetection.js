// chordDetection.js
// Restored from V2's working implementation.

export let lastPeakDb = -Infinity;

export function chromaFromAnalyser(analyser, sampleRate) {
  const bins = analyser.frequencyBinCount;
  const data = new Float32Array(bins);
  analyser.getFloatFrequencyData(data);

  let peakDb = -Infinity;
  for (let k = 1; k < bins; k++) {
    if (data[k] > peakDb) peakDb = data[k];
  }
  lastPeakDb = peakDb;

  const chroma = new Array(12).fill(0);
  for (let k = 1; k < bins; k++) {
    const f = (k * sampleRate) / analyser.fftSize;
    if (f < 70 || f > 1600) continue;
    const mag = Math.pow(10, data[k] / 20);
    const midi = 69 + 12 * Math.log2(f / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += mag;
  }
  const max = Math.max(...chroma);
  if (max <= 0) return [];
  const pcs = [];
  for (let p = 0; p < 12; p++) if (chroma[p] >= 0.5 * max) pcs.push(p);
  pcs.sort((a, b) => chroma[b] - chroma[a]);
  return pcs.slice(0, 5).sort((a, b) => a - b);
}
