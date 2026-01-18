"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { controlApi, ControlStatus } from "./lib/api";
import {
  RowRecord,
  CavHistoryRecord,
  SensorStatus,
  AppState,
} from "./lib/types";
import { getSensorStatus, formatSystemTime } from "./lib/utils";
import {
  RealtimeTable,
  CavHistory,
  SensorGrid,
  ControlPanel,
  SystemStatusPanel,
} from "./components";

// 默认配置
const DEFAULT_RATE_PER_MINUTE = 60;
const DEFAULT_MAX_TABLE_ROWS = 200;
const DEFAULT_MAX_ALARMS = 200;

// 默认阈值（与后端 config.py 一致）
const DEFAULT_ULV = 6.4247;
const DEFAULT_LLV = 5.0634;
const DEFAULT_CALV = 6.0;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 气泡墙阈值类型（ULV/LLV）
interface BubbleThresholdConfig {
  ulv: number;
  llv: number;
}

// 完整阈值类型（兼容后端 API）
interface ThresholdConfig {
  ulv: number;
  llv: number;
  calv: number;
}

// 核心传感器名称（T, WD, FS）
const CORE_SENSOR_NAMES = [
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

// 扩展传感器名称（WY, YL, CO, SY, LL）- 预留接口，暂无数据
const EXTENSIBLE_SENSOR_NAMES = [
  // WY传感器 (3个) - 位移
  "WY010101", "WY010102", "WY010103",
  // YL传感器 (3个) - 应力
  "YL010101", "YL010102", "YL010103",
  // CO传感器 (3个) - 一氧化碳
  "CO010101", "CO010102", "CO010103",
  // SY传感器 (2个) - 水压
  "SY010101", "SY010102",
  // LL传感器 (2个) - 流量
  "LL010101", "LL010102",
];

// 所有传感器名称
const ALL_SENSOR_NAMES = [...CORE_SENSOR_NAMES, ...EXTENSIBLE_SENSOR_NAMES];

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

  // 气泡墙阈值配置状态（ULV/LLV）
  const [bubbleThresholds, setBubbleThresholds] = useState<BubbleThresholdConfig>({
    ulv: DEFAULT_ULV,
    llv: DEFAULT_LLV,
  });
  const [bubbleThresholdInputs, setBubbleThresholdInputs] = useState<BubbleThresholdConfig>({
    ulv: DEFAULT_ULV,
    llv: DEFAULT_LLV,
  });
  const [bubbleThresholdError, setBubbleThresholdError] = useState<string | null>(null);
  const [bubbleThresholdSaving, setBubbleThresholdSaving] = useState(false);
  const [bubbleThresholdSaveSuccess, setBubbleThresholdSaveSuccess] = useState(false);

  // CALV 告警阈值（独立配置）
  const [calvThreshold, setCalvThreshold] = useState(DEFAULT_CALV);
  const [calvInput, setCalvInput] = useState(DEFAULT_CALV);
  const [calvError, setCalvError] = useState<string | null>(null);
  const [calvSaving, setCalvSaving] = useState(false);
  const [calvSaveSuccess, setCalvSaveSuccess] = useState(false);

  // 检测气泡墙阈值是否有变化
  const bubbleThresholdHasChanges =
    bubbleThresholdInputs.ulv !== bubbleThresholds.ulv ||
    bubbleThresholdInputs.llv !== bubbleThresholds.llv;

  // 检测 CALV 是否有变化
  const calvHasChanges = calvInput !== calvThreshold;

  // CAV 实时数据
  const [latestCav, setLatestCav] = useState<number | null>(null);

  // 兼容旧变量（用于其他地方引用）
  const thresholds = { ulv: bubbleThresholds.ulv, llv: bubbleThresholds.llv, calv: calvThreshold };
  const thresholdInputs = { ulv: bubbleThresholdInputs.ulv, llv: bubbleThresholdInputs.llv, calv: calvInput };
  const thresholdError = bubbleThresholdError;
  const thresholdSaving = bubbleThresholdSaving;
  const thresholdSaveSuccess = bubbleThresholdSaveSuccess;
  const thresholdHasChanges = bubbleThresholdHasChanges;

  // 数据状态
  const [tableData, setTableData] = useState<RowRecord[]>([]);
  const [cavHistory, setCavHistory] = useState<CavHistoryRecord[]>([]);
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
            // 气泡墙阈值 (ULV/LLV)
            setBubbleThresholds({ ulv: data.ulv, llv: data.llv });
            setBubbleThresholdInputs({ ulv: data.ulv, llv: data.llv });
            // CALV 告警阈值
            setCalvThreshold(data.calv);
            setCalvInput(data.calv);
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

              return newStatus;
            });
          });

          // 注意：CAV 数据现在从 /api/stream/analysis 获取
          // /api/stream/data 不再处理 CAV，避免重复
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

  // SSE连接：接收分析数据（用于获取 CAV）
  // 注意：CAV 计算在 /api/stream/analysis 端点中进行
  // 需要保持此连接以触发后端 CAV 计算
  useEffect(() => {
    if (!apiConnected) return;

    let analysisSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectAnalysisSSE = () => {
      analysisSource = new EventSource(`${API_BASE}/api/stream/analysis`);

      analysisSource.onopen = () => {
        console.log("Input page SSE connected to /api/stream/analysis for CAV");
      };

      analysisSource.addEventListener("analysis", (event) => {
        try {
          const data = JSON.parse(event.data);

          // 更新全局 CAV 值
          const cavValue = data.cav?.latest ?? null;
          if (cavValue !== null && typeof cavValue === "number") {
            setLatestCav(cavValue);
          }

          // 遍历 bubble_wall.bubbles，为每个有告警/预警状态的气泡创建记录
          const bubbles = data.bubble_wall?.bubbles ?? [];
          const timestamp = formatSystemTime();
          const baseTime = Date.now();

          const newRecords: CavHistoryRecord[] = [];
          bubbles.forEach((bubble: { status?: string; sensor_pair?: [string, string]; type?: string; cav?: number }, idx: number) => {
            const status = bubble.status as string;
            if (status && status !== "NORMAL") {
              let level: "normal" | "warning" | "alarm" = "normal";
              if (status.includes("WARNING")) {
                level = "alarm";
              } else if (status.includes("ABNORMAL")) {
                level = "warning";
              }

              newRecords.push({
                id: `cav-${baseTime}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                time: timestamp,
                sensorPair: bubble.sensor_pair as [string, string],
                pairType: bubble.type as string,
                cav: bubble.cav as number,
                status: status,
                level,
              });
            }
          });

          // 新记录追加到前面（不去重，每批数据都保留）
          if (newRecords.length > 0) {
            setCavHistory((prev) => [...newRecords, ...prev]);
          }
        } catch (e) {
          console.error("Failed to parse analysis SSE data:", e);
        }
      });

      analysisSource.onerror = () => {
        console.log("Analysis SSE error, reconnecting...");
        analysisSource?.close();
        reconnectTimeout = setTimeout(connectAnalysisSSE, 5000);
      };
    };

    connectAnalysisSSE();

    return () => {
      analysisSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [apiConnected, calvThreshold]);

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
      setCavHistory([]);
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

  // 保存气泡墙阈值 (ULV/LLV)
  const handleSaveBubbleThresholds = async () => {
    // 验证阈值: ULV > LLV > 0
    if (bubbleThresholdInputs.ulv <= bubbleThresholdInputs.llv) {
      setBubbleThresholdError("ULV 必须大于 LLV");
      return;
    }
    if (bubbleThresholdInputs.llv <= 0) {
      setBubbleThresholdError("阈值必须为正数");
      return;
    }

    setBubbleThresholdError(null);
    setBubbleThresholdSaving(true);

    try {
      // 保存时包含当前 CALV 值（后端 API 需要完整数据）
      const res = await fetch(`${API_BASE}/api/control/thresholds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ulv: bubbleThresholdInputs.ulv,
          llv: bubbleThresholdInputs.llv,
          calv: calvThreshold,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "updated") {
          setBubbleThresholds({ ulv: data.ulv, llv: data.llv });
          setBubbleThresholdSaveSuccess(true);
          setTimeout(() => setBubbleThresholdSaveSuccess(false), 2000);
        } else if (data.error) {
          setBubbleThresholdError(data.error);
        }
      } else {
        setBubbleThresholdError("保存失败");
      }
    } catch (err) {
      console.error("Failed to save bubble thresholds:", err);
      setBubbleThresholdError("网络错误");
    } finally {
      setBubbleThresholdSaving(false);
    }
  };

  // 重置气泡墙阈值
  const handleResetBubbleThresholds = () => {
    setBubbleThresholdInputs({ ulv: DEFAULT_ULV, llv: DEFAULT_LLV });
    setBubbleThresholdError(null);
  };

  // 保存 CALV 告警阈值
  const handleSaveCalv = async () => {
    if (calvInput <= 0) {
      setCalvError("CALV 必须为正数");
      return;
    }

    setCalvError(null);
    setCalvSaving(true);

    try {
      // 保存时包含当前 ULV/LLV 值（后端 API 需要完整数据）
      const res = await fetch(`${API_BASE}/api/control/thresholds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ulv: bubbleThresholds.ulv,
          llv: bubbleThresholds.llv,
          calv: calvInput,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "updated") {
          setCalvThreshold(data.calv);
          setCalvSaveSuccess(true);
          setTimeout(() => setCalvSaveSuccess(false), 2000);
        } else if (data.error) {
          setCalvError(data.error);
        }
      } else {
        setCalvError("保存失败");
      }
    } catch (err) {
      console.error("Failed to save CALV:", err);
      setCalvError("网络错误");
    } finally {
      setCalvSaving(false);
    }
  };

  // 重置 CALV
  const handleResetCalv = () => {
    setCalvInput(DEFAULT_CALV);
    setCalvError(null);
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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

          {/* 气泡墙阈值配置面板 (ULV/LLV) */}
          <div className="industrial-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-accent">气泡墙阈值</h3>
              <span className="text-xs text-dim">ULV &gt; LLV</span>
            </div>

            <div className="space-y-2">
              {/* ULV 输入 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">ULV:</label>
                <input
                  type="number"
                  step="0.01"
                  value={bubbleThresholdInputs.ulv}
                  onChange={(e) =>
                    setBubbleThresholdInputs((prev) => ({
                      ...prev,
                      ulv: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="flex-1 px-2 py-1 bg-base border border-edge rounded text-xs font-mono text-normal focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-dim">上限</span>
              </div>

              {/* LLV 输入 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">LLV:</label>
                <input
                  type="number"
                  step="0.01"
                  value={bubbleThresholdInputs.llv}
                  onChange={(e) =>
                    setBubbleThresholdInputs((prev) => ({
                      ...prev,
                      llv: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="flex-1 px-2 py-1 bg-base border border-edge rounded text-xs font-mono text-normal focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-dim">下限</span>
              </div>

              {/* 错误提示 */}
              {bubbleThresholdError && (
                <div className="text-xs text-err">{bubbleThresholdError}</div>
              )}

              {/* 成功提示 */}
              {bubbleThresholdSaveSuccess && (
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
                  onClick={handleSaveBubbleThresholds}
                  disabled={bubbleThresholdSaving || !bubbleThresholdHasChanges}
                  className={`flex-1 industrial-btn text-xs py-1.5 transition-all ${
                    bubbleThresholdHasChanges
                      ? "bg-accent/20 hover:bg-accent/30 border-accent text-accent"
                      : "bg-tertiary border-edge text-dim cursor-not-allowed"
                  } disabled:opacity-50`}
                >
                  {bubbleThresholdSaving ? "保存中..." : bubbleThresholdHasChanges ? "保存修改" : "已保存"}
                </button>
                <button
                  onClick={handleResetBubbleThresholds}
                  className="industrial-btn text-xs py-1.5 hover:border-soft"
                >
                  重置
                </button>
              </div>

              {/* 当前生效值 */}
              <div className="pt-2 border-t border-edge text-xs text-dim">
                当前: ULV={bubbleThresholds.ulv.toFixed(2)}, LLV={bubbleThresholds.llv.toFixed(2)}
              </div>
            </div>
          </div>

          {/* CAV 告警阈值配置面板 (CALV) */}
          <div className="industrial-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-warn">CAV 告警阈值</h3>
              {latestCav !== null && (
                <span className={`text-xs font-mono ${
                  latestCav > calvThreshold ? "text-err" :
                  latestCav > calvThreshold * 0.85 ? "text-warn" : "text-ok"
                }`}>
                  CAV: {latestCav.toFixed(4)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* CALV 输入 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">CALV:</label>
                <input
                  type="number"
                  step="0.01"
                  value={calvInput}
                  onChange={(e) => setCalvInput(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-2 py-1 bg-base border border-edge rounded text-xs font-mono text-normal focus:border-accent focus:outline-none"
                />
                <span className="text-xs text-err">告警</span>
              </div>

              {/* 85% 预警阈值（只读显示） */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-soft w-12">85%:</label>
                <span className="flex-1 px-2 py-1 bg-tertiary border border-edge rounded text-xs font-mono text-dim">
                  {(calvInput * 0.85).toFixed(4)}
                </span>
                <span className="text-xs text-warn">预警</span>
              </div>

              {/* 错误提示 */}
              {calvError && (
                <div className="text-xs text-err">{calvError}</div>
              )}

              {/* 成功提示 */}
              {calvSaveSuccess && (
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
                  onClick={handleSaveCalv}
                  disabled={calvSaving || !calvHasChanges}
                  className={`flex-1 industrial-btn text-xs py-1.5 transition-all ${
                    calvHasChanges
                      ? "bg-warn/20 hover:bg-warn/30 border-warn text-warn"
                      : "bg-tertiary border-edge text-dim cursor-not-allowed"
                  } disabled:opacity-50`}
                >
                  {calvSaving ? "保存中..." : calvHasChanges ? "保存修改" : "已保存"}
                </button>
                <button
                  onClick={handleResetCalv}
                  className="industrial-btn text-xs py-1.5 hover:border-soft"
                >
                  重置
                </button>
              </div>

              {/* 当前生效值 */}
              <div className="pt-2 border-t border-edge text-xs text-dim">
                当前: CALV={calvThreshold.toFixed(4)} (85%={((calvThreshold * 0.85)).toFixed(4)})
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

        {/* CAV 实时历史 */}
        <CavHistory records={cavHistory} />

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
