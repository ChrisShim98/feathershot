"use client";

import { useEffect, useState } from "react";

export function Bird({ size = 64, blink = true, className }: { size?: number; blink?: boolean; className?: string }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!blink) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setClosed(true);
        setTimeout(() => setClosed(false), 130);
        loop();
      }, 2800 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(t);
  }, [blink]);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Feathershot bird">
      <defs>
        <linearGradient id="bird-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#7c6cf0" />
        </linearGradient>
      </defs>
      {/* the one bright feather */}
      <path d="M26 48 C10 42 5 26 12 10 C25 18 30 34 26 48 Z" fill="#fb7185" />
      <path d="M24 44 C16 36 14 26 13 16" fill="none" stroke="#fda4af" strokeWidth="1.6" strokeLinecap="round" />
      {/* feet */}
      <path d="M42 84 v6 M56 84 v6" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
      {/* body */}
      <circle cx="48" cy="56" r="30" fill="url(#bird-body)" />
      <ellipse cx="46" cy="67" rx="19" ry="15" fill="#fff7ed" />
      <ellipse cx="34" cy="58" rx="11" ry="7" transform="rotate(-25 34 58)" fill="#8b5cf6" opacity="0.85" />
      {/* beak */}
      <path d="M74 50 L90 55 L74 60 Z" fill="#fb923c" />
      {/* eye */}
      {closed ? (
        <path d="M54 46 q4 3 8 0" fill="none" stroke="#1f1b2e" strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="58" cy="46" r="4.6" fill="#1f1b2e" />
          <circle cx="59.6" cy="44.4" r="1.4" fill="#fff" />
        </>
      )}
      <circle cx="64" cy="55" r="4" fill="#fb7185" opacity="0.45" />
    </svg>
  );
}
