interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="11" fill="#080707" />
      <rect width="48" height="48" rx="11" fill="url(#lm_bg)" opacity="0.7" />
      <path
        d="M24 13.5 L37 37.5 L32.5 37.5 L24 21 L15.5 37.5 L11 37.5 Z"
        fill="url(#lm_a)"
      />
      <path d="M18.5 30 L29.5 30 L28 27 L20 27 Z" fill="#080707" />
      <circle cx="24" cy="9" r="2.8" fill="url(#lm_dot)" />
      <defs>
        <linearGradient id="lm_bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C9A84C" stopOpacity="0.14" />
          <stop offset="1" stopColor="#C9A84C" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lm_a" x1="24" y1="13.5" x2="24" y2="37.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EDD078" />
          <stop offset="0.55" stopColor="#C9A84C" />
          <stop offset="1" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="lm_dot" x1="21.2" y1="6.2" x2="26.8" y2="11.8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F4E090" />
          <stop offset="1" stopColor="#C9A84C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 32, showWordmark = true, className }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <div className="flex items-baseline gap-0.5">
          <span
            className="font-bold tracking-tight text-white leading-none"
            style={{ fontSize: size * 0.53 }}
          >
            IAttom
          </span>
          <span
            className="font-medium tracking-tight text-primary leading-none"
            style={{ fontSize: size * 0.44 }}
          >
            Assist
          </span>
        </div>
      )}
    </div>
  );
}
