export function Avatar({
  label,
  self,
  size = 25,
  style,
}: {
  label: string;
  self: boolean;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`avatar ${self ? "avatar-you" : "avatar-partner"}`}
      style={{ width: size, height: size, fontSize: size * 0.38, ...style }}
    >
      {label}
    </div>
  );
}
