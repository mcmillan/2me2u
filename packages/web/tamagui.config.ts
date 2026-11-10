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

export const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    /** The app's accent: export, selection and focus. */
    light_orange: recolour(defaultConfig.themes.light_yellow, 'yellow', 'orange'),
    dark_orange: recolour(defaultConfig.themes.dark_yellow, 'yellow', 'orange'),
  },
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
