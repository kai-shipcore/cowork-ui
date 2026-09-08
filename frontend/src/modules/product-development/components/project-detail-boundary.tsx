import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@coverland-engineering/ui/button';

interface ProjectDetailBoundaryProps {
  children: ReactNode;
  /** Called when the operator asks to go back to the project list. */
  onBack: () => void;
}

interface ProjectDetailBoundaryState {
  error?: Error;
}

/**
 * Catches render errors in the project detail view so a failure shows what
 * broke instead of a blank page.
 *
 * Deviation from CODING_STANDARDS §6 ("function components only"): React
 * implements error boundaries only through the class lifecycle
 * (`componentDidCatch` / `getDerivedStateFromError`). There is no hook
 * equivalent, and adding `react-error-boundary` would need dependency
 * approval, so a class is the narrowest compliant option here.
 */
export class ProjectDetailBoundary extends Component<
  ProjectDetailBoundaryProps,
  ProjectDetailBoundaryState
> {
  override state: ProjectDetailBoundaryState = {};

  static getDerivedStateFromError(error: Error): ProjectDetailBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The stack is the only clue an operator can hand back when reporting a
    // blank screen, so keep it in the console deliberately.
    console.error('Project detail view failed to render', error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <div className="project-detail-error">
        <strong>이 프로젝트 화면을 표시하지 못했습니다.</strong>
        <p>
          저장된 로컬 데이터가 현재 데이터 모델과 맞지 않을 때 주로 발생합니다.
          프로젝트 목록의 &quot;Reset Mock Data&quot;로 초기화하면 대부분
          해결됩니다.
        </p>
        <pre>{error.message}</pre>
        <Button variant="outline" onClick={this.props.onBack}>
          프로젝트 목록으로
        </Button>
      </div>
    );
  }
}
