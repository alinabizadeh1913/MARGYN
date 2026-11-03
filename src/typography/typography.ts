/* =========================================================
   LORIQEN — Typography System
   ---------------------------------------------------------
   Single source of truth for the application's typography.

   Typography controls:
   - Font family
   - Font size
   - Font weight
   - Line height
   - Letter spacing
   - Text transformation
   - Numeric variant

   Typography does NOT control:
   - Colors
   - Backgrounds
   - Borders
   - Shadows
   - Theme values
   - Component spacing
   - Application data
   - Database / persistence

   Design principles:
   - Semantic instead of arbitrary sizes
   - Minimum supported size: 12px (tiny)
   - Consistent visual rhythm
   - Standard font weights
   - Ready for future font replacement
   - Independent from Theme and Database
========================================================= */

export const typography = {
  fontFamily: {
    /**
     * Primary UI font.
     *
     * The application loads Poppins in RootLayout via next/font/google
     * and applies it to the document body. Typography must therefore
     * inherit the application's active font instead of overriding it
     * with another font family.
     *
     * This keeps every semantic typography role on the same Poppins
     * font instance provided by the application layout.
     */
    sans: "inherit",

    /**
     * Monospace is intentionally kept available for:
     * - IDs
     * - technical values
     * - code-like content
     * - future developer / diagnostic UI
     */
    mono:
      '"JetBrains Mono", "SFMono-Regular", Consolas, ' +
      '"Liberation Mono", monospace',
  },

  /* =======================================================
       FONT SIZES
    ======================================================= */

  size: {
    /**
     * Large application / dashboard hero titles.
     */
    display: "28px",

    /**
     * Main page titles.
     */
    pageTitle: "28px",

    /**
     * Primary KPI / statistic values.
     */
    stat: "20px",

    /**
     * Major section headings.
     */
    sectionTitle: "20px",

    /**
     * Secondary KPI / compact statistic values.
     */
    statSmall: "18px",

    /**
     * Card / panel headings.
     */
    cardTitle: "17px",

    /**
     * Body content requiring slightly more emphasis.
     */
    bodyMedium: "15.5px",

    /**
     * Primary readable content.
     */
    body: "15px",

    /**
     * Form labels, buttons and important UI labels.
     */
    label: "14.5px",

    /**
     * Buttons and compact controls.
     */
    button: "14.5px",

    /**
     * Secondary explanatory text.
     */
    caption: "14px",

    /**
     * Compact metadata.
     */
    metadata: "13.5px",

    /**
     * Small uppercase contextual labels.
     */
    eyebrow: "13.5px",

    /**
     * Absolute minimum supported typography size for
     * standard UI text.
     */
    minimum: "13px",

    /**
     * Micro label size.
     *
     * Reserved for the densest UI surfaces (compact
     * toolbar labels, calendar cells, tiny helper chips).
     *
     * This is the smallest size supported by the LORIQEN
     * typography system. No size below 12px exists.
     */
    tiny: "12px",

    /**
     * Compact chip / badge label.
     *
     * Sits at the same optical size as `tiny` but is
     * rendered with a semibold weight so small labels
     * remain legible against busy backgrounds.
     */
    chip: "12px",

    /**
     * Cinematic timer display.
     *
     * Used exclusively by the Focus timer surface.
     * Pair with tabular numerals to prevent jitter.
     */
    timerDisplay: "56px",
  },

  /* =======================================================
       FONT WEIGHTS
    ======================================================= */

  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extraBold: 800,
  },

  /* =======================================================
       LINE HEIGHTS
    ======================================================= */

  lineHeight: {
    display: 1.1,
    pageTitle: 1.15,
    sectionTitle: 1.25,
    cardTitle: 1.3,

    body: 1.5,
    bodyRelaxed: 1.7,
    bodyReading: 1.8,

    label: 1.3,
    caption: 1.4,
    metadata: 1.35,
    eyebrow: 1.2,

    button: 1.2,

    stat: 1.1,
    statSmall: 1.25,

    tiny: 1.35,
    chip: 1.2,

    timerDisplay: 1,
  },

  /* =======================================================
       LETTER SPACING
    ======================================================= */

  letterSpacing: {
    display: "-0.02em",
    pageTitle: "-0.02em",
    sectionTitle: "-0.01em",
    cardTitle: "0",

    body: "0",
    bodyMedium: "0",

    label: "0.02em",
    caption: "0",
    metadata: "0.01em",

    /**
     * Eyebrows are uppercase and intentionally spaced.
     */
    eyebrow: "0.10em",

    button: "0.01em",

    stat: "-0.02em",
    statSmall: "0",

    tiny: "0.01em",
    chip: "0.02em",

    timerDisplay: "-0.03em",
  },
} as const;

/* =========================================================
     SEMANTIC TYPOGRAPHY ROLES
     ---------------------------------------------------------
     Components should normally use these roles rather than
     inventing their own font sizes.
  ========================================================= */

