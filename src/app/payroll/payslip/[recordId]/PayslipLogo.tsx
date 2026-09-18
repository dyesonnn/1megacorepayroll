"use client";

import { useState } from "react";

// Tries /logo.png, /logo.jpg, ... in order; falls back to a placeholder box
// if none exist. Drop your logo in `public/` as logo.png (or .jpg/.svg/.webp).
const EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp"];

export default function PayslipLogo() {
  const [attempt, setAttempt] = useState(0);

  if (attempt >= EXTENSIONS.length) {
    return (
      <div className="w-44 h-16 border border-black flex items-center justify-center flex-none">
        <span className="text-[10px] tracking-widest text-slate-400">
          COMPANY LOGO
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo.${EXTENSIONS[attempt]}`}
      alt="Company logo"
      onError={() => setAttempt((i) => i + 1)}
      className="w-44 h-16 object-contain flex-none"
    />
  );
}
