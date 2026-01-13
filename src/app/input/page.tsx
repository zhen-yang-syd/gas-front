"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { controlApi, ControlStatus } from "./lib/api";
import {
  RowRecord,
  AlarmRecord,
  WarningRecord,
  SensorStatus,
  AppState,
} from "./lib/types";
import { getSensorStatus, formatSystemTime } from "./lib/utils";
import {
  RealtimeTable,
  AlarmHistory,
  WarningPanel,
  SensorGrid,
  ControlPanel,
  SystemStatusPanel,
} from "./components";

// 默认配置
const DEFAULT_RATE_PER_MINUTE = 60;
const DEFAULT_MAX_TABLE_ROWS = 200;
const DEFAULT_MAX_ALARMS = 200;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 所有传感器名称（从配置获取）
const ALL_SENSOR_NAMES = [
  // T传感器 (21个)
  "T010101", "T010102", "T010103", "T010104", "T010105", "T010106",
  "T010201", "T010202", "T010203", "T010204", "T010205",
  "T010301", "T010302", "T010303", "T010304", "T010305", "T010306", "T010307", "T010308",
  "T010401", "T010501",
  // WD传感器 (16个)
  "WD010101", "WD010102", "WD010103", "WD010104", "WD010105", "WD010106",
  "WD010107", "WD010108", "WD010109", "WD010110", "WD010111",
  "WD010201", "WD010301", "WD010302", "WD010401", "WD010501",
  // FS传感器 (10个)
  "FS010101", "FS010102", "FS010103", "FS010104", "FS010105",
  "FS010201", "FS010202",
  "FS010301", "FS010302",
  "FS010401",
];

