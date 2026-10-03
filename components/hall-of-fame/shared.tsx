// components/hall-of-fame/shared.tsx
'use client';

import React, { memo, useState } from 'react';
import Image from 'next/image';
import Dither from '@/components/ui/Dither';
import { initialsOf, type Winner } from '@/lib/hallOfFame';

export const textShadow = '0 2px 12px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,1)';

// Same glass treatment as the Testimony cards
export const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  border: '1.5px solid rgba(255,255,255,0.20)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
};

// Heavy animated background: memoized so it never re-renders after first mount
export const PageBackground = memo(function PageBackground() {
  return (
    <div className="fixed inset-0 -z-10 h-full w-full">
      <Dither
        waveColor={[0.32, 0.15, 1]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.3}
        colorNum={4}
        pixelSize={2}
        waveAmplitude={0.3}
        waveFrequency={3}
        waveSpeed={0.05}
      />
      <div className="absolute inset-0 z-10 bg-black/50" />
      <div className="absolute inset-0 z-20 bg-white/[0.03] backdrop-blur-sm" />
    </div>
  );
});

export function LoadingDots() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3">
        {[0, 150, 300].map((delay) => (
          <div
            key={delay}
            className="h-2 w-2 animate-bounce rounded-full bg-white/80"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{
          ...box,
          fontSize: Math.round(size * 0.36),
          background: 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.22)',
        }}
      >
        {initialsOf(name)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      sizes={`${size}px`}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={box}
    />
  );
}

export function AvatarStack({ winners, max = 4, size = 32 }: { winners: Winner[]; max?: number; size?: number }) {
  const shown = winners.slice(0, max);
  const extra = winners.length - shown.length;

  return (
    <div className="flex shrink-0 items-center">
      {shown.map((w, i) => (
        <span
          key={w.id}
          className="inline-flex rounded-full"
          style={{
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.3),
            border: '2px solid rgba(24,24,36,0.95)',
            zIndex: shown.length - i,
          }}
        >
          <Avatar name={w.name} src={w.imageUrl} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{
            width: size,
            height: size,
            marginLeft: -Math.round(size * 0.3),
            background: 'rgba(255,255,255,0.18)',
            border: '2px solid rgba(24,24,36,0.95)',
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

export function RankPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)' }}
    >
      {children}
    </span>
  );
}