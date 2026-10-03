import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Extra Tailwind classes to merge on top of the defaults */
  className?: string;
}

/**
 * Card — base surface primitive.
 * Background: panel (#0D1130)  Border: panelBorder (#2A3166)
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "bg-panel",
          "border border-panelBorder",
          "rounded-xl",
          "p-6",
          "shadow-panel",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export default Card;
