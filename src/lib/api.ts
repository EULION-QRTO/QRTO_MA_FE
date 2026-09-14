/**
 * HTTP 코어. 모든 REST 호출은 여기를 거친다.
 *
 * - baseURL: config.API_BASE_URL (= https://api.lapy.shop)
 * - 인증: 세션 토큰을 Authorization: Bearer 헤더로 자동 주입
 * - 응답 envelope { success, data, error } 를 벗겨 data 만 반환 (PNG·CSV 는 envelope 없음)
 * - 실패 시 ApiError(code, message, status) throw
 */
import { API_BASE_URL } from "./config";
import { getToken, clearSession } from "./session";
import type { ApiEnvelope } from "./dto";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  /** 쿼리 파라미터 (undefined 값은 생략) */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON 바디 */
  body?: unknown;
  /** multipart/form-data 바디 */
  form?: FormData;
  /** 인증 헤더 부착 여부 (기본 true) */
  auth?: boolean;
  signal?: AbortSignal;
  /** 요청 타임아웃(ms). 초과 시 ApiError("TIMEOUT") throw. 기본 15000. */
  timeout?: number;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { query, body, form, auth = true, signal, timeout = 15000 } = opts;
  const headers: Record<string, string> = {};

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (form) {
    payload = form; // Content-Type 은 브라우저가 boundary 와 함께 설정
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  // 타임아웃 처리: 자체 AbortController + 외부 signal 결합
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeout > 0 ? setTimeout(() => { timedOut = true; controller.abort(); }, timeout) : null;
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      if (timedOut) throw new ApiError("TIMEOUT", "서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.", 0);
      throw e; // 외부에서 취소한 경우
    }
    throw new ApiError("NETWORK", "서버에 연결할 수 없습니다.", 0);
  } finally {
    if (timer) clearTimeout(timer);
  }

  // 401 → 세션 만료 처리
  if (res.status === 401) {
    clearSession();
  }

  // 응답 파싱 (envelope 우선, 아니면 raw)
  const text = await res.text();
  let json: ApiEnvelope<T> | T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as ApiEnvelope<T> | T;
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const env = json as ApiEnvelope<T> | null;
    const err = env?.error;
    throw new ApiError(err?.code ?? String(res.status), err?.message ?? res.statusText, res.status);
  }

  // envelope 형태면 data 를, 아니면 그대로 반환
  if (json && typeof json === "object" && "success" in json) {
    const env = json as ApiEnvelope<T>;
    if (env.success === false) {
      throw new ApiError(env.error?.code ?? "UNKNOWN", env.error?.message ?? "요청 실패", res.status);
    }
    return env.data as T;
  }
  return json as T;
}

/** 이미지(PNG) 바이트 응답 → object URL. envelope 로 감싸지 않는 엔드포인트 전용. */
export async function fetchImageObjectUrl(
  path: string,
  query?: RequestOptions["query"],
): Promise<string> {
  const token = getToken();
  const res = await fetch(buildUrl(path, query), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(String(res.status), "이미지 요청 실패", res.status);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * 파일 다운로드(CSV 등). envelope 없음. 인증 헤더를 싣고 Blob + 파일명을 반환한다.
 * Content-Disposition 의 filename* / filename 을 파싱하고, 없으면 fallback 사용.
 */
export async function fetchFile(
  path: string,
  opts: { query?: RequestOptions["query"]; fallbackName?: string } = {},
): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(buildUrl(path, opts.query), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) clearSession();
  if (!res.ok) throw new ApiError(String(res.status), "파일 요청 실패", res.status);
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  const plain = cd.match(/filename="?([^";]+)"?/i);
  let filename = opts.fallbackName ?? "download.csv";
  try {
    if (star) filename = decodeURIComponent(star[1].trim());
    else if (plain) filename = plain[1].trim();
  } catch {
    /* 파일명 파싱 실패 시 fallback 유지 */
  }
  return { blob: await res.blob(), filename };
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, opts?: RequestOptions) => request<T>("POST", path, opts),
  patch: <T>(path: string, opts?: RequestOptions) => request<T>("PATCH", path, opts),
  put: <T>(path: string, opts?: RequestOptions) => request<T>("PUT", path, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
};
