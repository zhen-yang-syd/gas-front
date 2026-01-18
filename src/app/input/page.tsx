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
import { ExtensibleSensors } from "./components/ExtensibleSensors";

// 默认配置
const DEFAULT_RATE_PER_MINUTE = 60;
const DEFAULT_MAX_TABLE_ROWS = 200;
const DEFAULT_MAX_ALARMS = 200;

// 默认阈值（与后端 config.py 一致）
const DEFAULT_ULV = 6.4247;
const DEFAULT_LLV = 5.0634;
const DEFAULT_CALV = 6.0;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 阈值类型
interface ThresholdConfig {
  ulv: number;
  llv: number;
  calv: number;
}

// 核心传感器名称（T, WD, FS）
const ALL_SENSOR_NAMES = [
  // T传感器 (21个) - 瓦斯浓度
  "T010101", "T010102", "T010103", "T010104", "T010105", "T010106",
  "T010201", "T010202", "T010203", "T010204", "T010205",
  "T010301", "T010302", "T010303", "T010304", "T010305", "T010306", "T010307", "T010308",
  "T010401", "T010501",
  // WD传感器 (16个) - 温度
  "WD010101", "WD010102", "WD010103", "WD010104", "WD010105", "WD010106",
  "WD010107", "WD010108", "WD010109", "WD010110", "WD010111",
  "WD010201", "WD010301", "WD010302", "WD010401", "WD010501",
  // FS传感器 (7个) - 风速
  "FS010103", "FS010104", "FS010105",
  "FS010201", "FS010202",
  "FS010301", "FS010302",
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

  // 阈值配置状态
  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    ulv: DEFAULT_ULV,
    llv: DEFAULT_LLV,
    calv: DEFAULT_CALV,
  });
  const [thresholdInputs, setThresholdInputs] = useState<ThresholdConfig>({
    ulv: DEFAULT_ULV,
    llv: DEFAULT_LLV,
    calv: DEFAULT_CALV,
  });
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdSaveSuccess, setThresholdSaveSuccess] = useState(false);

  // 检测阈值是否有变化
  const thresholdHasChanges =
    thresholdInputs.ulv !== thresholds.ulv ||
    thresholdInputs.calv !== thresholds.calv ||
    thresholdInputs.llv !== thresholds.llv;

  // 数据状态
  const [tableData, setTableData] = useState<RowRecord[]>([]);
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [sensorStatuses, setSensorStatuses] = useState<SensorStatus[]>([]);

  // 初始化：获取后端状态和历史数据
  useEffect(() => {
    const initStatus = async () => {
      try {
        const status = await controlApi.getStatus();
        setApiConnected(true);
        setTotalRows(status.total_rows);
        setCurrentIndex(status.current_index);
        setRatePerMinute(status.rate_per_minute);
        setAppState(status.is_running ? "running" : "stopped");

        // 获取阈值配置
        try {
          const res = await fetch(`${API_BASE}/api/control/thresholds`);
          if (res.ok) {
            const data = await res.json();
            setThresholds(data);
            setThresholdInputs(data);
          }
        } catch (e) {
          console.warn("Failed to fetch thresholds:", e);
        }

        // 初始化传感器状态
        const initialStatuses: SensorStatus[] = ALL_SENSOR_NAMES.map((name) => ({
          name,
          value: null,
          status: "no-data",
          lastUpdate: formatSystemTime(),
        }));
        setSensorStatuses(initialStatuses);

        // 获取历史数据填充表格（如果正在运行或已有进度）
        if (status.current_index > 0) {
          try {
            const history = await controlApi.getHistory(DEFAULT_MAX_TABLE_ROWS);
            if (history.records && history.records.length > 0) {
              // 转换历史记录格式并填充表格
              const historyRows: RowRecord[] = history.records.map((record) => ({
                index: record.index,
                timestamp: formatSystemTime(new Date(record.timestamp)),
                sensors: record.sensors as Record<string, number | null>,
              }));
              setTableData(historyRows);

              // 更新传感器状态为最后一条记录的值
              const lastRecord = history.records[history.records.length - 1];
              if (lastRecord) {
                setSensorStatuses((prev) =>
                  prev.map((s) => ({
                    ...s,
                    value: lastRecord.sensors[s.name] ?? null,
                    status: getSensorStatus(lastRecord.sensors[s.name] ?? null, s.name),
                    lastUpdate: formatSystemTime(new Date(lastRecord.timestamp)),
                  }))
                );
              }
              console.log(`Loaded ${history.count} historical records`);
            }
          } catch (historyErr) {
            console.warn("Failed to load history:", historyErr);
          }
        }
      } catch (err) {
        console.error("Failed to connect to backend:", err);
        setLoadError("无法连接后端服务");
      }
    };

    initStatus();
  }, []);

  // 定期轮询状态（与首页统一：每2秒）
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
    }, 2000);

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
      // 使用 /api/stream/data 端点，按 freq 频率推送数据
      eventSource = new EventSource(`${API_BASE}/api/stream/data`);

      eventSource.onopen = () => {
        console.log("Input page SSE connected to /api/stream/data");
        setSseConnected(true);
      };

      eventSource.addEventListener("data", (event) => {
        try {
          const data = JSON.parse(event.data);

          // 合并核心传感器数据为统一的 readings 格式
          const readings: Record<string, number> = {};
          const sensorTypes = ["T", "WD", "FS"];
          sensorTypes.forEach((type) => {
            if (data[type]) {
              Object.entries(data[type]).forEach(([key, value]) => {
                if (value !== null) readings[key] = value as number;
              });
            }
          });

          // 使用本地时间（数据接收时的当前时间）
          const timestamp = formatSystemTime();

          // 创建表格记录
          const record: RowRecord = {
            index: data.index ?? currentIndex,
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

              // 传感器阈值配置（核心传感器）
              const sensorThresholds: Record<string, { warning: number; danger: number; preWarning?: number }> = {
                T: { preWarning: 0.6, warning: 0.8, danger: 1.0 },
              };

              // 获取传感器前缀和对应阈值
              const prefix = status.name.replace(/\d+$/, "");
              const thresholds = sensorThresholds[prefix];

              // 检查告警（所有有阈值的传感器）
              if (thresholds && value !== null && value > thresholds.warning) {
                const alarm: AlarmRecord = {
                  id: `${Date.now()}-${status.name}`,
                  time: timestamp,
                  sensor: status.name,
                  value,
                  rule: value > thresholds.danger ? `>${thresholds.danger}` : `>${thresholds.warning}`,
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

              // 检查预警（仅对有 preWarning 的传感器，如 T 类型）
              if (thresholds?.preWarning && value !== null && value > thresholds.preWarning && value <= thresholds.warning) {
                const warning: WarningRecord = {
                  id: `${Date.now()}-${status.name}-warn`,
                  time: timestamp,
                  sensor: status.name,
                  value,
                  rule: `>${thresholds.preWarning}`,
                };
                setWarnings((prevWarnings) => {
                  // 避免重复预警
                  const exists = prevWarnings.some(
                    (w) => w.sensor === status.name && w.time === timestamp
                  );
                  if (exists) return prevWarnings;
                  const newWarnings = [...prevWarnings, warning];
                  return newWarnings.slice(-DEFAULT_MAX_ALARMS);
                });
              }

              return newStatus;
            });
          });
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      });

      eventSource.addEventListener("stopped", () => {
        console.log("SSE data stream stopped");
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
    // 注意：不依赖 currentIndex，避免频繁重连 SSE
    // data.index 从 SSE 数据中获取，不需要闭包中的 currentIndex
  }, [apiConnected]);

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

  // 保存阈值
  const handleSaveThresholds = async () => {
    // 验证阈值关系: ULV > CALV > LLV > 0
    if (thresholdInputs.ulv <= thresholdInputs.calv) {
      setThresholdError("ULV 必须大于 CALV");
      return;
    }
    if (thresholdInputs.calv <= thresholdInputs.llv) {
      setThresholdError("CALV 必须大于 LLV");
      return;
    }
    if (thresholdInputs.llv <= 0) {
      setThresholdError("所有阈值必须为正数");
      return;
    }

    setThresholdError(null);
    setThresholdSaving(true);

    try {
      const res = await fetch(`${API_BASE}/api/control/thresholds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thresholdInputs),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "updated") {
          setThresholds({
            ulv: data.ulv,
            llv: data.llv,
            calv: data.calv,
          });
          // 显示保存成功提示
          setThresholdSaveSuccess(true);
          setTimeout(() => setThresholdSaveSuccess(false), 2000);
        } else if (data.error) {
          setThresholdError(data.error);
        }
      } else {
        setThresholdError("保存失败");
      }
    } catch (err) {
      console.error("Failed to save thresholds:", err);
      setThresholdError("网络错误");
    } finally {
      setThresholdSaving(false);
    }
  };

  // 重置阈值到默认值
  const handleResetThresholds = () => {
    setThresholdInputs({
      ulv: DEFAULT_ULV,
      llv: DEFAULT_LLV,
      calv: DEFAULT_CALV,
    });
    setThresholdError(null);
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
        {/* 顶部：控制面板、阈值配置和系统状态 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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

          {/* 阈值配置面板 */}
          <div className="industrial-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-accent">CAV 阈值配置</h3>
              <span className="text-xs text-dim">ULV &gt; CALV &gt; LLV</span>
            </div>

            <div className="space-y-2">
              {/* ULV 输入 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">ULV:</label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholdInputs.ulv}
                  onChange={(e) =>
                    setThresholdInputs((prev) => ({
                      ...prev,
                      ulv: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="flex-1 px-2 py-1 bg-base border border-edge rounded text-xs font-mono text-normal focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-dim">警告</span>
              </div>

              {/* CALV 输入 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">CALV:</label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholdInputs.calv}
                  onChange={(e) =>
                    setThresholdInputs((prev) => ({
                      ...prev,
                      calv: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="flex-1 px-2 py-1 bg-base border border-edge rounded text-xs font-mono text-normal focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-dim">异常</span>
              </div>

              {/* LLV 输入 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">LLV:</label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholdInputs.llv}
                  onChange={(e) =>
                    setThresholdInputs((prev) => ({
                      ...prev,
                      llv: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="flex-1 px-2 py-1 bg-base border border-edge rounded text-xs font-mono text-normal focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-dim">下限</span>
              </div>

              {/* 错误提示 */}
              {thresholdError && (
                <div className="text-xs text-err">{thresholdError}</div>
              )}

              {/* 成功提示 */}
              {thresholdSaveSuccess && (
                <div className="text-xs text-ok flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  保存成功
                </div>
              )}

              {/* 按钮 */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveThresholds}
                  disabled={thresholdSaving || !thresholdHasChanges}
                  className={`flex-1 industrial-btn text-xs py-1.5 transition-all ${
                    thresholdHasChanges
                      ? "bg-accent/20 hover:bg-accent/30 border-accent text-accent"
                      : "bg-tertiary border-edge text-dim cursor-not-allowed"
                  } disabled:opacity-50`}
                >
                  {thresholdSaving ? "保存中..." : thresholdHasChanges ? "保存修改" : "已保存"}
                </button>
                <button
                  onClick={handleResetThresholds}
                  className="industrial-btn text-xs py-1.5 hover:border-soft"
                >
                  重置
                </button>
              </div>

              {/* 当前生效值 */}
              <div className="pt-2 border-t border-edge text-xs text-dim">
                当前: ULV={thresholds.ulv.toFixed(2)}, CALV={thresholds.calv.toFixed(2)}, LLV={thresholds.llv.toFixed(2)}
              </div>
            </div>
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

        {/* 可扩展传感器类型 */}
        <ExtensibleSensors />
      </main>

      {/* Footer */}
      <footer className="border-t border-edge bg-surface px-4 py-2 text-center text-xs text-dim font-mono">
        数据输入控制台 | 后端同步模式 | 频率: {ratePerMinute} 条/分钟
      </footer>
    </div>
  );
}
