import { tamaguiPlugin } from '@tamagui/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets this.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    tamaguiPlugin({
      config: './tamagui.config.ts',
      components: ['tamagui'],
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Vendors in their own chunks, so a change to the app doesn't make
        // returning visitors download React and Tamagui again.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'tamagui', test: /node_modules[\\/](@tamagui[\\/]|tamagui[\\/])/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
});
