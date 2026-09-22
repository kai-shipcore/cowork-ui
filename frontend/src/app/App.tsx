import { Toaster } from '@coverland-engineering/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { LoadingBarContainer } from 'react-top-loading-bar';
import { OperationsProvider } from './operations-store';
import { AppRouter } from './router';
import { store } from './store';
import { WorkbenchProvider } from './workbench-store';

const { BASE_URL } = import.meta.env;
// Static Pages hosting cannot rewrite deep links to index.html.
const usesHashRouter = import.meta.env.VITE_ROUTER_MODE === 'hash';
const Router = usesHashRouter ? HashRouter : BrowserRouter;

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
            <Router basename={usesHashRouter ? undefined : BASE_URL}>
              <WorkbenchProvider>
                <Toaster />
                <OperationsProvider>
                  <AppRouter />
                </OperationsProvider>
              </WorkbenchProvider>
            </Router>
          </LoadingBarContainer>
        </HelmetProvider>
      </ThemeProvider>
    </Provider>
  );
}
