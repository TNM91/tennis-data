"use client";

import type { CSSProperties } from "react";

type TiqLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<TiqLoaderProps["size"]>, {
  wrap: string;
  ring: string;
  dot: string;
  orbitRadius: string;
}> = {
  sm: {
    wrap: "h-14 w-14",
    ring: "border-[4px]",
    dot: "h-3 w-3",
    orbitRadius: "26px",
  },
  md: {
    wrap: "h-24 w-24",
    ring: "border-[6px]",
    dot: "h-4 w-4",
    orbitRadius: "44px",
  },
  lg: {
    wrap: "h-32 w-32",
    ring: "border-[7px]",
    dot: "h-5 w-5",
    orbitRadius: "60px",
  },
};

type LoaderStyle = CSSProperties & {
  "--tiq-loader-orbit-radius": string;
};

export default function TiqLoader({
  label = "Loading TenAceIQ...",
  size = "md",
}: TiqLoaderProps) {
  const config = sizeMap[size];
  const loaderStyle: LoaderStyle = {
    "--tiq-loader-orbit-radius": config.orbitRadius,
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div
        className={`tiq-loader relative ${config.wrap}`}
        style={loaderStyle}
        role="status"
        aria-label={label || "Loading"}
      >
        <div className={`absolute inset-0 rounded-full border-white ${config.ring}`} />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M8 52 C 24 25, 39 34, 52 50 S 76 76, 92 48"
            fill="none"
            stroke="#9BE11D"
            strokeWidth="11"
            strokeLinecap="round"
          />
        </svg>

        <div
          className={`tiq-loader-dot absolute left-1/2 top-1/2 ${config.dot} rounded-full bg-[#9BE11D]`}
        />
      </div>

      {label ? (
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
          {label}
        </p>
      ) : null}
    </div>
  );
}
