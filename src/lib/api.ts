/**
 * HTTP 코어. 모든 REST 호출은 여기를 거친다.
 *
 * - baseURL: config.API_BASE_URL (= https://api.lapy.shop)
 * - 인증: 세션 토큰을 Authorization: Bearer 헤더로 자동 주입
 * - 응답 envelope { success, data, error } 를 벗겨 data 만 반환 (PNG·CSV 는 envelope 없음)
 * - 실패 시 ApiError(code, message, status) throw
 * - 네트워크 계열 실패(fetch 자체 실패·타임아웃)는 GET 에 한해 지수 백오프로 자동 재시도하고,
 *   모든 요청의 성공/실패를 networkStatus 에 보고해 화면 상단 연결 배너가 반응하게 한다.
 * - 변경 요청(POST/PATCH/PUT/DELETE)은 자동 재시도하지 않는다 — 서버가 실제로 처리했는데
 *   응답만 못 받은 경우 재시도가 중복 생성이 될 수 있어서다. idempotencyKey 옵션으로 헤더는
 *   실어 보낼 수 있게 해뒀지만(수동 재시도 시 같은 키 재사용 용도), 서버가 이 헤더를 실제로
 *   처리하는지는 별도 확인이 필요하다 — 아직 명세서에 명시된 바 없음.
 */
import { API_BASE_URL } from "./config";
import { getToken, clearSession } from "./session";
import { reportApiFailure, reportApiSuccess } from "./networkStatus";
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

/** 모든 실패를 이 함수로만 던진다 — 콘솔에 "몇 번(코드) 무슨 사유"가 항상 남는다. */
function fail(method: string, path: string, status: number, code: string, message: string): never {
  console.error(`[api] ${method} ${path} → ${status} ${code} · ${message}`);
  throw new ApiError(code, message, status);
}

/** GET 자동 재시도 설정. 최초 시도 + 재시도 GET_MAX_RETRIES 회 = 총 GET_MAX_RETRIES+1 회. */
const GET_MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const backoffDelay = (attempt: number) => RETRY_BASE_MS * 2 ** (attempt - 1); // 1회차 500ms, 2회차 1000ms…

