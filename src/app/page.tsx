"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { healthCheck, controlApi, analysisApi, SensorConfig } from "@/lib/api";

// 导入可视化组件
import { BubbleWallGrid } from "@/components/BubbleWall";
import { MineMap } from "@/components/MineMap";
import { UnifiedCorrelationGraph } from "@/components/SensorGraph";
import { PredictionGrid } from "@/components/PredictionChart";
import { ValidityCheckerPanel } from "@/components/ValidityChecker";

interface Bubble {
  sensor_pair: string[];
  cav: number;
  type?: string;           // T-T, T-WD, T-FS
  type_color?: string;     // 类型颜色
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
    by_type?: Record<string, number>;  // T-T, T-WD, T-FS 各多少个
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

interface SystemStatus {
  is_running: boolean;
  frequency: number;
  current_index: number;
  total_rows: number;
  progress: number;
}

interface CorrelationItem {
  sensor1: string;
  sensor2: string;
  r_value: number;
  p_value: number;
  strength: string;
  is_significant: boolean;
}

interface CorrelationTypeResult {
  total_pairs: number;
  by_strength: Record<string, number>;
  avg_r: number;
  max_r: number;
  results: CorrelationItem[];
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
  const [correlations, setCorrelations] = useState<{
    "T-T": CorrelationTypeResult | null;
    "T-WD": CorrelationTypeResult | null;
    "T-FS": CorrelationTypeResult | null;
  } | null>(null);
  const [validityBlockedTypes, setValidityBlockedTypes] = useState<string[]>([]);
  const [validityWarning, setValidityWarning] = useState<string | null>(null);
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

