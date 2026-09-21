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
          <div className="flex flex-col gap-2 text-center">
            <h1
              id="login-title"
              className="text-3xl font-semibold tracking-tight"
            >
              Coverland Workbench
            </h1>
            <p className="text-muted-foreground text-sm">
              팀 업무를 연결하는 내부 업무 포털 · 공개 프로토타입
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
            Google Workspace 로그인 · 연결 전
          </Button>
          <p id="google-status" className="text-muted-foreground text-sm">
            회사 Google 계정 인증과 서버 연결은 아직 구성되지 않았습니다. 이
            화면에서는 이메일이나 비밀번호를 수집하지 않습니다.
          </p>
          <div className="bg-muted flex gap-3 rounded-lg p-4 text-sm">
            <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
            <p>
              누구나 볼 수 있는 체험판입니다. 고객 개인정보·회사 기밀은 입력하지
              마세요. 입력 내용은 현재 브라우저에만 저장되며 다른 직원과
              공유되지 않습니다.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link to={ROUTES.dashboard}>프로토타입 둘러보기</Link>
          </Button>
          <Link
            to="/work/settings?team=rd"
            className="text-primary text-center text-sm underline"
          >
            저장·백업 및 연결 상태 확인
          </Link>
        </section>
      </div>
    </div>
  );
}
