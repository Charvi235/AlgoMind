import { type HTMLAttributes } from "react";

type NodeColor = "node" | "gold" | "teal";

interface GlowNodeProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual colour variant.
   * - "node"  → primary blue  (#7FA8FF) — default graph node
   * - "gold"  → accent gold   (#FFD36E) — target / highlighted node
   * - "teal"  → success teal  (#6EE7C4) — correct / solved node
   */
  color?: NodeColor;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  className?: string;
}

const colorMap: Record<
  NodeColor,
  { bg: string; shadow: string }
> = {
  node: {
    bg: "bg-node",
    shadow: "shadow-glow-node",
  },
  gold: {
    bg: "bg-gold",
    shadow: "shadow-glow-gold",
  },
  teal: {
    bg: "bg-teal",
    shadow: "shadow-glow-teal",
  },
};

/**
 * GlowNode — circular graph-node primitive with a soft outer glow.
 * Accepts `color` ("node" | "gold" | "teal") and `size` (px).
 */
export default function GlowNode({
  color = "node",
  size = 40,
  className = "",
  children,
  ...rest
}: GlowNodeProps) {
  const { bg, shadow } = colorMap[color];

  return (
    <div
      role="presentation"
      className={[
        "rounded-full",
        "flex items-center justify-center",
        "transition-shadow duration-300",
        bg,
        shadow,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      {...rest}
    >
      {children}
    </div>
  );
}
