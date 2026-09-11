/**
 * POS 전용 아이콘 (SVG).
 * 기본 이모지(🟢⚪⛔🔔🟠📦) 대신 브랜드 톤에 맞는 선/면 아이콘으로 대체한다.
 * 색은 currentColor 를 써서 부모의 CSS color 로 제어한다.
 */
import type { SVGProps } from "react";

/** 상태 점 — 온라인/오프라인, 영업중/영업종료 등 */
export function IconDot(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <circle cx="5" cy="5" r="5" />
    </svg>
  );
}

/** 직원 호출 벨 */
export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M10 2.3c-2.35 0-4.25 1.94-4.25 4.33v2.19c0 .57-.2 1.13-.58 1.56l-.96 1.11c-.6.7-.11 1.79.8 1.79h9.98c.91 0 1.4-1.09.8-1.79l-.96-1.11a2.42 2.42 0 0 1-.58-1.56V6.63c0-2.39-1.9-4.33-4.25-4.33Z"
        fill="currentColor"
      />
      <path
        d="M8.15 15.9a1.85 1.85 0 0 0 3.7 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 포장(테이크아웃) 박스 */
export function IconBox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 6.9 10 3.4l7 3.5-7 3.5-7-3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M3 6.9v6.6L10 17l7-3.5V6.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 10.4V17" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** 새로고침 */
export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M16.5 10a6.5 6.5 0 1 1-1.94-4.64"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16.7 2.8v3.8h-3.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
