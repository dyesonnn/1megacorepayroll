"use client";

import { useState } from "react";

export default function ZoomControls({
  onScaleChange,
}: {
  onScaleChange: (scale: number) => void;
}) {
  const [scale, setScale] = useState(100);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setScale(val);
    onScaleChange(val);
  };

  const reset = () => {
    setScale(100);
    onScaleChange(100);
  };

  return (
    <div className="no-print flex items-center gap-2">
      <button
        onClick={reset}
        className="px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
        title="Reset zoom"
      >
        🔍
      </button>
      <input
        type="range"
        min={50}
        max={150}
        step={5}
        value={scale}
        onChange={handleChange}
        className="w-24 accent-blue-600"
        title={`Zoom: ${scale}%`}
      />
      <span className="text-xs text-slate-500 w-10 text-right tabular-nums">
        {scale}%
      </span>
    </div>
  );
}
