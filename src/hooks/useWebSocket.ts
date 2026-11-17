import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsClientMessage, WsServerMessage } from '../types.ts';
import { getAdminToken } from '../utils/adminAuth.ts';

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export function useRealtimeSocket(onMessage: (msg: WsServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const pendingQueueRef = useRef<WsClientMessage[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState<WsConnectionStatus>('connecting');

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = getAdminToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws${qs}`);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus('connected');
      while (pendingQueueRef.current.length > 0) {
        const queued = pendingQueueRef.current.shift();
        if (queued) ws.send(JSON.stringify(queued));
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WsServerMessage;
        onMessageRef.current(parsed);
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus('reconnecting');
      const delay = Math.min(8000, 800 * Math.pow(1.6, attemptRef.current));
      attemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: WsClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      pendingQueueRef.current.push(msg);
    }
  }, []);

  return { status, sendMessage };
}
