/**
 * theme.js — Material UI theme.
 *
 * Visual direction: a calm desktop file manager in cool neutrals, so the
 * colourful Scratch thumbnails carry the screen. Colour is reserved for
 * meaning: violet for selection and primary actions, Scratch's green-flag
 * green for Run, Scratch's events-yellow for favourites, and tags in the
 * Scratch block-category palette. Type is Lexend, a typeface designed for
 * reading ease — a good fit for an education-focused audience.
 */
import { createTheme, alpha } from '@mui/material/styles';

export const RUN_GREEN = '#3FAE4A';
export const STAR_YELLOW = '#F5B400';

const tokens = {
  light: {
    bg: '#EDF0F5',
    surface: '#FFFFFF',
    sunken: '#F5F7FA',
    ink: '#1F2430',
    muted: '#5D6575',
    line: '#D9DEE7',
    primary: '#6D4AE8',
  },
  dark: {
    bg: '#171A21',
    surface: '#1F232C',
    sunken: '#1A1D25',
    ink: '#E8EBF2',
    muted: '#9BA3B4',
    line: '#2F3542',
    primary: '#A48BFF',
  },
};

export function buildTheme(mode = 'light') {
  const t = tokens[mode];
  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary },
      success: { main: RUN_GREEN, contrastText: '#fff' },
      warning: { main: STAR_YELLOW },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.ink, secondary: t.muted },
      divider: t.line,
      sunken: t.sunken,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Lexend", "Segoe UI", system-ui, -apple-system, sans-serif',
      fontSize: 13,
      h5: { fontWeight: 600, fontSize: '1.35rem', letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, fontSize: '1.05rem' },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 600, fontSize: '0.8rem' },
      button: { textTransform: 'none', fontWeight: 500 },
      caption: { fontSize: '0.72rem' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { fontVariantNumeric: 'tabular-nums', '--tag-ring': t.ink },
          '*:focus-visible': { outline: `2px solid ${t.primary}`, outlineOffset: 2 },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { transitionDuration: '0ms !important', animationDuration: '0ms !important' },
          },
        },
      },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiTooltip: { defaultProps: { arrow: true, enterDelay: 400 } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            '&.Mui-selected': { backgroundColor: alpha(t.primary, mode === 'light' ? 0.12 : 0.22) },
          },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
      MuiMenu: { defaultProps: { slotProps: { paper: { elevation: 3 } } } },
    },
  });
}
