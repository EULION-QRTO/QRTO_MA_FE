import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 화면 어딘가(예: API 응답에 아직 없는 필드 접근 같은 예상 못한 런타임 에러)에서
 * 렌더링이 실패해도 앱 전체가 그냥 새하얗게 멈추지 않도록 잡아준다.
 * React 는 에러 바운더리가 없으면 렌더 중 던진 에러를 트리 전체를 언마운트해
 * "화면에 아무것도 안 뜨는" 증상으로 만든다 — 이 컴포넌트가 그걸 막는다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] 처리되지 않은 렌더링 오류:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash">
          <p className="app-crash__title">화면을 표시하는 중 문제가 발생했습니다.</p>
          <p className="app-crash__msg">{this.state.error.message}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
