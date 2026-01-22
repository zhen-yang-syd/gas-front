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
import { AlarmRecord } from "./components/types";
import { getSensorStatus, formatSystemTime } from "./lib/utils";
import {
  RealtimeTable,
  CavHistory,
  SensorGrid,
  ControlPanel,
  SystemStatusPanel,
  AlarmHistory,
} from "./components";

// 默认配置
const DEFAULT_RATE_PER_MINUTE = 60;
const DEFAULT_MAX_TABLE_ROWS = 200;
const DEFAULT_MAX_ALARMS = 200;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

// 扩展传感器名称 - 占位传感器（暂无数据，显示--）
const EXTENDED_SENSOR_NAMES = [
  // 第二行：CO₂ / O₂ / CO
  "CO2-1", "CO2-2", "CO2-3", "CO2-4",  // CO₂传感器
  "O2-1", "O2-2", "O2-3", "O2-4",      // O₂传感器
  "CO-1", "CO-2", "CO-3", "CO-4",      // CO传感器
  // 第三行：Gas Pressure / 粉尘(FC) / C₂H₂(乙炔)
  "GP1", "GP2", "GP3", "GP4",          // Gas Pressure
  "FC1", "FC2",                         // 粉尘(FC)
  "YH1", "YH2", "YH3",                  // C₂H₂(乙炔)
];

// 所有传感器名称
const ALL_SENSOR_NAMES = [...CORE_SENSOR_NAMES, ...EXTENDED_SENSOR_NAMES];

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
  const [cavHistory, setCavHistory] = useState<CavHistoryRecord[]>([]);
  const [alarmHistory, setAlarmHistory] = useState<AlarmRecord[]>([]);
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

          // 遍历 bubble_wall.bubbles，为每个有告警/预警状态的气泡创建记录
          const bubbles = data.bubble_wall?.bubbles ?? [];
          const sensorReadings = data.sensor_readings ?? {};
          const timestamp = formatSystemTime();
          const baseTime = Date.now();

          // 定义 bubble 类型
          interface BubbleData {
            status?: string;
            sensor_pair?: [string, string];
            type?: string;
            cav?: number;
            ulv?: number;
            llv?: number;
            calv?: number;
          }

          const newCavRecords: CavHistoryRecord[] = [];
          const newAlarmRecords: AlarmRecord[] = [];

          bubbles.forEach((bubble: BubbleData, idx: number) => {
            const status = bubble.status as string;
            if (status && status !== "NORMAL") {
              const sensorPair = bubble.sensor_pair as [string, string];
              const [sensor1, sensor2] = sensorPair;
              const pairKey = `${sensor1}-${sensor2}`;

              // CAV 历史记录（每批替换）
              let level: "normal" | "warning" | "alarm" = "normal";
              if (status.includes("WARNING")) {
                level = "alarm";
              } else if (status.includes("ABNORMAL")) {
                level = "warning";
              }

              newCavRecords.push({
                id: `cav-${baseTime}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                time: timestamp,
                sensorPair,
                pairType: bubble.type as string,
                cav: bubble.cav as number,
                status: status,
                level,
              });

              // 告警历史记录（增量追加：每批数据的所有告警都记录）
              const cav = bubble.cav ?? 0;
              const ulv = bubble.ulv ?? 6.4247;
              const llv = bubble.llv ?? 5.0634;
              const calv = bubble.calv ?? 6.0;

              // 确定告警原因
              let reason = "";
              if (cav > ulv) {
                reason = "CAV > ULV";
              } else if (cav < llv) {
                reason = "CAV < LLV";
              } else if (cav > calv) {
                reason = "CAV > CALV";
              } else if (status.includes("ABNORMAL")) {
                reason = "异常波动";
              }

              newAlarmRecords.push({
                id: `alarm-${baseTime}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                time: timestamp,
                sensorPair: pairKey,
                sensor1Value: sensorReadings[sensor1] ?? 0,
                sensor2Value: sensorReadings[sensor2] ?? 0,
                cav,
                ulv,
                llv,
                calv,
                reason,
                status: status.includes("WARNING") ? "alert" : "warning",
              });
            }
          });

          // CAV 历史：每批数据替换上一批（不累积）
          if (newCavRecords.length > 0) {
            setCavHistory(newCavRecords);
          }

          // 告警历史：增量追加（保留所有历史记录，不限制数量）
          if (newAlarmRecords.length > 0) {
            setAlarmHistory((prev) => [...newAlarmRecords, ...prev]);
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
      setCavHistory([]);
      setAlarmHistory([]);  // 清空告警历史
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

        {/* CAV 实时历史 - 已隐藏，使用下方的 AlarmHistory 替代 */}
        {/* <CavHistory records={cavHistory} /> */}

        {/* 告警历史记录 */}
        <AlarmHistory alarms={alarmHistory} />

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