export const typographyRoles = {
  /* -------------------------------------------------------
       DISPLAY
       Large visual titles.
    ------------------------------------------------------- */

  display: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.display,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.display,
    letterSpacing: typography.letterSpacing.display,
  },

  /* -------------------------------------------------------
       PAGE TITLE
       Main title of a page.
    ------------------------------------------------------- */

  pageTitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.pageTitle,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.pageTitle,
    letterSpacing: typography.letterSpacing.pageTitle,
  },

  /* -------------------------------------------------------
       SECTION TITLE
       Major sections inside a page.
    ------------------------------------------------------- */

  sectionTitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.sectionTitle,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.sectionTitle,
    letterSpacing: typography.letterSpacing.sectionTitle,
  },

  /* -------------------------------------------------------
       CARD TITLE
       Titles inside cards, panels and list groups.
    ------------------------------------------------------- */

  cardTitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.cardTitle,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.cardTitle,
    letterSpacing: typography.letterSpacing.cardTitle,
  },

  /* -------------------------------------------------------
       BODY
       Standard readable content.
    ------------------------------------------------------- */

  body: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.body,
    fontWeight: typography.weight.regular,
    lineHeight: typography.lineHeight.body,
    letterSpacing: typography.letterSpacing.body,
  },

  /* -------------------------------------------------------
       BODY MEDIUM
       Same size as body, increased emphasis.
    ------------------------------------------------------- */

  bodyMedium: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.bodyMedium,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.body,
    letterSpacing: typography.letterSpacing.bodyMedium,
  },

  /* -------------------------------------------------------
       LABEL
       Form labels and compact UI labels.
    ------------------------------------------------------- */

  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.label,
    letterSpacing: typography.letterSpacing.label,
  },

  /* -------------------------------------------------------
       CAPTION
       Supporting / explanatory text.
    ------------------------------------------------------- */

  caption: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.regular,
    lineHeight: typography.lineHeight.caption,
    letterSpacing: typography.letterSpacing.caption,
  },

  /* -------------------------------------------------------
       METADATA
       Dates, timestamps, secondary information, etc.
    ------------------------------------------------------- */

  metadata: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.metadata,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.metadata,
    letterSpacing: typography.letterSpacing.metadata,
  },

  /* -------------------------------------------------------
       EYEBROW
       Small uppercase contextual heading.
    ------------------------------------------------------- */

  eyebrow: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.eyebrow,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.eyebrow,
    letterSpacing: typography.letterSpacing.eyebrow,
    textTransform: "uppercase" as const,
  },

  /* -------------------------------------------------------
       BUTTON
       Buttons and compact interactive controls.
    ------------------------------------------------------- */

  button: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.button,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.button,
    letterSpacing: typography.letterSpacing.button,
  },

  /* -------------------------------------------------------
       STAT
       Large KPI / metric values.
    ------------------------------------------------------- */

  stat: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.stat,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.stat,
    letterSpacing: typography.letterSpacing.stat,
  },

  /* -------------------------------------------------------
       STAT SMALL
       Smaller metric values.
    ------------------------------------------------------- */

  statSmall: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.statSmall,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.statSmall,
    letterSpacing: typography.letterSpacing.statSmall,
  },

  /* -------------------------------------------------------
       TINY
       Smallest supported text for the densest surfaces.
    ------------------------------------------------------- */

  tiny: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.tiny,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.tiny,
    letterSpacing: typography.letterSpacing.tiny,
  },

  /* -------------------------------------------------------
       CHIP
       Compact badge / chip label.

       Use for:
       - priority badges
       - status pills
       - subject type tags
       - compact counters
    ------------------------------------------------------- */

  chip: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.chip,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.chip,
    letterSpacing: typography.letterSpacing.chip,
  },

  /* -------------------------------------------------------
       MICRO LABEL
       Tiny uppercase label used in the densest surfaces.

       Replaces ad-hoc `text-[9px]` / `text-[10px]` uppercase
       labels with a single, consistent role.
    ------------------------------------------------------- */

  microLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.tiny,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.eyebrow,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },

  /* -------------------------------------------------------
       TIMER DISPLAY
       Cinematic timer numerals.

       Uses tabular numerals so digits never shift during
       countdown animation.
    ------------------------------------------------------- */

  timerDisplay: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.size.timerDisplay,
    fontWeight: typography.weight.extraBold,
    lineHeight: typography.lineHeight.timerDisplay,
    letterSpacing: typography.letterSpacing.timerDisplay,
    fontVariantNumeric: "tabular-nums",
  },
} as const;

/* =========================================================
     TYPES
  ========================================================= */

export type TypographyRole = keyof typeof typographyRoles;

export type TypographyStyle = {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  textTransform?: "uppercase";
  fontVariantNumeric?: string;
};

/* =========================================================
     HELPER
  ========================================================= */

export const getTypography = (role: TypographyRole): TypographyStyle => {
  return typographyRoles[role];
};

/* =========================================================
     DEFAULT ROLE
  ========================================================= */

export const DEFAULT_TYPOGRAPHY_ROLE: TypographyRole = "body";
