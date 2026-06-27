"use client";

import Image from "next/image";

type TiqLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<TiqLoaderProps["size"]>, {
  wrap: string;
  icon: number;
}> = {
  sm: { wrap: "h-14 w-14", icon: 54 },
  md: { wrap: "h-24 w-24", icon: 92 },
  lg: { wrap: "h-32 w-32", icon: 124 },
};

export default function TiqLoader({
  label = "Loading TenAceIQ...",
  size = "md",
}: TiqLoaderProps) {
  const config = sizeMap[size];

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className={`relative grid place-items-center ${config.wrap}`} role="status" aria-label={label || "Loading"}>
        <Image
          src="/tiq/logo/tiq-app-icon.png"
          alt=""
          width={512}
          height={512}
          priority
          style={{
            width: config.icon,
            height: config.icon,
            objectFit: "contain",
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
