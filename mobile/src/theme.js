// Central design system – all colors, radii, shadows, typography
import { Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN_W = width;
export const SCREEN_H = height;

export const C = {
  // Backgrounds
  bg:       '#080D17',
  surface:  '#0F1929',
  card:     '#131F30',
  border:   '#1E2D3D',
  borderHi: '#2A3F55',

  // Brand
  accent:   '#4F9CF9',
  accentDk: '#2B6FD6',
  accentLt: '#7BB8FA',

  // Player colours
  xColor:   '#F97316',   // orange
  oColor:   '#A855F7',   // purple
  xBg:      '#2D1B0A',
  oBg:      '#1E0D33',

  // Semantic
  success:  '#22C55E',
  error:    '#EF4444',
  warn:     '#FBBF24',
  info:     '#38BDF8',

  // Text
  text:     '#E2E8F0',
  textSub:  '#94A3B8',
  textMute: '#4B6380',

  // Gradients (arrays for LinearGradient)
  gradBg:     ['#080D17', '#0C1526', '#0F1929'],
  gradAccent: ['#4F9CF9', '#2B6FD6'],
  gradX:      ['#F97316', '#EA580C'],
  gradO:      ['#A855F7', '#7C3AED'],
  gradCard:   ['#131F30', '#0F1929'],
  gradSuccess:['#22C55E', '#16A34A'],
  gradWarn:   ['#FBBF24', '#D97706'],
};

export const R = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  full: 999,
};

export const SHADOW = {
  sm: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
    android: { elevation: 3 },
  }),
  md: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
    android: { elevation: 6 },
  }),
  accent: Platform.select({
    ios:     { shadowColor: '#4F9CF9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
    android: { elevation: 8 },
  }),
};

export const T = {
  h1: { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  h2: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: 0.2 },
  h3: { fontSize: 18, fontWeight: '700', color: C.text },
  body: { fontSize: 15, color: C.text },
  sub:  { fontSize: 13, color: C.textSub },
  mute: { fontSize: 12, color: C.textMute },
  label:{ fontSize: 13, fontWeight: '600', color: C.textSub, letterSpacing: 0.4, textTransform: 'uppercase' },
};
