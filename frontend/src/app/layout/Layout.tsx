import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { LayoutProvider } from './components/context';
import { Wrapper } from './components/wrapper';
import { pageTitle } from './page-identity';

export function Layout() {
  const { pathname, search } = useLocation();

  return (
    <>
      <Helmet>
        <title>{pageTitle(pathname, search)} · Coverland</title>
      </Helmet>

      <LayoutProvider
        style={
          {
            '--sidebar-width': '300px',
            '--sidebar-collapsed-width': '60px',
            '--sidebar-header-height': '54px',
            '--header-height': '60px',
            '--header-height-mobile': '60px',
          } as React.CSSProperties
        }
      >
        <Wrapper />
      </LayoutProvider>
    </>
  );
}
