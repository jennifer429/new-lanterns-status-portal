interface ProgressLogoProps {
  progress: number; // 0-100
  size?: number;
  showGlow?: boolean;
}

export function ProgressLogo({ progress, size = 64, showGlow = false }: ProgressLogoProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Base outline logo (always visible) */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        {/* Lantern outline - simplified New Lantern logo shape */}
        <path
          d="M50 10 L65 25 L65 75 L50 90 L35 75 L35 25 Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-muted-foreground/30"
        />
        {/* Inner flame outline */}
        <path
          d="M50 35 L57 45 L57 65 L50 75 L43 65 L43 45 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className="text-muted-foreground/30"
        />
      </svg>

      {/* Filled progress (clips based on progress percentage) */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
        style={{
          clipPath: `inset(${100 - clampedProgress}% 0 0 0)`,
        }}
      >
        {/* Filled lantern */}
        <path
          d="M50 10 L65 25 L65 75 L50 90 L35 75 L35 25 Z"
          fill="currentColor"
          className={showGlow ? "text-primary animate-pulse" : "text-primary"}
        />
        {/* Inner flame filled */}
        <path
          d="M50 35 L57 45 L57 65 L50 75 L43 65 L43 45 Z"
          fill="currentColor"
          className="text-primary-foreground"
        />
      </svg>

      {/* Glow effect for 100% completion */}
      {showGlow && clampedProgress === 100 && (
        <div className="absolute inset-0 animate-pulse">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
        </div>
      )}
    </div>
  );
}
