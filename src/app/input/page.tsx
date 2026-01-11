"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { healthCheck, controlApi, SensorConfig } from "@/lib/api";

interface SystemStatus {
  is_running: boolean;
  frequency: number;
  current_index: number;
  total_rows: number;
  progress: number;
}

interface SensorReading {
  timestamp: string;
  index: number;
  data: Record<string, number>;
}

interface AlertRecord {
  id: string;
  timestamp: string;
  type: "TLV" | "CAV" | "SYSTEM";
  sensor?: string;
  value?: number;
  threshold?: number;
  message: string;
  level: "warning" | "danger" | "info";
}

const FREQUENCIES = [
  { value: 1, label: "1 条/秒" },
  { value: 10, label: "10 条/秒" },
  { value: 50, label: "50 条/秒" },
  { value: 100, label: "100 条/秒" },
  { value: 200, label: "200 条/秒" },
];

export default function InputPage() {
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "error">("loading");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [sensorConfig, setSensorConfig] = useState<SensorConfig | null>(null);
  const [sensorData, setSensorData] = useState<Record<string, number>>({});
  const [dataHistory, setDataHistory] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [selectedFreq, setSelectedFreq] = useState(10);
  const [sseConnected, setSseConnected] = useState(false);
  const [runTime, setRunTime] = useState(0);
  const runTimeRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // 检查API连接
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
      setSelectedFreq(status.frequency);

      // 更新运行时间
      if (status.is_running) {
        if (!startTimeRef.current) {
          startTimeRef.current = Date.now();
        }
      } else {
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
    if (systemStatus?.is_running && startTimeRef.current) {
      runTimeRef.current = setInterval(() => {
        setRunTime(Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000));
      }, 1000);
    }
    return () => {
      if (runTimeRef.current) clearInterval(runTimeRef.current);
    };
  }, [systemStatus?.is_running]);

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
            setSensorData(data.sensor_readings);

            // 添加到历史记录
            const newReading: SensorReading = {
              timestamp: new Date().toLocaleTimeString(),
              index: data.index || 0,
              data: data.sensor_readings,
            };

            setDataHistory((prev) => {
              const updated = [newReading, ...prev].slice(0, 50);
              return updated;
            });

            // 检查超阈值告警
            Object.entries(data.sensor_readings).forEach(([sensor, value]) => {
              if (typeof value === "number" && value > 0.8 && sensor.startsWith("T")) {
                const alert: AlertRecord = {
                  id: `${Date.now()}-${sensor}`,
                  timestamp: new Date().toLocaleTimeString(),
                  type: "TLV",
                  sensor,
                  value,
                  threshold: 0.8,
                  message: `${sensor} 超过TLV阈值`,
                  level: value > 1.0 ? "danger" : "warning",
                };
                setAlerts((prev) => [alert, ...prev].slice(0, 100));
              }
            });
          }

          // CAV 告警
          if (data.alert?.is_alert) {
            const alert: AlertRecord = {
              id: `cav-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              type: "CAV",
              value: data.alert?.cav,
              threshold: data.alert?.calv,
              message: `CAV(${data.alert?.cav?.toFixed(4)}) > CALV(${data.alert?.calv?.toFixed(4)})`,
              level: data.alert.level === "critical" ? "danger" : "warning",
            };
            setAlerts((prev) => {
              // 避免重复
              if (prev.length > 0 && prev[0].type === "CAV" && Date.now() - parseInt(prev[0].id.split("-")[1]) < 5000) {
                return prev;
              }
              return [alert, ...prev].slice(0, 100);
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
    fetchStatus();
  };

  const handleStop = async () => {
    await controlApi.stop();
    fetchStatus();
  };

  const handleReset = async () => {
    await controlApi.reset();
    setDataHistory([]);
    setAlerts([]);
    startTimeRef.current = null;
    setRunTime(0);
    fetchStatus();
  };

  const handleFreqChange = async (freq: number) => {
    setSelectedFreq(freq);
    await controlApi.setFrequency(freq);
    fetchStatus();
  };

  const handleSeek = async (index: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/control/seek/${index}`, { method: "PUT" });
    fetchStatus();
  };

  // 格式化运行时间
  const formatRunTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 获取传感器状态颜色
  const getSensorStatus = (sensor: string) => {
    const value = sensorData[sensor];
    if (value === undefined) return "muted";
    if (sensor.startsWith("T")) {
      if (value > 1.0) return "danger";
      if (value > 0.8) return "warning";
      return "normal";
    }
    return "info";
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

      <main className="p-4">
        <div className="grid grid-cols-12 gap-4">
          {/* 控制面板 */}
          <div className="col-span-6">
            <div className="industrial-card p-4">
              <div className="industrial-title text-xs mb-4">控制面板</div>

              {/* 频率选择 */}
              <div className="mb-4">
                <label className="text-xs text-dim mb-2 block">更新频率</label>
                <div className="flex gap-2">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => handleFreqChange(f.value)}
                      className={`industrial-btn text-xs px-3 py-1.5 ${selectedFreq === f.value ? "border-accent text-accent" : ""}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 控制按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={handleStart}
                  disabled={systemStatus?.is_running}
                  className="industrial-btn text-xs px-4 py-2 hover:text-ok hover:border-normal disabled:opacity-50"
                >
                  开始
                </button>
                <button
                  onClick={handleStop}
                  disabled={!systemStatus?.is_running}
                  className="industrial-btn text-xs px-4 py-2 hover:text-err hover:border-danger disabled:opacity-50"
                >
                  停止
                </button>
                <button onClick={handleReset} className="industrial-btn text-xs px-4 py-2">
                  重置
                </button>
                <button
                  onClick={() => handleSeek(500)}
                  className="industrial-btn text-xs px-4 py-2"
                  title="跳转到索引500"
                >
                  跳转 500
                </button>
              </div>
            </div>
          </div>

          {/* 系统状态 */}
          <div className="col-span-6">
            <div className="industrial-card p-4">
              <div className="industrial-title text-xs mb-4">系统状态</div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-dim mb-1">状态</div>
                  <div className="flex items-center gap-2">
                    <span className={`status-indicator ${systemStatus?.is_running ? "status-normal" : "status-muted"}`} />
                    <span className={`font-mono text-lg ${systemStatus?.is_running ? "text-ok" : "text-dim"}`}>
                      {systemStatus?.is_running ? "运行中" : "已停止"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-dim mb-1">运行时间</div>
                  <div className="font-mono text-lg text-accent">{formatRunTime(runTime)}</div>
                </div>

                <div>
                  <div className="text-xs text-dim mb-1">当前索引</div>
                  <div className="font-mono text-lg text-bright">
                    {systemStatus?.current_index?.toLocaleString() || 0}
                    <span className="text-dim text-sm"> / {systemStatus?.total_rows?.toLocaleString() || 0}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-dim mb-1">进度</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-tertiary rounded overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${(systemStatus?.progress || 0) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm text-accent">
                      {((systemStatus?.progress || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 实时数据表 */}
          <div className="col-span-8">
            <div className="industrial-card p-4 h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="industrial-title text-xs">实时数据流</div>
                <span className="text-xs text-dim font-mono">{dataHistory.length} 条记录</span>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-dim border-b border-edge">
                      <th className="text-left py-2 px-2 font-mono">时间</th>
                      <th className="text-left py-2 px-2 font-mono">索引</th>
                      <th className="text-left py-2 px-2 font-mono">瓦斯传感器</th>
                      <th className="text-left py-2 px-2 font-mono">温度</th>
                      <th className="text-left py-2 px-2 font-mono">风速</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataHistory.map((reading, idx) => (
                      <tr key={idx} className="border-b border-edge/50 hover:bg-tertiary/30">
                        <td className="py-1.5 px-2 font-mono text-soft">{reading.timestamp}</td>
                        <td className="py-1.5 px-2 font-mono text-dim">{reading.index}</td>
                        <td className="py-1.5 px-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(reading.data)
                              .filter(([k]) => k.startsWith("T"))
                              .slice(0, 6)
                              .map(([sensor, value]) => (
                                <span
                                  key={sensor}
                                  className={`font-mono ${
                                    value > 0.8 ? "text-warn" : value > 1.0 ? "text-err" : "text-ok"
                                  }`}
                                >
                                  {sensor.slice(-2)}:{(value as number).toFixed(2)}
                                </span>
                              ))}
                            {Object.keys(reading.data).filter((k) => k.startsWith("T")).length > 6 && (
                              <span className="text-dim">...</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 font-mono text-note">
                          {Object.entries(reading.data)
                            .filter(([k]) => k.startsWith("WD"))
                            .slice(0, 2)
                            .map(([, v]) => (v as number).toFixed(1))
                            .join(", ")}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-fs-sensor">
                          {Object.entries(reading.data)
                            .filter(([k]) => k.startsWith("FS"))
                            .slice(0, 2)
                            .map(([, v]) => (v as number).toFixed(1))
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                    {dataHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-dim">
                          等待数据流...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 告警历史 */}
          <div className="col-span-4">
            <div className="industrial-card p-4 h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="industrial-title text-xs">告警历史</div>
                <span className="text-xs text-dim font-mono">{alerts.length} 条告警</span>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                {alerts.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-2 rounded border ${
                          alert.level === "danger"
                            ? "bg-danger/10 border-danger/50"
                            : alert.level === "warning"
                            ? "bg-warning/10 border-warning/50"
                            : "bg-info/10 border-info/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-dim">{alert.timestamp}</span>
                          <span
                            className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                              alert.level === "danger"
                                ? "bg-danger/20 text-err"
                                : alert.level === "warning"
                                ? "bg-warning/20 text-warn"
                                : "bg-info/20 text-note"
                            }`}
                          >
                            {alert.type}
                          </span>
                        </div>
                        <div className="text-xs text-soft">{alert.message}</div>
                        {alert.sensor && (
                          <div className="text-xs text-dim mt-1">
                            数值: <span className="text-bright">{alert.value?.toFixed(4)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-dim text-xs">
                    暂无告警记录
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 传感器状态网格 */}
          <div className="col-span-12">
            <div className="industrial-card p-4">
              <div className="industrial-title text-xs mb-4">传感器状态网格</div>

              <div className="grid grid-cols-3 gap-6">
                {/* T 传感器 */}
                <div>
                  <div className="text-xs text-dim mb-2 font-mono">瓦斯传感器 (T)</div>
                  <div className="flex flex-wrap gap-1">
                    {(sensorConfig?.available?.T || []).map((sensor) => (
                      <div
                        key={sensor}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-mono cursor-default transition-all ${
                          getSensorStatus(sensor) === "danger"
                            ? "bg-danger/30 text-err border border-danger"
                            : getSensorStatus(sensor) === "warning"
                            ? "bg-warning/30 text-warn border border-warning"
                            : getSensorStatus(sensor) === "normal"
                            ? "bg-normal/20 text-ok border border-normal/50"
                            : "bg-tertiary text-dim border border-edge"
                        }`}
                        title={`${sensor}: ${sensorData[sensor]?.toFixed(4) || "N/A"}`}
                      >
                        {sensor.slice(-2)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* WD 传感器 */}
                <div>
                  <div className="text-xs text-dim mb-2 font-mono">温度传感器 (WD)</div>
                  <div className="flex flex-wrap gap-1">
                    {(sensorConfig?.available?.WD || []).map((sensor) => (
                      <div
                        key={sensor}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-mono cursor-default transition-all ${
                          sensorData[sensor] !== undefined
                            ? "bg-info/20 text-note border border-info/50"
                            : "bg-tertiary text-dim border border-edge"
                        }`}
                        title={`${sensor}: ${sensorData[sensor]?.toFixed(2) || "N/A"}`}
                      >
                        {sensor.slice(-2)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* FS 传感器 */}
                <div>
                  <div className="text-xs text-dim mb-2 font-mono">风速传感器 (FS)</div>
                  <div className="flex flex-wrap gap-1">
                    {(sensorConfig?.available?.FS || []).map((sensor) => (
                      <div
                        key={sensor}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-mono cursor-default transition-all ${
                          sensorData[sensor] !== undefined
                            ? "bg-sensor-fs/20 text-fs-sensor border border-sensor-fs/50"
                            : "bg-tertiary text-dim border border-edge"
                        }`}
                        title={`${sensor}: ${sensorData[sensor]?.toFixed(2) || "N/A"}`}
                      >
                        {sensor.slice(-2)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 图例 */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-edge">
                <div className="flex items-center gap-1.5">
                  <span className="status-indicator status-normal" />
                  <span className="text-xs text-dim">正常</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="status-indicator status-warning" />
                  <span className="text-xs text-dim">预警 (&gt;0.8)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="status-indicator status-danger" />
                  <span className="text-xs text-dim">危险 (&gt;1.0)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="status-indicator status-muted" />
                  <span className="text-xs text-dim">无数据</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-edge bg-surface px-4 py-2 text-center text-xs text-dim font-mono">
        数据输入控制台 | 实时监测
      </footer>
    </div>
  );
}
