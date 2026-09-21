import { Toaster } from '@coverland-engineering/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { LoadingBarContainer } from 'react-top-loading-bar';
import { OperationsProvider } from './operations-store';
import { AppRouter } from './router';
import { store } from './store';
import { WorkbenchProvider } from './workbench-store';

const { BASE_URL } = import.meta.env;

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        storageKey="vite-theme"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        <HelmetProvider>
          <LoadingBarContainer>
            <BrowserRouter basename={BASE_URL}>
              <WorkbenchProvider>
                <Toaster />
                <OperationsProvider>
                  <AppRouter />
                </OperationsProvider>
              </WorkbenchProvider>
            </BrowserRouter>
          </LoadingBarContainer>
        </HelmetProvider>
      </ThemeProvider>
    </Provider>
  );
}
