import { engineStyle } from "../constants";

export function EngineBadge({ code, size = "md" }: { code?: string; size?: "sm" | "md" | "lg" }) {
  const { short, color } = engineStyle(code);
  return <span className={`engine-badge ${size}`} style={{ background: color }} aria-hidden="true">{short}</span>;
}
