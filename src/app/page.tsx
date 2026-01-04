"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { healthCheck, controlApi, analysisApi, SensorConfig } from "@/lib/api";

// 导入可视化组件
import { BubbleWallGrid } from "@/components/BubbleWall";
import { MineMap } from "@/components/MineMap";
import { TTWDGraph, TTFSGraph } from "@/components/SensorGraph";
import { PredictionGrid } from "@/components/PredictionChart";

interface Bubble {
  sensor_pair: string[];
  cav: number;
  type?: string;
  type_color?: string;
  ulv: number;
  llv: number;
  is_pair_dynamic: boolean;
  pair_history_count: number;
  radius: number;
  status: string;
  status_cn: string;
  color: string;
  label: string;
}

interface BubbleWallData {
  bubbles: Bubble[];
  summary: {
    total: number;
    by_status?: Record<string, number>;
    by_type?: Record<string, number>;
    warning_count: number;
    abnormal_count: number;
    normal_count: number;
  };
  global_thresholds: {
    ulv: number;
    llv: number;
    default_ulv: number;
    default_llv: number;
    is_dynamic: boolean;
    is_using_dynamic: boolean;
    total_history: number;
    dynamic_pairs: number;
    total_pairs: number;
    min_samples_per_pair: number;
  };
}

interface DatasetInfo {
  total: number;
  current: number;
  progress: number;
}

interface SystemStatus {
  is_running: boolean;
  frequency: number;
  current_index: number;
  total_rows: number;
  progress: number;
  datasets?: {
    gas_gas: DatasetInfo;
    gas_wd: DatasetInfo;
    gas_fs: DatasetInfo;
  };
}

interface CorrelationItem {
  sensor1: string;
  sensor2: string;
  r_value: number;
  p_value: number;
  strength: string;
  is_significant: boolean;
}

interface PredictionData {
  sensor_id: string;
  history: number[];
  prediction: number[];
  trend: "rising" | "falling" | "stable";
  confidence: number;
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "error">("loading");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [bubbleWall, setBubbleWall] = useState<BubbleWallData | null>(null);
  const [demoMode, setDemoMode] = useState<"idle" | "preparing" | "running">("idle");
  // 持久化相关性缓存 - 使用 Map 累积，连线建立后保留
  const [persistentCorrelations, setPersistentCorrelations] = useState<{
    "T-T": Map<string, CorrelationItem>;
    "T-WD": Map<string, CorrelationItem>;
    "T-FS": Map<string, CorrelationItem>;
  }>({
    "T-T": new Map(),
    "T-WD": new Map(),
    "T-FS": new Map(),
  });

