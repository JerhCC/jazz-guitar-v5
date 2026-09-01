import { useState } from 'react';
import { JAZZ_HISTORY } from './history';

const ERA_COLORS = [
  '#d97706', '#e08a3f', '#c9915a', '#a89a6f', '#7fa085',
  '#5aa89a', '#3daeae', '#22b8c4', '#0fb8d4', '#06b6d4',
];

export function HistoryTimeline() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-700" />
      <div className="space-y-3">
        {JAZZ_HISTORY.map((era, i) => {
          const isOpen = openIndex === i;
          const color = ERA_COLORS[i % ERA_COLORS.length];
          return (
            <div key={i} className="relative">
              <div
                className="absolute -left-8 top-4 w-4 h-4 rounded-full border-2 border-slate-900"
                style={{ backgroundColor: color }}
              />
              <button
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                className="w-full text-left bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-500 transition overflow-hidden"
              >
                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold" style={{ color }}>{era.period}</p>
                    <h3 className="text-lg font-bold text-slate-100 mt-0.5">{era.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{era.summary}</p>
                  </div>
                  <div className="text-slate-500 text-xl shrink-0">{isOpen ? '−' : '+'}</div>
                </div>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-700 space-y-3">
                    <p className="text-sm text-slate-300 leading-relaxed">{era.details}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {era.keyArtists.map((artist) => (
                        <span
                          key={artist}
                          className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-700 text-slate-200"
                        >
                          {artist}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 italic">🎧 Listen for: {era.listenFor}</p>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
