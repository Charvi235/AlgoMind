import { type ButtonHTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type ButtonVariant = "primary" | "secondary";

// Merge native button attrs with Framer Motion's own props
interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, keyof ButtonHTMLAttributes<HTMLButtonElement>>,
    ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  /**
   * Primary — gold background, deep-space text, gold glow on hover.
   * Used for the main CTA actions.
   */
  primary: [
    "bg-gold text-background font-semibold",
    "hover:brightness-110",
    "shadow-glow-gold/0 hover:shadow-glow-gold",
    "transition-shadow duration-300",
  ].join(" "),

  /**
   * Secondary — transparent with panelBorder outline, textPrimary text.
   * Used for secondary / ghost actions.
   */
  secondary: [
    "bg-transparent text-textPrimary font-medium",
    "border border-panelBorder",
    "hover:bg-panelBorder/20",
    "transition-colors duration-300",
  ].join(" "),
};

/**
 * Button — primary & secondary variants with Framer Motion scale feedback.
 */
export default function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      disabled={disabled}
      className={[
        // base
        "inline-flex items-center justify-center gap-2",
        "rounded-lg px-5 py-2.5 text-sm",
        "cursor-pointer select-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-node focus-visible:outline-offset-2",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...(rest as HTMLMotionProps<"button">)}
    >
      {children}
    </motion.button>
  );
}
