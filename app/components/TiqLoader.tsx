"use client";

import Image from "next/image";

type TiqLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

export default function TiqLoader({
  label = "Loading TenAceIQ...",
  size = "md",
}: TiqLoaderProps) {
  const sizeClass = {
    sm: "h-14 w-14",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  }[size];

  const ringClass = {
    sm: "border-[4px]",
    md: "border-[6px]",
    lg: "border-[7px]",
  }[size];

  const iconPixels = size === "sm" ? 46 : size === "lg" ? 106 : 80;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className={`relative ${sizeClass}`} role="status" aria-label={label || "Loading"}>
        <div
          className={`absolute inset-0 rounded-[28%] ${ringClass}`}
          style={{
            borderColor: 'color-mix(in srgb, var(--brand-green) 32%, rgba(255,255,255,0.2) 68%)',
            background: 'color-mix(in srgb, var(--tenaceiq-navy) 72%, transparent 28%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        />

        <Image
          src="/tenaceiq/logos/tenaceiq-q-icon.svg"
          alt=""
          width={512}
          height={512}
          priority
          className="absolute left-1/2 top-1/2"
          style={{
            width: iconPixels,
            height: iconPixels,
            objectFit: "contain",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {label ? (
        <p
          className="text-center text-xs font-semibold uppercase"
          style={{ color: 'var(--shell-copy-muted)', letterSpacing: '0.12em' }}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