/** crypto.randomUUID() 기반 — 요청 생성 시 한 번 발급해 재시도(수동 포함) 시 그대로 재사용한다. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface RequestOptions {
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
  /**
   * 변경 요청에 Idempotency-Key 헤더를 실어 보낸다. newIdempotencyKey() 로 한 번 만들어
   * 두고, 같은 논리적 시도(수동 재시도 포함)에는 같은 값을 재사용해야 의미가 있다.
   * ⚠️ 서버가 이 헤더를 실제로 처리하는지 확인 전이라, 이것만으로 중복 생성이 100%
   * 방지된다고 보장할 수 없다.
   */
  idempotencyKey?: string;
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
  const { query, body, form, auth = true, signal, timeout = 15000, idempotencyKey } = opts;
  const headers: Record<string, string> = {};

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let payload: BodyInit | undefined;
  if (form) {
    payload = form; // Content-Type 은 브라우저가 boundary 와 함께 설정
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  // GET 만 자동 재시도(멱등이라 안전). 변경 요청은 절대 여기서 재시도하지 않는다.
  const retryable = method === "GET";
  let attempt = 0;

  for (;;) {
    // 타임아웃 처리: 자체 AbortController + 외부 signal 결합 (매 시도마다 새로 만든다)
    const controller = new AbortController();
    let timedOut = false;
    const timer = timeout > 0 ? setTimeout(() => { timedOut = true; controller.abort(); }, timeout) : null;
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let res: Response;
    try {
      res = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: payload,
        signal: controller.signal,
        // GET 재조회가 브라우저/중간 캐시의 오래된 응답을 받지 않도록 함.
        // POST/PATCH/PUT/DELETE 는 원래 캐시 대상이 아니라 의미가 없고,
        // 오히려 일부 iOS/iPadOS Safari 버전은 FormData(멀티파트) 바디 +
        // cache:"no-store" 조합에서 fetch 자체가 즉시 실패하는(=NETWORK 오류로
        // 보이는) 버그가 있어 GET 에만 한정한다.
        cache: method === "GET" ? "no-store" : undefined,
      });
    } catch (e) {
      if (timer) clearTimeout(timer);
      if ((e as Error).name === "AbortError") {
        if (timedOut) {
          reportApiFailure();
          if (retryable && attempt < GET_MAX_RETRIES) {
            attempt++;
            await sleep(backoffDelay(attempt));
            continue;
          }
          return fail(method, path, 0, "TIMEOUT", "서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.");
        }
        throw e; // 외부에서 취소한 경우 — 재시도 대상 아님
      }
      // fetch() 자체가 실패한 경우(CORS 차단·네트워크 단절·WebKit 버그 등) —
      // ApiError 로 감싸면 사라지는 실제 예외(이름/메시지)를 그대로 남긴다.
      reportApiFailure();
      console.error(`[api] ${method} ${path} → fetch 실패${attempt > 0 ? ` (재시도 ${attempt}회째)` : ""}:`, e);
      if (retryable && attempt < GET_MAX_RETRIES) {
        attempt++;
        await sleep(backoffDelay(attempt));
        continue;
      }
      return fail(method, path, 0, "NETWORK", "서버에 연결할 수 없습니다.");
    }
    if (timer) clearTimeout(timer);

    // 상태 코드와 무관하게 응답을 받았다는 것 자체가 "통신 경로는 살아있다"는 뜻
    reportApiSuccess();

    // 401 → 세션 만료 처리
    if (res.status === 401) {
      clearSession();
    }

    // 응답 파싱 (envelope 우선, 아니면 raw)
    const text = await res.text();
    let json: ApiEnvelope<T> | T | null = null;
    let parseError: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as ApiEnvelope<T> | T;
      } catch (e) {
        parseError = e;
        json = null;
      }
    }

    if (!res.ok) {
      const env = json as ApiEnvelope<T> | null;
      const err = env?.error;
      // 서버가 envelope 형태로 에러를 안 줬을 때(예: 프록시/CDN 이 가로챈 HTML
      // 에러 페이지) 원인을 알 수 있도록 응답 본문을 그대로 남긴다.
      if (!err) console.error(`[api] ${method} ${path} → ${res.status} 응답 본문:`, text.slice(0, 500));
      return fail(method, path, res.status, err?.code ?? String(res.status), err?.message ?? res.statusText);
    }

    if (parseError) {
      console.error(`[api] ${method} ${path} → 200 이지만 JSON 파싱 실패, 응답 본문:`, text.slice(0, 500));
    }

    // envelope 형태면 data 를, 아니면 그대로 반환
    if (json && typeof json === "object" && "success" in json) {
      const env = json as ApiEnvelope<T>;
      if (env.success === false) {
        return fail(method, path, res.status, env.error?.code ?? "UNKNOWN", env.error?.message ?? "요청 실패");
      }
      return env.data as T;
    }
    return json as T;
  }
}

/** 이미지(PNG) 바이트 응답 → object URL. envelope 로 감싸지 않는 엔드포인트 전용. GET 이라 재시도 대상. */
export async function fetchImageObjectUrl(
  path: string,
  query?: RequestOptions["query"],
): Promise<string> {
  const token = getToken();
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(buildUrl(path, query), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
    } catch (e) {
      reportApiFailure();
      console.error(`[api] GET ${path} → fetch 실패:`, e);
      if (attempt < GET_MAX_RETRIES) {
        attempt++;
        await sleep(backoffDelay(attempt));
        continue;
      }
      return fail("GET", path, 0, "NETWORK", "서버에 연결할 수 없습니다.");
    }
    reportApiSuccess();
    if (!res.ok) return fail("GET", path, res.status, String(res.status), "이미지 요청 실패");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
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
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch (e) {
    reportApiFailure();
    console.error(`[api] GET ${path} → fetch 실패:`, e);
    return fail("GET", path, 0, "NETWORK", "서버에 연결할 수 없습니다.");
  }
  reportApiSuccess();
  if (res.status === 401) clearSession();
  if (!res.ok) return fail("GET", path, res.status, String(res.status), "파일 요청 실패");
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
