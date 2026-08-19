/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#FFFFFF',
    tint: '#FF2D78',
    background: '#0A0A0F',
    foreground: '#FFFFFF',
    card: '#14141B',
    cardForeground: '#FFFFFF',
    primary: '#FF2D78',
    primaryForeground: '#FFFFFF',
    secondary: '#7B2FFF',
    secondaryForeground: '#FFFFFF',
    muted: '#20202A',
    mutedForeground: '#A5A5AF',
    accent: '#00E5FF',
    accentForeground: '#0A0A0F',
    destructive: '#FFB000',
    destructiveForeground: '#0A0A0F',
    border: '#30303B',
    input: '#30303B',
  },
  radius: 12,
};

export default colors;
