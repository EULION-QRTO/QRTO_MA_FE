/**
 * 실시간(STOMP) 연동.
 *
 * STOMP /ws (native WebSocket, SockJS 아님) 에 연결하고
 *  - SUB /topic/stores/{storeId}/orders       (NEW_ORDER | STATUS_CHANGED)
 *  - SUB /topic/stores/{storeId}/staff-calls   (CALLED | RESOLVED)
 * 를 구독한다. @stomp/stompjs 사용.
 */
import { Client, ReconnectionTimeMode, type IMessage } from "@stomp/stompjs";
import { WS_BASE_URL } from "./config";
import { getToken } from "./session";
import type { OrderEvent, StaffCallEvent } from "./dto";

export interface RealtimeHandlers {
  onOrder?: (event: OrderEvent) => void;
  onStaffCall?: (event: StaffCallEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * 포스 실시간 구독 시작. 반환된 함수를 호출하면 해제한다.
 */
export function connectRealtime(storeId: string | number, handlers: RealtimeHandlers): () => void {
  const token = getToken();
  const client = new Client({
    brokerURL: WS_BASE_URL,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    // 축제 현장 와이파이가 끊겼다 붙었다 할 때 3초 고정 재시도로 계속 두드리지 않도록
    // 지수 백오프(1초 → 최대 30초)로 재연결한다. 재연결 후 재동기화는 PosApp 의
    // onConnect 핸들러(끊긴 동안 놓친 이벤트를 메꾸는 전체 재조회)가 담당한다.
    reconnectDelay: 1000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    maxReconnectDelay: 30000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  const parse = <T>(msg: IMessage): T | null => {
    try {
      return JSON.parse(msg.body) as T;
    } catch {
      return null;
    }
  };

  client.onConnect = () => {
    client.subscribe(`/topic/stores/${storeId}/orders`, (msg) => {
      const ev = parse<OrderEvent>(msg);
      if (ev) handlers.onOrder?.(ev);
    });
    client.subscribe(`/topic/stores/${storeId}/staff-calls`, (msg) => {
      const ev = parse<StaffCallEvent>(msg);
      if (ev) handlers.onStaffCall?.(ev);
    });
    handlers.onConnect?.();
  };

  client.onWebSocketClose = () => handlers.onDisconnect?.();

  client.activate();

  return () => {
    void client.deactivate();
  };
}