export default function InputPage() {
  // API连接状态
  const [apiConnected, setApiConnected] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 应用状态
  const [appState, setAppState] = useState<AppState>("stopped");
  const [ratePerMinute, setRatePerMinute] = useState(DEFAULT_RATE_PER_MINUTE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [runtime, setRuntime] = useState(0);

  // 运行时间起始点
  const startTimeRef = useRef<number | null>(null);

  // 数据状态
  const [tableData, setTableData] = useState<RowRecord[]>([]);
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [sensorStatuses, setSensorStatuses] = useState<SensorStatus[]>([]);

  // 初始化：获取后端状态
  useEffect(() => {
    const initStatus = async () => {
      try {
        const status = await controlApi.getStatus();
        setApiConnected(true);
        setTotalRows(status.total_rows);
        setCurrentIndex(status.current_index);
        setRatePerMinute(status.rate_per_minute);
        setAppState(status.is_running ? "running" : "stopped");

        // 初始化传感器状态
        const initialStatuses: SensorStatus[] = ALL_SENSOR_NAMES.map((name) => ({
          name,
          value: null,
          status: "no-data",
          lastUpdate: formatSystemTime(),
        }));
        setSensorStatuses(initialStatuses);
      } catch (err) {
        console.error("Failed to connect to backend:", err);
        setLoadError("无法连接后端服务");
      }
    };

    initStatus();
  }, []);

  // 定期轮询状态（每秒）
  useEffect(() => {
    if (!apiConnected) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await controlApi.getStatus();
        setCurrentIndex(status.current_index);
        setTotalRows(status.total_rows);

        // 更新运行状态
        if (status.is_running && appState !== "running") {
          setAppState("running");
        } else if (!status.is_running && appState === "running") {
          // 检查是否完成
          if (status.current_index >= status.total_rows - 1) {
            setAppState("completed");
          } else {
            setAppState("stopped");
          }
        }
      } catch (err) {
        console.error("Status poll failed:", err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [apiConnected, appState]);

  // 运行时间计时
  useEffect(() => {
    if (appState === "running") {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        if (startTimeRef.current !== null) {
          setRuntime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else if (appState === "stopped") {
      startTimeRef.current = null;
      setRuntime(0);
    }
  }, [appState]);

  // SSE连接：接收实时数据
  useEffect(() => {
    if (!apiConnected) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`${API_BASE}/api/stream/analysis`);

      eventSource.onopen = () => {
        console.log("Input page SSE connected");
        setSseConnected(true);
      };

      eventSource.addEventListener("analysis", (event) => {
        try {
          const data = JSON.parse(event.data);

          // 更新当前索引
          if (typeof data.index === "number") {
            setCurrentIndex(data.index);
          }

          // 处理传感器读数
          if (data.sensor_readings) {
            // 格式化时间戳：ISO 格式 -> YYYY/MM/DD_HH:mm:ss
            const rawTimestamp = data.timestamp || new Date().toISOString();
            const timestamp = formatSystemTime(new Date(rawTimestamp));
            const readings = data.sensor_readings as Record<string, number>;

            // 创建表格记录
            const record: RowRecord = {
              index: data.index || currentIndex,
              timestamp,
              sensors: readings,
            };

            // 更新表格数据
            setTableData((prev) => {
              const newData = [...prev, record];
              return newData.slice(-DEFAULT_MAX_TABLE_ROWS);
            });

            // 更新传感器状态
            setSensorStatuses((prev) => {
              return prev.map((status) => {
                const value = readings[status.name] ?? null;
                const newStatus: SensorStatus = {
                  name: status.name,
                  value,
                  status: getSensorStatus(value, status.name),
                  lastUpdate: timestamp,
                };

                // 检查告警（只对T开头的传感器，value > 0.8）
                if (status.name.startsWith("T") && value !== null && value > 0.8) {
                  const alarm: AlarmRecord = {
                    id: `${Date.now()}-${status.name}`,
                    time: timestamp,
                    sensor: status.name,
                    value,
                    rule: value > 1.0 ? ">1.0" : ">0.8",
                  };
                  setAlarms((prevAlarms) => {
                    // 避免重复告警
                    const exists = prevAlarms.some(
                      (a) => a.sensor === status.name && a.time === timestamp
                    );
                    if (exists) return prevAlarms;
                    const newAlarms = [...prevAlarms, alarm];
                    return newAlarms.slice(-DEFAULT_MAX_ALARMS);
                  });
                }

                return newStatus;
              });
            });
          }
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      });

      eventSource.addEventListener("waiting", () => {
        console.log("SSE waiting for data stream");
      });

      eventSource.onerror = () => {
        console.log("SSE error, reconnecting...");
        setSseConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [apiConnected, currentIndex]);

  // 控制函数 - 调用后端API
  const handleStart = async () => {
    try {
      await controlApi.start();
      setAppState("running");
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error("Failed to start:", err);
    }
  };

  const handleStop = async () => {
    try {
      await controlApi.stop();
      setAppState("stopped");
    } catch (err) {
      console.error("Failed to stop:", err);
    }
  };

  const handleReset = async () => {
    try {
      await controlApi.reset();
      setTableData([]);
      setAlarms([]);
      setWarnings([]);
      setCurrentIndex(0);
      setRuntime(0);
      setAppState("stopped");
      startTimeRef.current = null;

      // 重置传感器状态
      const resetStatuses: SensorStatus[] = ALL_SENSOR_NAMES.map((name) => ({
        name,
        value: null,
        status: "no-data",
        lastUpdate: formatSystemTime(),
      }));
      setSensorStatuses(resetStatuses);
    } catch (err) {
      console.error("Failed to reset:", err);
    }
  };

  const handleRateChange = async (rate: number) => {
    try {
      await controlApi.setRatePerMinute(rate);
      setRatePerMinute(rate);
    } catch (err) {
      console.error("Failed to change rate:", err);
    }
  };

  const handleJump = async (index: number) => {
    try {
      await controlApi.seek(index);
      setCurrentIndex(index);
    } catch (err) {
      console.error("Failed to seek:", err);
    }
  };

  // 加载中状态
  if (!apiConnected) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          {loadError ? (
            <div className="text-err text-xl">{loadError}</div>
          ) : (
            <>
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-accent text-lg">连接后端服务中...</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="border-b border-edge bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="industrial-title text-lg">
              <span className="text-accent font-display">DATA INPUT</span>
              <span className="text-soft ml-2 text-sm font-body">
                数据输入控制台
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="industrial-btn text-xs px-3 py-1.5 hover:border-accent"
            >
              返回主界面
            </Link>
            <div className="flex items-center gap-1.5">
              <span
                className={`status-indicator ${apiConnected ? "status-normal" : "status-danger"}`}
              />
              <span className="text-xs text-soft">API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`status-indicator ${sseConnected ? "status-info" : "status-muted"}`}
              />
              <span className="text-xs text-soft">SSE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`status-indicator ${appState === "running" ? "status-info" : "status-muted"}`}
              />
              <span className="text-xs text-soft">运行</span>
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
              ratePerMinute={ratePerMinute}
              onRateChange={handleRateChange}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
              onJump={handleJump}
              isRunning={appState === "running"}
              isCompleted={appState === "completed"}
              totalRows={totalRows}
            />
          </div>
          <div>
            <SystemStatusPanel
              state={appState}
              currentIndex={currentIndex}
              totalRows={totalRows}
              runtime={runtime}
            />
          </div>
        </div>

        {/* 实时数据表格 */}
        <RealtimeTable
          data={tableData}
          sensorNames={ALL_SENSOR_NAMES}
          maxRows={DEFAULT_MAX_TABLE_ROWS}
        />

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
        数据输入控制台 | 后端同步模式 | 频率: {ratePerMinute} 条/分钟
      </footer>
    </div>
  );
}
