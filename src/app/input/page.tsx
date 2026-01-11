"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { healthCheck, controlApi, SensorConfig } from "@/lib/api";
import {
  RealtimeTable,
  AlarmHistory,
  WarningPanel,
  SensorGrid,
  ControlPanel,
  SystemStatusPanel,
  RowRecord,
  AlarmRecord,
  WarningRecord,
  SensorStatus,
  AppState,
  getSensorStatus,
  formatSystemTime,
} from "./components";

interface SystemStatusAPI {
  is_running: boolean;
  frequency: number;
  current_index: number;
  total_rows: number;
  progress: number;
}

// 配置常量
const DEFAULT_MAX_TABLE_ROWS = 200;
const DEFAULT_MAX_ALARMS = 200;

export default function InputPage() {
  // API 和连接状态
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "error">("loading");
  const [sseConnected, setSseConnected] = useState(false);
  const [sensorConfig, setSensorConfig] = useState<SensorConfig | null>(null);
  const [systemStatusAPI, setSystemStatusAPI] = useState<SystemStatusAPI | null>(null);

  // 应用状态
  const [appState, setAppState] = useState<AppState>("stopped");
  const [selectedFreq, setSelectedFreq] = useState(10);
  const [runTime, setRunTime] = useState(0);
  const runTimeRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // 数据状态 (demo-gas 格式)
  const [tableData, setTableData] = useState<RowRecord[]>([]);
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [sensorStatuses, setSensorStatuses] = useState<SensorStatus[]>([]);

  // 传感器名称列表
  const [allSensorNames, setAllSensorNames] = useState<string[]>([]);

  // 检查API连接
  useEffect(() => {
    healthCheck()
      .then(() => {
        setApiStatus("connected");
        return controlApi.getSensors();
      })
      .then((config) => {
        setSensorConfig(config);
        // 构建传感器名称列表
        const names = [
          ...(config.available?.T || []),
          ...(config.available?.WD || []),
          ...(config.available?.FS || []),
        ];
        setAllSensorNames(names);
        // 初始化传感器状态
        const initialStatuses: SensorStatus[] = names.map((name) => ({
          name,
          value: null,
          status: "no-data",
          lastUpdate: formatSystemTime(),
        }));
        setSensorStatuses(initialStatuses);
      })
      .catch(() => setApiStatus("error"));
  }, []);

  // 获取系统状态
  const fetchStatus = useCallback(async () => {
    try {
      const status = await controlApi.getStatus();
      setSystemStatusAPI(status);
      setSelectedFreq(status.frequency);

      // 更新应用状态
      if (status.is_running) {
        setAppState("running");
        if (!startTimeRef.current) {
          startTimeRef.current = Date.now();
        }
      } else if (status.progress >= 1) {
        setAppState("completed");
      } else {
        setAppState("stopped");
        startTimeRef.current = null;
        setRunTime(0);
      }
    } catch (e) {
      console.error("Failed to fetch status:", e);
    }
  }, []);

  // 初始化
  useEffect(() => {
    if (apiStatus === "connected") {
      fetchStatus();
    }
  }, [apiStatus, fetchStatus]);

  // 运行时间计时器
  useEffect(() => {
    if (appState === "running" && startTimeRef.current) {
      runTimeRef.current = setInterval(() => {
        setRunTime(Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000));
      }, 1000);
    }
    return () => {
      if (runTimeRef.current) clearInterval(runTimeRef.current);
    };
  }, [appState]);

  // SSE 实时数据流
  useEffect(() => {
    if (apiStatus !== "connected") return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`${API_BASE}/api/stream/analysis`);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.addEventListener("analysis", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.sensor_readings) {
            const timestamp = formatSystemTime();

            // 构建 RowRecord (demo-gas 格式)
            const record: RowRecord = {
              timestamp,
              sensors: data.sensor_readings,
            };

            // 更新表格数据
            setTableData((prev) => {
              const newData = [...prev, record];
              return newData.slice(-DEFAULT_MAX_TABLE_ROWS);
            });

            // 更新传感器状态
            setSensorStatuses((prev) =>
              prev.map((status) => {
                const value = data.sensor_readings[status.name] ?? null;
                return {
                  name: status.name,
                  value,
                  status: getSensorStatus(value, status.name),
                  lastUpdate: timestamp,
                };
              })
            );

            // 检查 TLV 告警 (T 传感器 > 0.8)
            Object.entries(data.sensor_readings).forEach(([sensor, value]) => {
              if (typeof value === "number" && value > 0.8 && sensor.startsWith("T")) {
                const alarm: AlarmRecord = {
                  id: `${Date.now()}-${sensor}`,
                  time: timestamp,
                  sensor,
                  value,
                  rule: value > 1.0 ? ">1.0" : ">0.8",
                };
                setAlarms((prev) => {
                  const newAlarms = [...prev, alarm];
                  return newAlarms.slice(-DEFAULT_MAX_ALARMS);
                });
              }
            });
          }

          // CAV 预警
          if (data.alert?.is_alert) {
            const warning: WarningRecord = {
              id: `cav-${Date.now()}`,
              time: formatSystemTime(),
              sensor: "CAV",
              value: data.alert.cav,
              rule: `CAV > CALV(${data.alert.calv?.toFixed(4)})`,
            };
            setWarnings((prev) => {
              // 避免5秒内重复
              if (prev.length > 0 && Date.now() - parseInt(prev[prev.length - 1].id.split("-")[1]) < 5000) {
                return prev;
              }
              return [...prev, warning].slice(-DEFAULT_MAX_ALARMS);
            });
          }
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      });

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();
    const statusInterval = setInterval(() => void fetchStatus(), 2000);

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(statusInterval);
    };
  }, [apiStatus, fetchStatus]);

  // 控制操作
  const handleStart = async () => {
    await controlApi.start();
    startTimeRef.current = Date.now();
    setAppState("running");
    fetchStatus();
  };

  const handleStop = async () => {
    await controlApi.stop();
    setAppState("stopped");
    fetchStatus();
  };

  const handleReset = async () => {
    await controlApi.reset();
    setTableData([]);
    setAlarms([]);
    setWarnings([]);
    startTimeRef.current = null;
    setRunTime(0);
    setAppState("stopped");
    // 重置传感器状态
    setSensorStatuses((prev) =>
      prev.map((s) => ({
        ...s,
        value: null,
        status: "no-data",
        lastUpdate: formatSystemTime(),
      }))
    );
    fetchStatus();
  };

  const handleFreqChange = async (freq: number) => {
    setSelectedFreq(freq);
    await controlApi.setFrequency(freq);
    fetchStatus();
  };

  const handleSeek = async (index: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/control/seek/${index}`, {
      method: "PUT",
    });
    fetchStatus();
  };

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="border-b border-edge bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="industrial-title text-lg">
              <span className="text-accent font-display">DATA INPUT</span>
              <span className="text-soft ml-2 text-sm font-body">数据输入控制台</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="industrial-btn text-xs px-3 py-1.5 hover:border-accent">
              返回主界面
            </Link>
            <div className="flex items-center gap-1.5">
              <span className={`status-indicator ${apiStatus === "connected" ? "status-normal" : "status-danger"}`} />
              <span className="text-xs text-soft">API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`status-indicator ${sseConnected ? "status-info" : "status-muted"}`} />
              <span className="text-xs text-soft">SSE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4">
        {/* 顶部：控制面板和系统状态 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ControlPanel
              frequency={selectedFreq}
              onFrequencyChange={handleFreqChange}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
              onJump={handleSeek}
              isRunning={appState === "running"}
              isCompleted={appState === "completed"}
              totalRows={systemStatusAPI?.total_rows || 0}
            />
          </div>
          <div>
            <SystemStatusPanel
              state={appState}
              currentIndex={systemStatusAPI?.current_index || 0}
              totalRows={systemStatusAPI?.total_rows || 0}
              runtime={runTime}
            />
          </div>
        </div>

        {/* 实时数据表格 */}
        <RealtimeTable data={tableData} sensorNames={allSensorNames} maxRows={DEFAULT_MAX_TABLE_ROWS} />

        {/* 告警历史和预警面板并排 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AlarmHistory alarms={alarms} maxAlarms={DEFAULT_MAX_ALARMS} />
          <WarningPanel warnings={warnings} />
        </div>

        {/* 传感器状态网格 */}
        <SensorGrid sensors={sensorStatuses} />
      </main>

      {/* Footer */}
      <footer className="border-t border-edge bg-surface px-4 py-2 text-center text-xs text-dim font-mono">
        数据输入控制台 | 实时监测
      </footer>
    </div>
  );
}
