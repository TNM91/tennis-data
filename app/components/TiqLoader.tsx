"use client";

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

  const dotClass = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }[size];

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className={`tiq-loader relative ${sizeClass}`}>
        <div className={`absolute inset-0 rounded-full border-white ${ringClass}`} />

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
          className={`tiq-loader-dot absolute left-1/2 top-1/2 ${dotClass} rounded-full bg-[#9BE11D]`}
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