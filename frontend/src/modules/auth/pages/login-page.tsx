import { Button } from '@coverland-engineering/ui/button';
import { RiGoogleFill } from '@remixicon/react';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { toAbsoluteUrl } from '@/shared/lib/helpers';

/** Public prototype entry; never collects credentials or simulates authentication. */
export function LoginPage() {
  return (
    <div className="mt-login bg-background flex min-h-screen w-full">
      <div className="mt-login-brand bg-muted hidden w-full items-center justify-center p-12 md:flex">
        <img
          src={toAbsoluteUrl('/media/app/coverland_logo.png')}
          className="w-full max-w-xs rounded-2xl bg-white"
          alt="Coverland"
        />
      </div>
      <div className="flex w-full flex-col items-center justify-center p-6">
        <section
          className="mt-login-card flex w-full max-w-sm flex-col gap-5"
          aria-labelledby="login-title"
        >
          <div className="workbench-heading">
            <h1 id="login-title">Coverland Workbench</h1>
            <p className="text-muted-foreground text-sm">
              An internal portal connecting team workflows · Public prototype
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-3 w-full"
            disabled
            aria-describedby="google-status"
          >
            <RiGoogleFill aria-hidden="true" className="size-4" />
            Google Workspace sign-in · Not connected
          </Button>
          <p id="google-status" className="text-muted-foreground text-sm">
            Company Google authentication and server integration are not
            configured yet. This screen does not collect email addresses or
            passwords.
          </p>
          <div className="bg-muted flex gap-3 rounded-lg p-4 text-sm">
            <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
            <p>
              This demo is publicly accessible. Do not enter customer personal
              data or company secrets. Entries are saved only in this browser
              and are not shared with other employees.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link to={ROUTES.dashboard}>Explore prototype</Link>
          </Button>
          <Link
            to="/work/settings?team=rd"
            className="text-primary text-center text-sm underline"
          >
            Check storage, backups, and connection status
          </Link>
        </section>
      </div>
    </div>
  );
}
