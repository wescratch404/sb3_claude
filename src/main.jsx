/**
 * main.jsx — entry point. Picks a light or dark theme from the OS setting and
 * mounts the providers: theme → library state → dialogs → app.
 */
import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { buildTheme } from './theme.js';
import { LibraryProvider } from './state/LibraryContext.jsx';
import { DialogProvider } from './components/dialogs/DialogProvider.jsx';
import App from './App.jsx';

function Root() {
  const dark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const theme = useMemo(() => buildTheme(dark ? 'dark' : 'light'), [dark]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <LibraryProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
