"use client";

import React, { useState, useEffect } from "react";

interface CubeLoaderProps {
  size?: number;
  speed?: number;
}

export const PrismFluxLoader: React.FC<CubeLoaderProps> = ({
  size = 80,
  speed = 5,
}) => {
  const [time, setTime] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = ["Loading", "Syncing", "Processing", "Connecting", "Initializing", "Finalizing"];
  const matrixLetters = ["M", "A", "T", "R", "I", "X"];

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 0.02 * speed);
    }, 16);
    return () => clearInterval(interval);
  }, [speed]);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 600);
    return () => clearInterval(statusInterval);
  }, [statuses.length]);

  const half = size / 2;
  const currentStatus = statuses[statusIndex];

  return (
    <div className="flex flex-col items-center justify-center gap-8 min-h-screen w-full">
      {/* 3D Cube */}
      <div
        className="relative"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          transform: `rotateY(${time * 30}deg) rotateX(${time * 30}deg)`,
        }}
      >
        {matrixLetters.map((letter, i) => {
          const faceTransforms = [
            `rotateY(0deg) translateZ(${half}px)`,
            `rotateY(180deg) translateZ(${half}px)`,
            `rotateY(90deg) translateZ(${half}px)`,
            `rotateY(-90deg) translateZ(${half}px)`,
            `rotateX(90deg) translateZ(${half}px)`,
            `rotateX(-90deg) translateZ(${half}px)`,
          ];

          return (
            <div
              key={i}
              className="absolute flex items-center justify-center text-foreground border-2 border-foreground rounded-lg"
              style={{
                width: size,
                height: size,
                transform: faceTransforms[i],
                backfaceVisibility: "hidden",
              }}
            >
              <span className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {letter}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Text */}
      <div className="text-base sm:text-lg md:text-xl font-semibold text-foreground tracking-wide">
        {currentStatus} MATRIX...
      </div>
    </div>
  );
};
