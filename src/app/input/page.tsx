"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { DataScheduler } from "./lib/scheduler";
import { loadAllCSVFiles } from "./lib/csvLoader";
import {
  RowRecord,
  AlarmRecord,
  WarningRecord,
  SensorStatus,
  AppState,
  ParsedData,
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

export default function InputPage() {
  // 数据加载状态
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 调度器
  const schedulerRef = useRef<DataScheduler | null>(null);

  // 应用状态
  const [appState, setAppState] = useState<AppState>("stopped");
  const [ratePerMinute, setRatePerMinute] = useState(DEFAULT_RATE_PER_MINUTE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [runtime, setRuntime] = useState(0);

  // 数据状态
  const [tableData, setTableData] = useState<RowRecord[]>([]);
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [sensorStatuses, setSensorStatuses] = useState<SensorStatus[]>([]);

  // 初始化调度器
  useEffect(() => {
    schedulerRef.current = new DataScheduler();
  }, []);

  // 处理新数据行（单条）
  const handleNewRecord = useCallback((record: RowRecord) => {
    // 更新表格数据
    setTableData((prev) => {
      const newData = [...prev, record];
      return newData.slice(-DEFAULT_MAX_TABLE_ROWS);
    });

    // 更新传感器状态
    setSensorStatuses((prev) => {
      return prev.map((status) => {
        const value = record.sensors[status.name] ?? null;
        const newStatus: SensorStatus = {
          name: status.name,
          value,
          status: getSensorStatus(value, status.name),
          lastUpdate: record.timestamp,
        };

        // 检查告警（只对T开头的传感器，value > 0.8）
        if (status.name.startsWith("T") && value !== null && value > 0.8) {
          const alarm: AlarmRecord = {
            id: `${Date.now()}-${status.name}`,
            time: record.timestamp,
            sensor: status.name,
            value,
            rule: value > 1.0 ? ">1.0" : ">0.8",
          };
          setAlarms((prevAlarms) => {
            const newAlarms = [...prevAlarms, alarm];
            return newAlarms.slice(-DEFAULT_MAX_ALARMS);
          });
        }

        return newStatus;
      });
    });

    // 更新索引
    if (schedulerRef.current) {
      setCurrentIndex(schedulerRef.current.getCurrentIndex());
    }
  }, []);

  // 处理批量数据更新（用于快速追赶）
  const handleBatchRecords = useCallback((records: RowRecord[]) => {
    if (records.length === 0) return;

    // 批量更新表格数据
    setTableData((prev) => {
      const newData = [...prev, ...records];
      return newData.slice(-DEFAULT_MAX_TABLE_ROWS);
    });

    // 批量更新传感器状态（使用最后一条记录的最新值）
    const lastRecord = records[records.length - 1];
    setSensorStatuses((prev) => {
      return prev.map((status) => {
        const value = lastRecord.sensors[status.name] ?? null;
        return {
          name: status.name,
          value,
          status: getSensorStatus(value, status.name),
          lastUpdate: lastRecord.timestamp,
        };
      });
    });

    // 批量检查告警（使用最后一条记录）
    const newAlarms: AlarmRecord[] = [];
    Object.entries(lastRecord.sensors).forEach(([sensorName, value]) => {
      if (sensorName.startsWith("T") && value !== null && value > 0.8) {
        newAlarms.push({
          id: `${Date.now()}-${sensorName}-${Math.random()}`,
          time: lastRecord.timestamp,
          sensor: sensorName,
          value,
          rule: value > 1.0 ? ">1.0" : ">0.8",
        });
      }
    });

    if (newAlarms.length > 0) {
      setAlarms((prevAlarms) => {
        const updated = [...prevAlarms, ...newAlarms];
        return updated.slice(-DEFAULT_MAX_ALARMS);
      });
    }

    // 更新索引
    if (schedulerRef.current) {
      setCurrentIndex(schedulerRef.current.getCurrentIndex());
    }
  }, []);

  // 初始化：加载CSV数据
  useEffect(() => {
    loadAllCSVFiles()
      .then((data) => {
        setParsedData(data);
        if (schedulerRef.current) {
          schedulerRef.current.setData(data);
          schedulerRef.current.setRatePerMinute(DEFAULT_RATE_PER_MINUTE);
        }

        // 初始化传感器状态
        const initialStatuses: SensorStatus[] = data.allSensorNames.map(
          (name) => ({
            name,
            value: null,
            status: "no-data",
            lastUpdate: formatSystemTime(),
          })
        );
        setSensorStatuses(initialStatuses);
      })
      .catch((err) => {
        console.error("Failed to load CSV files:", err);
        setLoadError("加载数据失败");
      });
  }, []);

  // 设置调度器回调
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setCallback(handleNewRecord);
      schedulerRef.current.setBatchCallback(handleBatchRecords);
    }
  }, [handleNewRecord, handleBatchRecords]);

  // 运行时间更新
  useEffect(() => {
    if (appState === "running") {
      const interval = setInterval(() => {
        if (schedulerRef.current) {
          setRuntime(schedulerRef.current.getRuntime());
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [appState]);

  // 检查完成状态
  useEffect(() => {
    if (appState === "running" && schedulerRef.current) {
      const isCompleted = schedulerRef.current.isCompleted();
      const isActive = schedulerRef.current.isActive();
      if (isCompleted || !isActive) {
        setAppState("completed");
        if (isActive) {
          schedulerRef.current.stop();
        }
      }
    }
  }, [currentIndex, appState]);

  // 控制函数
  const handleStart = () => {
    if (schedulerRef.current) {
      schedulerRef.current.start();
      setAppState("running");
    }
  };

  const handleStop = () => {
    if (schedulerRef.current) {
      schedulerRef.current.stop();
      setAppState("stopped");
    }
  };

  const handleReset = () => {
    if (schedulerRef.current) {
      schedulerRef.current.reset();
    }
    setTableData([]);
    setAlarms([]);
    setWarnings([]);
    setCurrentIndex(0);
    setRuntime(0);
    setAppState("stopped");

    // 重置传感器状态
    if (parsedData) {
      const resetStatuses: SensorStatus[] = parsedData.allSensorNames.map(
        (name) => ({
          name,
          value: null,
          status: "no-data",
          lastUpdate: formatSystemTime(),
        })
      );
      setSensorStatuses(resetStatuses);
    }
  };

  const handleRateChange = (rate: number) => {
    setRatePerMinute(rate);
    if (schedulerRef.current) {
      schedulerRef.current.setRatePerMinute(rate);
    }
  };

  const handleJump = (index: number) => {
    if (schedulerRef.current) {
      schedulerRef.current.jumpToIndex(index);
      setCurrentIndex(index);
    }
  };

  // 加载中状态
  if (!parsedData) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          {loadError ? (
            <div className="text-err text-xl">{loadError}</div>
          ) : (
            <>
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-accent text-lg">加载数据中...</div>
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
                className={`status-indicator ${parsedData ? "status-normal" : "status-danger"}`}
              />
              <span className="text-xs text-soft">数据</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`status-indicator ${appState === "running" ? "status-info" : "status-muted"}`}
              />
              <span className="text-xs text-soft">调度器</span>
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
              totalRows={parsedData.totalRows}
            />
          </div>
          <div>
            <SystemStatusPanel
              state={appState}
              currentIndex={currentIndex}
              totalRows={parsedData.totalRows}
              runtime={runtime}
            />
          </div>
        </div>

        {/* 实时数据表格 */}
        <RealtimeTable
          data={tableData}
          sensorNames={parsedData.allSensorNames}
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
        数据输入控制台 | 前端调度模式 | 频率: {ratePerMinute} 条/分钟
      </footer>
    </div>
  );
}
