import { defaultConfig } from '@tamagui/config/v6';
import { createTamagui } from 'tamagui';

export const config = createTamagui(defaultConfig);

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
