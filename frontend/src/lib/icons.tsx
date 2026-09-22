import type { CSSProperties } from "react";

export const GOAL_ICON_PATHS: Record<string, [string, string]> = {
  plane: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  shield: ["M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z", ""],
  laptop: ["M4.5 4h15A1 1 0 0 1 20 5v9H4V5a1 1 0 0 1 .5-1z", "M2 18h20"],
};

export function goalIcon(icon: string | null | undefined): [string, string] {
  return GOAL_ICON_PATHS[icon ?? ""] ?? GOAL_ICON_PATHS.shield;
}

export function TwoPathIcon({
  paths,
  size = 14,
  style,
}: {
  paths: [string, string];
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={paths[0]} />
      {paths[1] && <path d={paths[1]} />}
    </svg>
  );
}
