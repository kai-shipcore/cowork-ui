import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useMenu } from '@/shared/hooks/use-menu';
import { LayoutProvider } from './components/context';
import { Wrapper } from './components/wrapper';
import { MENU_SIDEBAR_ALL } from './navigation';

export function Layout() {
  const { pathname } = useLocation();
  const { getCurrentItem } = useMenu(pathname);
  const item = getCurrentItem(MENU_SIDEBAR_ALL);

  return (
    <>
      <Helmet>
        <title>{item?.title}</title>
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
