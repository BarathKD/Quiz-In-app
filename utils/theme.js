// Quiz-IN look and feel: "Mayil" (peacock) palette, a clean modern layout.
// Peacock blue-teal, lotus violet and jasmine white. No red or yellow brand colors.
// Every screen imports its colors from here.

export const colors = {
  bg: "#F4F9F8",          // jasmine white page background
  surface: "#FFFFFF",     // cards
  ink: "#0B2A33",         // main text
  muted: "#46646C",       // secondary text
  primary: "#0C6478",     // peacock blue-teal
  primaryDark: "#084A5A",
  onPrimary: "#F4F9F8",   // text on primary
  accent: "#7B4BC0",      // lotus violet (premium, highlights)
  onAccent: "#FFFFFF",
  tint: "#DCEEF2",        // soft primary tint (icon tiles, chips)
  accentTint: "#E7DEF6",
  border: "#CFE0E4",
  track: "#DDE9EC",       // progress bar track
  success: "#2E7D4F",     // correct answer
  successTint: "#E3F1E8",
  danger: "#C9402A",      // wrong answer / errors only, never a brand color
  dangerTint: "#FBE4E1",
  locked: "#A9B8BC",
};

// Baloo Thambi 2 supports Tamil and Latin. Used for headings and the brand name.
export const fonts = {
  heading: "BalooThambi2_800ExtraBold",
  headingSemi: "BalooThambi2_600SemiBold",
};

// Difficulty colors: green, peacock blue, lotus violet (no red or yellow)
export const difficultyColors = {
  easy: "#2E7D4F",
  medium: "#0C6478",
  hard: "#7B4BC0",
};

export const radius = { card: 18, tile: 14, pill: 999, hero: 28 };

export const shadow = {
  shadowColor: "#0B2A33",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 2,
};
