import type { CSSProperties } from "react";

export const CATEGORY_ICON_PATHS: Record<string, [string, string]> = {
  "Жильё": ["M3 11l9-7 9 7", "M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"],
  "Продукты": [
    "M2.5 3h2l2.3 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.5 7H6",
    "M9 20.2a.9.9 0 1 0 .01 0M19 20.2a.9.9 0 1 0 .01 0",
  ],
  "Транспорт": [
    "M3 13l2-6a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 6",
    "M3.5 13h17a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-3A1.5 1.5 0 0 1 3.5 13z",
  ],
  "Развлечения": [
    "M4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4z",
    "M3 9h18M3 15h18M9 4v16M15 4v16",
  ],
  "Здоровье": ["M12 20s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9z", ""],
  "Накопления": [
    "M4 10a5 5 0 0 1 5-5h4a5 5 0 0 1 5 3h1.5a1 1 0 0 1 .9 1.4l-1 2a1 1 0 0 1-.9.6H18v2a3 3 0 0 1-3 3H9l-1 2H5l1-2.3A5 5 0 0 1 4 13v-3z",
    "",
  ],
  "Зарплата": ["M4.5 6h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-10A1.5 1.5 0 0 1 4.5 6z", "M3 9h18"],
  "Другое": ["M4.5 4.5h15v15h-15z", "M12 8v8M8 12h8"],
};

export const GOAL_ICON_PATHS: Record<string, [string, string]> = {
  plane: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  shield: ["M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z", ""],
  laptop: ["M4.5 4h15A1 1 0 0 1 20 5v9H4V5a1 1 0 0 1 .5-1z", "M2 18h20"],
};

export function categoryIcon(name: string): [string, string] {
  return CATEGORY_ICON_PATHS[name] ?? CATEGORY_ICON_PATHS["Другое"];
}

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
