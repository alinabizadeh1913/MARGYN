import React from "react";
import { getTypography, type TypographyRole } from "./typography";

/* =========================================================
   LORIQEN — Typography Component
   ---------------------------------------------------------
   Semantic typography primitive for the application.

   Responsibilities:
   - Apply centralized typography roles
   - Preserve semantic HTML
   - Allow controlled local overrides
   - Remain independent from Theme / Database

   Does NOT own:
   - Colors
   - Backgrounds
   - Borders
   - Shadows
   - Layout
   - Spacing
   - Application state
   - Database data
========================================================= */

/* =========================================================
   SUPPORTED HTML ELEMENTS
========================================================= */

export type TypographyElement =
  | "span"
  | "p"
  | "div"
  | "label"
  | "strong"
  | "em"
  | "small"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

/* =========================================================
   PROPS
========================================================= */

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Semantic typography role.
   *
   * This determines:
   * - font family
   * - font size
   * - font weight
   * - line height
   * - letter spacing
   */
  variant?: TypographyRole;

  /**
   * Semantic HTML element.
   *
   * Typography style and HTML semantics are intentionally
   * independent.
   *
   * Example:
   *
   * variant="sectionTitle"
   * as="h2"
   */
  as?: TypographyElement;

  /**
   * Optional additional classes.
   *
   * Primarily intended for:
   * - theme colors
   * - layout
   * - state styling
   *
   * Typography itself does not control color.
   */
  className?: string;

  /**
   * Content rendered inside the typography element.
   */
  children?: React.ReactNode;
}

/* =========================================================
   COMPONENT
========================================================= */

const TypographyComponent = ({
  variant = "body",
  as = "span",
  className = "",
  children,
  style,
  ...props
}: TypographyProps) => {
  const Component = as;

  const typographyStyle = getTypography(variant);

  return (
    <Component
      className={className}
      style={{
        ...typographyStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default TypographyComponent;
