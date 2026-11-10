import { defaultConfig, tailwindColors } from '@tamagui/config/v6';
import { createTamagui } from 'tamagui';

type Theme = (typeof defaultConfig.themes)['light_yellow'];
const palette = tailwindColors as Record<string, string>;

/**
 * Re-colour a stock theme onto another Tailwind palette, shade for shade, so
 * it keeps the stock theme's contrast between background, text and borders.
 */
const recolour = (theme: Theme, from: string, to: string): Theme =>
  Object.fromEntries(
    Object.entries(theme).map(([key, value]) => {
      const hex = typeof value === 'string' ? value : (value as { val: string }).val;
      const shade = Object.keys(palette).find(
        (n) => n.startsWith(`${from}-`) && palette[n] === hex,
      );
      return [key, shade ? palette[shade.replace(from, to)] : value];
    }),
  ) as Theme;

/**
 * The app's accent (export, selection, focus): an orange copy of every stock
 * yellow theme, including the nested `_level2`… variants Tamagui switches to
 * inside surfaces, which would otherwise fall back to grey.
 */
const orangeThemes = Object.fromEntries(
  Object.entries(defaultConfig.themes)
    .filter(([name]) => /^(light|dark)_yellow(_|$)/.test(name))
    .map(([name, theme]) => [
      name.replace('_yellow', '_orange'),
      recolour(theme, 'yellow', 'orange'),
    ]),
) as Record<`${'light' | 'dark'}_orange${'' | `_${string}`}`, Theme>;

export const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    ...orangeThemes,
    light_orange: recolour(defaultConfig.themes.light_yellow, 'yellow', 'orange'),
    dark_orange: recolour(defaultConfig.themes.dark_yellow, 'yellow', 'orange'),
  },
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