  // 转换为组件需要的格式
  const correlations = {
    "T-T": { results: Array.from(persistentCorrelations["T-T"].values()) },
    "T-WD": { results: Array.from(persistentCorrelations["T-WD"].values()) },
    "T-FS": { results: Array.from(persistentCorrelations["T-FS"].values()) },
  };
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [sensorData, setSensorData] = useState<Record<string, number>>({});
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [cavData, setCavData] = useState<{
    cav: number;
    calv: number;
    isAlert: boolean;
    alertLevel: string;
  } | null>(null);
  const [sensorConfig, setSensorConfig] = useState<SensorConfig | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const sseConnectedRef = useRef(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<{
    lastSseData: Record<string, unknown> | null;
    sseEventCount: number;
  }>({ lastSseData: null, sseEventCount: 0 });

  // 检查API连接并获取传感器配置
  useEffect(() => {
    healthCheck()
      .then(() => {
        setApiStatus("connected");
        return controlApi.getSensors();
      })
      .then((config) => setSensorConfig(config))
      .catch(() => setApiStatus("error"));
  }, []);

  // 获取系统状态
  const fetchStatus = useCallback(async () => {
    try {
      const status = await controlApi.getStatus();
      setSystemStatus(status);
    } catch (e) {
      console.error("Failed to fetch status:", e);
    }
  }, []);

  // 获取气泡墙图数据
  const fetchBubbleWall = useCallback(async () => {
    try {
      const data = await analysisApi.getBubbleWall();
      setBubbleWall(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to fetch bubble wall:", e);
    }
  }, []);

  // 获取相关性数据（合并到持久化缓存）
  const fetchCorrelations = useCallback(async () => {
    try {
      const data = await analysisApi.getCorrelation();
      if (data.correlations) {
        setPersistentCorrelations(prev => {
          const newState = {
            "T-T": new Map(prev["T-T"]),
            "T-WD": new Map(prev["T-WD"]),
            "T-FS": new Map(prev["T-FS"]),
          };

          (["T-T", "T-WD", "T-FS"] as const).forEach(type => {
            const results = data.correlations[type]?.results || [];
            results.forEach((corr: CorrelationItem) => {
              const key = [corr.sensor1, corr.sensor2].sort().join("-");
              newState[type].set(key, corr);
            });
          });

          return newState;
        });
      }
    } catch (e) {
      console.error("Failed to fetch correlations:", e);
    }
  }, []);

  // 获取预测数据（显示所有20个T传感器）
  const fetchPredictions = useCallback(async () => {
    const sensors = sensorConfig?.available?.T || [];
    if (sensors.length === 0) return;

    const results: PredictionData[] = [];

    for (const sensor of sensors) {
      try {
        const data = await analysisApi.getPrediction(sensor);
        if (data && !data.error) {
          results.push({
            sensor_id: data.sensor_id,
            history: data.history || [],
            prediction: data.prediction || [],
            trend: data.trend || "stable",
            confidence: data.confidence || 0.5,
          });
        }
      } catch (e) {
        console.error(`Failed to fetch prediction for ${sensor}:`, e);
      }
    }

    setPredictions(results);
  }, [sensorConfig]);

  useEffect(() => {
    sseConnectedRef.current = sseConnected;
  }, [sseConnected]);

  // 初始数据获取
  useEffect(() => {
    if (apiStatus !== "connected") return;

    (async () => {
      await Promise.all([
        fetchStatus(),
        fetchBubbleWall(),
        fetchCorrelations(),
        fetchPredictions(),
      ]);
    })();
  }, [apiStatus, fetchStatus, fetchBubbleWall, fetchCorrelations, fetchPredictions]);

  // SSE 实时数据流
  useEffect(() => {
    if (apiStatus !== "connected") return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`${API_BASE}/api/stream/analysis`);

      eventSource.onopen = () => {
        console.log("SSE connected");
        setSseConnected(true);
      };

      eventSource.addEventListener("analysis", (event) => {
        try {
          const data = JSON.parse(event.data);

          // 保存调试数据
          setDebugData(prev => ({
            lastSseData: data,
            sseEventCount: prev.sseEventCount + 1,
          }));

          if (data.bubble_wall) setBubbleWall(data.bubble_wall);

          // 合并新相关性到持久化缓存（累积而非覆盖）
          if (data.correlations) {
            setPersistentCorrelations(prev => {
              const newState = {
                "T-T": new Map(prev["T-T"]),
                "T-WD": new Map(prev["T-WD"]),
                "T-FS": new Map(prev["T-FS"]),
              };

              (["T-T", "T-WD", "T-FS"] as const).forEach(type => {
                const results = data.correlations[type]?.results || [];
                results.forEach((corr: CorrelationItem) => {
                  // 使用排序后的 key 确保双向一致
                  const key = [corr.sensor1, corr.sensor2].sort().join("-");
                  // 更新已有或新增（r_value 会更新为最新值）
                  newState[type].set(key, corr);
                });
              });

              return newState;
            });
          }

          if (data.cav && data.alert) {
            setCavData({
              cav: data.cav.cav || 0,
              calv: data.cav.calv || 0,
              isAlert: data.alert.is_alert || false,
              alertLevel: data.alert.level || "normal",
            });
          }

          if (data.sensor_readings) setSensorData(data.sensor_readings);
          setLastUpdate(new Date().toLocaleTimeString());
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      });

      eventSource.addEventListener("waiting", () => {
        console.log("SSE waiting for data stream");
      });

      eventSource.onerror = () => {
        console.log("SSE connection error, will reconnect...");
        setSseConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    const statusInterval = setInterval(() => void fetchStatus(), 2000);
    const predictionInterval = setInterval(() => void fetchPredictions(), 60000);
    const correlationInterval = setInterval(() => void fetchCorrelations(), 15000);

    const fallbackInterval = setInterval(() => {
      if (!sseConnectedRef.current) void fetchBubbleWall();
    }, 15000);

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(statusInterval);
      clearInterval(predictionInterval);
      clearInterval(correlationInterval);
      clearInterval(fallbackInterval);
    };
  }, [apiStatus, fetchStatus, fetchBubbleWall, fetchCorrelations, fetchPredictions]);

  // 控制按钮处理
  const handleStart = async () => {
    await controlApi.start();
    fetchStatus();
  };

  const handleStop = async () => {
    await controlApi.stop();
    fetchStatus();
  };

  const handleReset = async () => {
    await controlApi.reset();
    fetchStatus();
  };

  const handleDemo = async () => {
    setDemoMode("preparing");
    try {
      await controlApi.reset();
      await fetchStatus();
      await controlApi.start();
      await fetchStatus();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/control/seek/500`, { method: "PUT" });
      await fetchStatus();
      await fetchBubbleWall();
      await fetchCorrelations();
      await fetchPredictions();
      setDemoMode("running");
    } catch (e) {
      console.error("Demo failed:", e);
      setDemoMode("idle");
    }
  };

  const alertSensors = Object.entries(sensorData)
    .filter(([, value]) => value > 0.8)
    .map(([id]) => id);

  // 显示所有气泡的连线（不限于异常状态）
  const alertPairs = bubbleWall?.bubbles
    .map((b) => ({ sensor1: b.sensor_pair[0], sensor2: b.sensor_pair[1], cav: b.cav, status: b.status })) || [];

  return (
    <div className="min-h-screen bg-base">
      {/* Header - 工业科技风 */}
      <header className="border-b border-edge bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="industrial-title text-lg">
              <span className="text-accent font-display">GAS MONITOR</span>
              <span className="text-soft ml-2 text-sm font-body">煤矿瓦斯传感器预警平台</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 导航链接 */}
            <nav className="flex items-center gap-2 mr-4">
              <Link href="/input" className="industrial-btn text-xs px-3 py-1.5 hover:border-accent">
                数据输入
              </Link>
              <Link href="/admin" className="industrial-btn text-xs px-3 py-1.5 hover:border-accent">
                分析管理
              </Link>
            </nav>

            {/* 状态指示 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`status-indicator ${apiStatus === "connected" ? "status-normal" : apiStatus === "error" ? "status-danger" : "status-warning"}`} />
                <span className="text-xs text-soft">API</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`status-indicator ${sseConnected ? "status-info" : "status-muted"}`} />
                <span className="text-xs text-soft">SSE</span>
              </div>
              <span className="text-xs text-dim font-mono">{lastUpdate || "--:--:--"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Control Bar */}
      <div className="bg-surface/50 border-b border-edge px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleDemo}
            disabled={demoMode === "preparing"}
            className="industrial-btn-primary text-xs px-4 py-1.5"
          >
            {demoMode === "preparing" ? "准备中..." : "演示启动"}
          </button>

          <div className="w-px h-5 bg-base" />

          <button onClick={handleStart} disabled={systemStatus?.is_running} className="industrial-btn text-xs px-3 py-1.5 hover:text-ok hover:border-normal">
            开始
          </button>
          <button onClick={handleStop} disabled={!systemStatus?.is_running} className="industrial-btn text-xs px-3 py-1.5 hover:text-err hover:border-danger">
            停止
          </button>
          <button onClick={handleReset} className="industrial-btn text-xs px-3 py-1.5">
            重置
          </button>

          {/* 系统状态 - 三数据集进度 */}
          {systemStatus && (
            <div className="flex items-center gap-4 ml-auto text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`status-indicator ${systemStatus.is_running ? "status-normal" : "status-muted"}`} />
                <span className="text-soft">{systemStatus.is_running ? "运行中" : "已停止"}</span>
              </div>
              {systemStatus.datasets ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1" title="Gas-Gas (T-T分析)">
                    <span className="text-dim">T-T:</span>
                    <span className="text-bright">{systemStatus.datasets.gas_gas.current}</span>
                    <span className="text-dim">/</span>
                    <span className="text-soft">{systemStatus.datasets.gas_gas.total}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Gas-WD (T-WD分析)">
                    <span className="text-dim">T-WD:</span>
                    <span className="text-bright">{systemStatus.datasets.gas_wd.current}</span>
                    <span className="text-dim">/</span>
                    <span className="text-soft">{systemStatus.datasets.gas_wd.total}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Gas-FS (T-FS分析)">
                    <span className="text-dim">T-FS:</span>
                    <span className="text-bright">{systemStatus.datasets.gas_fs.current}</span>
                    <span className="text-dim">/</span>
                    <span className="text-soft">{systemStatus.datasets.gas_fs.total}</span>
                  </div>
                  <span className="text-accent">{(systemStatus.progress * 100).toFixed(1)}%</span>
                </div>
              ) : (
                <span className="text-dim">索引: <span className="text-bright">{systemStatus.current_index}</span> / {systemStatus.total_rows}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Banner */}
      {(bubbleWall || cavData) && (
        <div className="bg-tertiary/30 border-b border-edge px-4 py-2">
          <div className="flex items-center justify-center gap-8 text-xs font-mono">
            <div className="flex items-center gap-4">
              <span className="text-dim">传感器对:</span>
              <span className="text-accent">{bubbleWall?.summary?.total || 0}</span>
              <span className="text-ok">{bubbleWall?.summary?.normal_count || 0}</span>
              <span className="text-warn">{bubbleWall?.summary?.abnormal_count || 0}</span>
              <span className="text-err">{bubbleWall?.summary?.warning_count || 0}</span>
            </div>

            <div className="w-px h-4 bg-base" />

            {cavData && (
              <div className="flex items-center gap-4">
                <span className="text-dim">累积异常值:</span>
                <span className={cavData.isAlert ? "text-err" : "text-ok"}>{cavData.cav.toFixed(4)}</span>
                <span className="text-dim">阈值:</span>
                <span className="text-soft">{cavData.calv.toFixed(4)}</span>
                {cavData.isAlert && (
                  <span className="px-2 py-0.5 bg-danger/20 border border-danger text-err rounded text-xs animate-pulse">
                    预警
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content - 三列布局 */}
      <main className="p-3">
        <div className="grid grid-cols-12 gap-3 h-[calc(100vh-180px)]">
          {/* 左侧 - 两个关联图上下排列 */}
          <div className="col-span-3 flex flex-col gap-3">
            {/* T-T-WD 关联图 */}
            <div className="industrial-card flex-1 p-3">
              <TTWDGraph
                tTCorrelations={correlations?.["T-T"]?.results || []}
                tWdCorrelations={correlations?.["T-WD"]?.results || []}
                width={260}
                height={280}
              />
            </div>

            {/* T-T-FS 关联图 */}
            <div className="industrial-card flex-1 p-3">
              <TTFSGraph
                tTCorrelations={correlations?.["T-T"]?.results || []}
                tFsCorrelations={correlations?.["T-FS"]?.results || []}
                width={260}
                height={280}
              />
            </div>
          </div>

          {/* 中间 - 矿洞地图 + 气泡墙 */}
          <div className="col-span-6 flex flex-col gap-3">
            {/* 矿洞地图 */}
            <div className="industrial-card p-3 overflow-hidden" style={{ aspectRatio: "1600/550", maxHeight: "280px" }}>
              <div className="industrial-title text-xs mb-2">矿洞地图</div>
              <div className="w-full h-[calc(100%-24px)]">
              <MineMap
                sensorData={sensorData}
                alertSensors={alertSensors}
                alertPairs={alertPairs}
                tlvThreshold={0.8}
                showLabels={true}
              />
              </div>
            </div>

            {/* 气泡墙 */}
            <div className="industrial-card flex-1 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="industrial-title text-xs">气泡墙</div>
                {bubbleWall?.summary && (
                  <div className="flex gap-3 text-xs font-mono">
                    <span className="text-ok">{bubbleWall.summary.normal_count}</span>
                    <span className="text-warn">{bubbleWall.summary.abnormal_count}</span>
                    <span className="text-err">{bubbleWall.summary.warning_count}</span>
                  </div>
                )}
              </div>
              {bubbleWall?.bubbles && bubbleWall.bubbles.length > 0 ? (
                <BubbleWallGrid
                  bubbles={bubbleWall.bubbles.map((b) => ({
                    label: b.label,
                    cav: b.cav,
                    ulv: b.ulv,
                    llv: b.llv,
                    is_pair_dynamic: b.is_pair_dynamic,
                    pair_history_count: b.pair_history_count,
                    status: b.status,
                    color: b.color,
                    type: b.type,
                    type_color: b.type_color,
                  }))}
                  globalThresholds={bubbleWall.global_thresholds}
                  columns={12}
                />
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-dim gap-3">
                  {apiStatus === "connected" ? (
                    <>
                      <div className="text-center">
                        <div className="text-soft mb-1">准备就绪</div>
                        <div className="text-xs">点击下方按钮开始演示</div>
                      </div>
                      <button onClick={handleDemo} disabled={demoMode === "preparing"} className="industrial-btn-primary text-xs px-4 py-1.5">
                        {demoMode === "preparing" ? "准备中..." : "开始演示"}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span>正在连接后端服务...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右侧 - 预测面板（20个T传感器） */}
          <div className="col-span-3 flex flex-col max-h-[calc(100vh-180px)]">
            <div className="industrial-card p-3 overflow-hidden h-full">
              <div className="industrial-title text-xs mb-2">瓦斯浓度预测 (SVM)</div>
              <div className="text-xs text-dim mb-2 font-mono">
                {predictions.length} / {sensorConfig?.available?.T?.length || 0} 传感器
              </div>
              <div className="overflow-y-auto h-[calc(100%-50px)] pr-1 custom-scrollbar">
                {predictions.length > 0 ? (
                  <PredictionGrid predictions={predictions} columns={1} />
                ) : (
                  <div className="space-y-2">
                    {(sensorConfig?.available?.T?.slice(0, 6) || ["T010101", "T010102", "T010103", "T010104", "T010105", "T010106"]).map((sensor) => (
                      <div key={sensor} className="bg-tertiary rounded p-2">
                        <div className="text-xs text-dim mb-1 font-mono">{sensor.replace("T0", "T")}</div>
                        <div className="h-8 flex items-center justify-center text-dim text-xs gap-2">
                          <div className="w-3 h-3 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                          <span>等待数据...</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-edge bg-surface px-4 py-2 text-center text-xs text-dim font-mono">
        煤矿瓦斯监测预警系统 v1.0 | 传感器关联分析平台
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="ml-4 px-2 py-0.5 bg-tertiary hover:bg-muted rounded text-accent"
        >
          {showDebug ? "隐藏调试" : "显示调试"}
        </button>
      </footer>

      {/* Debug Panel */}
      {showDebug && (
        <div className="fixed bottom-12 left-0 right-0 bg-surface border-t border-edge p-4 max-h-[40vh] overflow-auto font-mono text-xs">
          <div className="grid grid-cols-4 gap-4">
            {/* SSE 状态 */}
            <div className="bg-tertiary p-3 rounded">
              <div className="text-accent mb-2">SSE 状态</div>
              <div className="space-y-1">
                <div>连接: <span className={sseConnected ? "text-ok" : "text-err"}>{sseConnected ? "已连接" : "未连接"}</span></div>
                <div>事件数: <span className="text-bright">{debugData.sseEventCount}</span></div>
              </div>
            </div>

            {/* 相关性数据 */}
            <div className="bg-tertiary p-3 rounded">
              <div className="text-accent mb-2">相关性缓存</div>
              <div className="space-y-1">
                <div>T-T: <span className="text-bright">{persistentCorrelations["T-T"].size}</span> 对</div>
                <div>T-WD: <span className={persistentCorrelations["T-WD"].size > 0 ? "text-ok" : "text-err"}>{persistentCorrelations["T-WD"].size}</span> 对</div>
                <div>T-FS: <span className={persistentCorrelations["T-FS"].size > 0 ? "text-ok" : "text-err"}>{persistentCorrelations["T-FS"].size}</span> 对</div>
              </div>
            </div>

            {/* 气泡墙数据 */}
            <div className="bg-tertiary p-3 rounded">
              <div className="text-accent mb-2">气泡墙</div>
              <div className="space-y-1">
                <div>总气泡: <span className="text-bright">{bubbleWall?.bubbles?.length || 0}</span></div>
                <div>按类型: {bubbleWall?.summary?.by_type ? (
                  <span>
                    T-T: {bubbleWall.summary.by_type["T-T"] || 0},
                    T-WD: {bubbleWall.summary.by_type["T-WD"] || 0},
                    T-FS: {bubbleWall.summary.by_type["T-FS"] || 0}
                  </span>
                ) : "无数据"}</div>
              </div>
            </div>

            {/* 最新 SSE 数据 */}
            <div className="bg-tertiary p-3 rounded">
              <div className="text-accent mb-2">最新 SSE 数据</div>
              {debugData.lastSseData ? (
                <div className="space-y-1">
                  <div>correlations: {Object.keys(debugData.lastSseData.correlations || {}).join(", ") || "无"}</div>
                  <div>T-T results: {((debugData.lastSseData.correlations as Record<string, {results?: unknown[]}>)?.["T-T"]?.results?.length) || 0}</div>
                  <div>T-WD results: {((debugData.lastSseData.correlations as Record<string, {results?: unknown[]}>)?.["T-WD"]?.results?.length) || 0}</div>
                  <div>T-FS results: {((debugData.lastSseData.correlations as Record<string, {results?: unknown[]}>)?.["T-FS"]?.results?.length) || 0}</div>
                </div>
              ) : (
                <div className="text-dim">等待数据...</div>
              )}
            </div>
          </div>

          {/* T-FS 详细诊断 */}
          <div className="mt-4 bg-tertiary p-3 rounded">
            <div className="text-accent mb-2">T-FS 诊断</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-dim mb-1">{`前端 correlations["T-FS"]`}</div>
                <div className="text-bright">{correlations["T-FS"]?.results?.length || 0} 条</div>
                {correlations["T-FS"]?.results?.slice(0, 3).map((c, i) => (
                  <div key={i} className="text-xs text-soft">{c.sensor1} → {c.sensor2}: r={c.r_value.toFixed(3)}</div>
                ))}
              </div>
              <div>
                <div className="text-dim mb-1">{`SSE validity["T-FS"]`}</div>
                {debugData.lastSseData?.validity ? (
                  <div>
                    <div className={((debugData.lastSseData.validity as Record<string, {overall_valid?: boolean}>)?.["T-FS"]?.overall_valid) ? "text-ok" : "text-err"}>
                      overall_valid: {String((debugData.lastSseData.validity as Record<string, {overall_valid?: boolean}>)?.["T-FS"]?.overall_valid ?? "无数据")}
                    </div>
                  </div>
                ) : (
                  <div className="text-dim">无数据</div>
                )}
              </div>
              <div>
                <div className="text-dim mb-1">气泡墙 T-FS 类型</div>
                <div className="text-bright">
                  {bubbleWall?.bubbles?.filter(b => b.type === "T-FS").length || 0} 个气泡
                </div>
              </div>
            </div>
          </div>

          {/* 详细 JSON */}
          <details className="mt-4">
            <summary className="text-accent cursor-pointer">查看完整 SSE 数据</summary>
            <pre className="mt-2 p-2 bg-base rounded overflow-auto max-h-40 text-dim">
              {JSON.stringify(debugData.lastSseData, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
