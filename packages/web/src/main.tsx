import '@tamagui/core/reset.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TamaguiProvider } from 'tamagui';
import { config } from '../tamagui.config.ts';
import { App } from './App.tsx';

const dark = window.matchMedia('(prefers-color-scheme: dark)');

const Root = () => {
  const [theme, setTheme] = useState(dark.matches ? 'dark' : 'light');
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    dark.addEventListener('change', onChange);
    return () => dark.removeEventListener('change', onChange);
  }, []);
  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      <App />
    </TamaguiProvider>
  );
};

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
