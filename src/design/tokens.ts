/**
 * Design System Enterprise - Parabellum CRM
 * Tokens centralizados para consistência total
 */

export const tokens = {
  /* === SPACING (8pt System) === */
  spacing: {
    none: "0px",
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },

  /* === RADIUS === */
  radius: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "18px",
    pill: "9999px",
  },

  /* === SHADOWS === */
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.05)",
    lg: "0 10px 20px rgba(0,0,0,0.07)",
    card: "0 1px 4px rgba(0,0,0,0.06)",
    elevated: "0 8px 30px rgba(0,0,0,0.12)",
  },

  /* === TYPOGRAPHY === */
  fontSize: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "30px",
    "4xl": "36px",
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  /* === Z-INDEX === */
  z: {
    base: 0,
    dropdown: 1000,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    toast: 1600,
    tooltip: 1700,
  },
} as const;

export type Spacing = keyof typeof tokens.spacing;
export type Radius = keyof typeof tokens.radius;
export type Shadow = keyof typeof tokens.shadows;
export type FontSize = keyof typeof tokens.fontSize;
export type FontWeight = keyof typeof tokens.fontWeight;
export type ZIndex = keyof typeof tokens.z;