  // 检查API连接并获取传感器配置
  useEffect(() => {
    healthCheck()
      .then(() => {
        setApiStatus("connected");
        // 获取传感器配置（单一数据源，来自后端 config.py）
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

  // 获取相关性数据
  const fetchCorrelations = useCallback(async () => {
    try {
      const data = await analysisApi.getCorrelation();
      if (data.correlations) {
        setCorrelations(data.correlations);
      }
      // 处理验证阻断状态
      if (data.blocked_types) {
        setValidityBlockedTypes(data.blocked_types);
      } else {
        setValidityBlockedTypes([]);
      }
      if (data.validity_warning) {
        setValidityWarning(data.validity_warning);
      } else {
        setValidityWarning(null);
      }
    } catch (e) {
      console.error("Failed to fetch correlations:", e);
    }
  }, []);

  // 获取预测数据（使用后端配置的传感器列表）
  const fetchPredictions = useCallback(async () => {
    // 使用可用的 T 传感器，限制前 6 个用于预测展示
    const sensors = sensorConfig?.available?.T?.slice(0, 6) || [];
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

  // 传感器数据现在通过 SSE 实时推送（sensor_readings 字段）
  // 此处不再需要单独的轮询，SSE 已包含真实传感器读数

  // SSE 连接状态
  const [sseConnected, setSseConnected] = useState(false);
  const sseConnectedRef = useRef(false);

  // 同步 ref 和 state
  useEffect(() => {
    sseConnectedRef.current = sseConnected;
  }, [sseConnected]);

  // 初始数据获取（仅在 API 连接后执行一次）
  useEffect(() => {
    if (apiStatus !== "connected") return;

    // 使用 IIFE 模式包装异步调用
    (async () => {
      await Promise.all([
        fetchStatus(),
        fetchBubbleWall(),
        fetchCorrelations(),
        fetchPredictions(),
      ]);
    })();
  }, [apiStatus, fetchStatus, fetchBubbleWall, fetchCorrelations, fetchPredictions]);

  // SSE 实时数据流和轮询
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

          // 更新气泡墙图
          if (data.bubble_wall) {
            setBubbleWall(data.bubble_wall);
          }

          // 更新相关性数据 - SSE 现在推送所有三种类型
          if (data.correlations) {
            setCorrelations({
              "T-T": data.correlations["T-T"] || null,
              "T-WD": data.correlations["T-WD"] || null,
              "T-FS": data.correlations["T-FS"] || null,
            });
          }

          // 更新 CAV/预警数据
          if (data.cav && data.alert) {
            setCavData({
              cav: data.cav.cav || 0,
              calv: data.cav.calv || 0,
              isAlert: data.alert.is_alert || false,
              alertLevel: data.alert.level || "normal",
            });
          }

          // 更新传感器读数（用于矿洞地图）
          if (data.sensor_readings) {
            setSensorData(data.sensor_readings);
          }

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

        // 5秒后重连
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    // 启动 SSE 连接
    connectSSE();

    // 状态轮询（保持）
    const statusInterval = setInterval(() => void fetchStatus(), 2000);

    // 预测数据轮询
    const predictionInterval = setInterval(() => void fetchPredictions(), 60000);

    // 相关性数据备份轮询（SSE 已推送，此为断线降级方案）
    const correlationInterval = setInterval(() => void fetchCorrelations(), 15000);

    // SSE 断开时的降级轮询（气泡墙）- 使用 ref 避免依赖问题
    const fallbackInterval = setInterval(() => {
      if (!sseConnectedRef.current) {
        void fetchBubbleWall();
      }
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

  const handleSeek = async (index: number) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/control/seek/${index}`, {
        method: "PUT",
      });
      fetchStatus();
      fetchBubbleWall();
      fetchCorrelations();
      fetchPredictions();
    } catch (e) {
      console.error("Seek failed:", e);
    }
  };

  // 一键演示：自动执行 重置 → 开始 → 跳转到有数据的位置
  const handleDemo = async () => {
    setDemoMode("preparing");
    try {
      // Step 1: 重置
      await controlApi.reset();
      await fetchStatus();

      // Step 2: 开始
      await controlApi.start();
      await fetchStatus();

      // Step 3: 等待一小段时间让后端准备
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 4: 跳转到数据充足位置
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/control/seek/500`, {
        method: "PUT",
      });
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

  // 计算超阈值传感器 (用于矿洞地图高亮)
  const alertSensors = Object.entries(sensorData)
    .filter(([, value]) => value > 0.8)
    .map(([id]) => id);

  // 计算CAV>CALV的传感器对 (用于飞线)
  const alertPairs = bubbleWall?.bubbles
    .filter((b) => b.status.includes("WARNING") || b.status.includes("ABNORMAL"))
    .slice(0, 5)
    .map((b) => ({
      sensor1: b.sensor_pair[0],
      sensor2: b.sensor_pair[1],
      cav: b.cav,
    })) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-400">
            煤矿瓦斯传感器预警平台
          </h1>
          <div className="flex items-center gap-4">
            <Badge
              variant={apiStatus === "connected" ? "default" : "destructive"}
              className={
                apiStatus === "connected"
                  ? "bg-green-600"
                  : apiStatus === "error"
                  ? "bg-red-600"
                  : "bg-yellow-600"
              }
            >
              {apiStatus === "connected"
                ? "API 已连接"
                : apiStatus === "error"
                ? "API 断开"
                : "连接中..."}
            </Badge>
            {systemStatus && (
              <Badge className={systemStatus.is_running ? "bg-green-600" : "bg-slate-600"}>
                {systemStatus.is_running ? "运行中" : "已停止"}
              </Badge>
            )}
            <Badge className={sseConnected ? "bg-blue-600" : "bg-slate-600"}>
              {sseConnected ? "SSE 实时" : "轮询模式"}
            </Badge>
            <span className="text-sm text-slate-400">
              更新: {lastUpdate || "-"}
            </span>
          </div>
        </div>
      </header>

      {/* Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-4">
          {/* 一键演示按钮 - 最醒目 */}
          <Button
            size="sm"
            onClick={handleDemo}
            disabled={demoMode === "preparing"}
            className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-medium px-4"
          >
            {demoMode === "preparing" ? "准备中..." : "一键演示"}
          </Button>

          <div className="w-px h-6 bg-slate-700" />

          <Button
            size="sm"
            onClick={handleStart}
            disabled={systemStatus?.is_running}
            className="bg-green-600 hover:bg-green-700"
          >
            开始
          </Button>
          <Button
            size="sm"
            onClick={handleStop}
            disabled={!systemStatus?.is_running}
            className="bg-red-600 hover:bg-red-700"
          >
            停止
          </Button>
          <Button
            size="sm"
            onClick={handleReset}
            variant="outline"
            className="border-slate-600 text-slate-300"
          >
            重置
          </Button>
          <Button
            size="sm"
            onClick={() => handleSeek(500)}
            variant="outline"
            className="border-slate-600 text-slate-300"
            title="跳过预热期，加载500条历史数据"
          >
            加载示例数据
          </Button>
          <Button
            size="sm"
            onClick={() => {
              fetchBubbleWall();
              fetchCorrelations();
              fetchPredictions();
            }}
            variant="outline"
            className="border-slate-600 text-slate-300"
          >
            刷新
          </Button>

          {systemStatus && (
            <div className="flex items-center gap-4 ml-auto text-sm text-slate-400">
              <span>进度: {(systemStatus.progress * 100).toFixed(1)}%</span>
              <span>索引: {systemStatus.current_index} / {systemStatus.total_rows}</span>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Banner - 核心指标 */}
      {(bubbleWall || cavData) && (
        <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-2">
          <div className="flex items-center justify-center gap-8 text-sm">
            {/* 传感器对状态 */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">传感器对:</span>
                <span className="font-mono text-blue-400">{bubbleWall?.summary?.total || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-slate-300">{bubbleWall?.summary?.normal_count || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-slate-300">{bubbleWall?.summary?.abnormal_count || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-300">{bubbleWall?.summary?.warning_count || 0}</span>
              </div>
            </div>

            <div className="w-px h-4 bg-slate-700" />

            {/* CAV/CALV 指标 */}
            {cavData && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">CAV:</span>
                  <span className={`font-mono ${cavData.isAlert ? "text-red-400" : "text-green-400"}`}>
                    {cavData.cav.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">CALV:</span>
                  <span className="font-mono text-slate-300">{cavData.calv.toFixed(4)}</span>
                </div>
                {cavData.isAlert && (
                  <Badge className="bg-red-600 animate-pulse">
                    {cavData.alertLevel === "warning" ? "预警" : "警告"}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Correlation Graph + Predictions */}
          <div className="col-span-3 space-y-4">
            {/* 统一关联图 - T-WD 和 T-FS 合并 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-slate-400">传感器关联图</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {/* 验证阻断警告 */}
                {(validityBlockedTypes.length > 0 || validityWarning) && (
                  <div className="mb-2 p-2 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-400">
                    <div className="font-medium mb-1">数据验证未通过</div>
                    <div className="text-amber-500">
                      {validityWarning || `${validityBlockedTypes.join(", ")} 类型未通过有效性验证`}
                    </div>
                  </div>
                )}
                <UnifiedCorrelationGraph
                  tTCorrelations={correlations?.["T-T"]?.results || []}
                  tWdCorrelations={correlations?.["T-WD"]?.results || []}
                  tFsCorrelations={correlations?.["T-FS"]?.results || []}
                  width={280}
                  height={380}
                />
              </CardContent>
            </Card>

            {/* 预测曲线 (SVM) - 移到左侧 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-slate-400">预测曲线 (SVM)</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {predictions.length > 0 ? (
                  <PredictionGrid predictions={predictions} columns={1} />
                ) : (
                  <div className="space-y-2">
                    {(sensorConfig?.available?.T?.slice(0, 3) || ["T010101", "T010102", "T010103"]).map((sensor) => (
                      <div key={sensor} className="bg-slate-800 rounded p-2">
                        <div className="text-xs text-slate-400 mb-1">
                          {sensor.replace("T0", "T")}
                        </div>
                        <div className="h-10 flex items-center justify-center text-slate-500 text-xs gap-2">
                          <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                          <span>等待数据...</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 数据有效性验证 */}
            <ValidityCheckerPanel
              apiBaseUrl={`${process.env.NEXT_PUBLIC_API_URL}/api/analysis`}
              refreshInterval={30000}
              showUploadButton={true}
              onStartSimulation={async () => {
                // 上传完成后，启动模拟推送
                setDemoMode("preparing");
                try {
                  await controlApi.start();
                  await fetchStatus();
                  // 跳转到有数据的位置（跳过预热期）
                  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/control/seek/100`, {
                    method: "PUT",
                  });
                  await fetchStatus();
                  await fetchBubbleWall();
                  await fetchCorrelations();
                  await fetchPredictions();
                  setDemoMode("running");
                } catch (e) {
                  console.error("Start simulation failed:", e);
                  setDemoMode("idle");
                }
              }}
            />

            {/* 算法说明卡片 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-slate-400">算法说明</CardTitle>
              </CardHeader>
              <CardContent className="p-2 text-xs text-slate-500 space-y-2">
                <div>
                  <span className="inline-block w-3 h-3 rounded mr-1" style={{ backgroundColor: "#06B6D4" }} />
                  <span className="text-slate-400 font-medium">T-T</span>: 瓦斯传感器间相关性
                </div>
                <div>
                  <span className="inline-block w-3 h-3 rounded mr-1" style={{ backgroundColor: "#3B82F6" }} />
                  <span className="text-slate-400 font-medium">T-WD</span>: 瓦斯-温度相关性
                </div>
                <div>
                  <span className="inline-block w-3 h-3 rounded mr-1" style={{ backgroundColor: "#1E3A5F" }} />
                  <span className="text-slate-400 font-medium">T-FS</span>: 瓦斯-风速相关性
                </div>
                <div className="pt-1 border-t border-slate-800">
                  <div className="text-slate-500">CAV = 相关分析值</div>
                  <div className="text-slate-500">CALV = 预警阈值</div>
                  <div className="text-slate-500">CAV &gt; CALV 触发预警</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Main Visualizations (wider) */}
          <div className="col-span-9 space-y-4">
            {/* Bubble Wall Grid - 加宽 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm text-slate-300 flex items-center justify-between">
                  <span>气泡墙图 - 传感器对相关性状态</span>
                  {bubbleWall?.summary && (
                    <span className="text-xs text-slate-500 font-normal">
                      正常 <span className="text-blue-400">{bubbleWall.summary.normal_count}</span>
                      {" | "}异常 <span className="text-yellow-400">{bubbleWall.summary.abnormal_count}</span>
                      {" | "}警告 <span className="text-red-400">{bubbleWall.summary.warning_count}</span>
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
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
                    columns={10}
                  />
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-500 gap-3">
                    {apiStatus === "connected" ? (
                      <>
                        <div className="text-center">
                          <div className="text-lg text-slate-400 mb-1">欢迎使用瓦斯监测系统</div>
                          <div className="text-sm">点击上方 &quot;一键演示&quot; 开始体验</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleDemo}
                          disabled={demoMode === "preparing"}
                          className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        >
                          {demoMode === "preparing" ? "准备中..." : "开始演示"}
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>正在连接后端服务...</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mine Map - 加宽 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm text-slate-300">
                  矿洞地图 - 传感器分布与飞线
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <MineMap
                  sensorData={sensorData}
                  alertSensors={alertSensors}
                  alertPairs={alertPairs}
                  tlvThreshold={0.8}
                  showLabels={true}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-3 text-center text-sm text-slate-500">
        煤矿瓦斯监测预警Demo系统 | 基于三重相关分析理论框架
      </footer>
    </div>
  );
}
