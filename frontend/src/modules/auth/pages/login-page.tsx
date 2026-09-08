import type { SyntheticEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import { Input, InputWrapper } from '@coverland-engineering/ui/input';
import { Label } from '@coverland-engineering/ui/label';
import { RiGoogleFill } from '@remixicon/react';
import { Lock, Mail } from 'lucide-react';
import { toAbsoluteUrl } from '@/shared/lib/helpers';

/**
 * Authentication is not implemented yet, so nothing is submitted. Without this
 * the browser would run its native form submit and reload the page.
 */
function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
  event.preventDefault();
}

/** Static sign-in screen. Renders outside the app shell, with no auth behavior. */
export function LoginPage() {
  return (
    <div className="bg-background flex min-h-screen w-full">
      {/* The logo asset is a square with a baked-in white background, so it sits
          on its own white plate to stay legible on the dark theme. */}
      <div className="bg-muted hidden w-full items-center justify-center p-12 md:flex">
        <img
          src={toAbsoluteUrl('/media/app/coverland_logo.png')}
          className="w-full max-w-xs rounded-2xl bg-white"
          alt="Coverland"
        />
      </div>

      <div className="flex w-full flex-col items-center justify-center p-6">
        <form
          className="flex w-full max-w-sm flex-col gap-5"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground text-sm">
              Welcome back! Please sign in to continue.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-3 w-full"
          >
            <RiGoogleFill role="img" className="size-4" />
            Continue with Google Workspace
          </Button>

          <div className="flex items-center gap-4">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">
              or sign in with email
            </span>
            <span className="bg-border h-px flex-1" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <InputWrapper variant="lg">
              <Mail className="text-muted-foreground size-4" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@coverland.com"
              />
            </InputWrapper>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <InputWrapper variant="lg">
              <Lock className="text-muted-foreground size-4" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
              />
            </InputWrapper>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="remember-me" />
              <Label htmlFor="remember-me" variant="secondary">
                Remember me
              </Label>
            </div>
            <Button
              type="button"
              mode="link"
              variant="primary"
              underlined="solid"
              className="text-sm"
            >
              Forgot password?
            </Button>
          </div>

          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>

          <p className="text-muted-foreground text-center text-sm">
            Need access?{' '}
            <Button
              type="button"
              mode="link"
              variant="primary"
              className="text-sm"
            >
              Contact an administrator
            </Button>
          </p>
        </form>
      </div>
    </div>
  );
}
