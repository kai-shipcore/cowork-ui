import { Button } from '@coverland-engineering/ui/button';
import { Link } from 'react-router';
import { useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useMenu } from '@/shared/hooks/use-menu';
import { MENU_TOOLBAR } from '@/app/layout/navigation';

export function ToolbarMenu() {
  const { pathname } = useLocation();
  const { isActive } = useMenu(pathname);

  return (
    <div className="flex items-stretch">
      <nav className="list-none flex items-stretch gap-2">
        {MENU_TOOLBAR.map((item, index) => {
          const active = isActive(item.path);

          return (
            <Button
              key={index}
              size="sm"
              variant="ghost"
              className={cn(
                'inline-flex items-center text-sm font-medium',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-secondary-foreground hover:text-primary',
              )}
              asChild
            >
              <Link to={item.path ?? '#'}>
                {item.icon && <item.icon className="mr-2" />}
                {item.title}
              </Link>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
