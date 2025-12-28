"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";

export interface SSEOptions {
  onOpen?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

/**
 * SSE Hook - 订阅服务端事件流
 */
export function useSSE<T>(
  endpoint: string,
  eventName: string = "message",
  options: SSEOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    onOpen,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const connect = useCallback(() => {
    const url = `${API_BASE_URL}${endpoint}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      onOpen?.();
    };

    eventSource.addEventListener(eventName, (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch {
        console.error("Failed to parse SSE data:", event.data);
      }
    });

    eventSource.onerror = (e) => {
      setIsConnected(false);
      setError("Connection lost");
      onError?.(e);

      eventSource.close();

      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };
  }, [endpoint, eventName, onOpen, onError, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { data, isConnected, error, reconnect: connect, disconnect };
}

/**
 * 数据流 Hook
 */
export function useDataStream() {
  return useSSE<{
    timestamp: string;
    T: Record<string, number>;
    WD: Record<string, number>;
    FS: Record<string, number>;
  }>("/api/stream/data", "data");
}

/**
 * 分析结果流 Hook
 */
export function useAnalysisStream() {
  return useSSE<{
    correlations: Array<{
      pair: [string, string];
      r: number;
      strength: string;
    }>;
    cav: number;
    calv: number;
    is_warning: boolean;
    bubble_states: Array<{
      pair: [string, string];
      cav: number;
      status: string;
      color: string;
    }>;
  }>("/api/stream/analysis", "analysis");
}

/**
 * 告警流 Hook
 */
export function useAlertStream() {
  return useSSE<{
    type: string;
    sensor?: string;
    value?: number;
    timestamp?: string;
  }>("/api/stream/alerts", "alert");
}
