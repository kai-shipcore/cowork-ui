import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@coverland-engineering/ui/card';
import {
  Toolbar,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from '@/app/layout/components/toolbar';

/** Displays the sample default profile page. */
export function ProfilePage() {
  return (
    <div className="container">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Profiles-Default</ToolbarPageTitle>
          <ToolbarDescription>Sample profile overview</ToolbarDescription>
        </ToolbarHeading>
      </Toolbar>

      <Card>
        <CardHeader>
          <CardHeading>
            <CardTitle>Profile information</CardTitle>
            <CardDescription>
              This is a sample page for the default profile menu.
            </CardDescription>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="mt-1 font-medium">Coverland User</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Department</dt>
              <dd className="mt-1 font-medium">Research &amp; Development</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">user@coverland.com</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="mt-1 font-medium">Active</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
