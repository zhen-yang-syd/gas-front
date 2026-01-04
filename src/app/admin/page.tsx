"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { healthCheck, analysisApi } from "@/lib/api";

interface ValidityResult {
  overall_valid: boolean;
  cronbach_alpha?: { value: number; threshold: number; passed: boolean };
  kmo?: { value: number; threshold: number; passed: boolean };
  bartlett?: { statistic: number; p_value: number; threshold: number; passed: boolean };
  communality?: { mean: number; threshold: number; passed: boolean };
  adequate_sensors?: string[];
  inadequate_sensors?: { id: string; msa: number; reason: string }[];
  validation_type?: string;  // "grouped" for T-WD/T-FS
  group_summary?: {
    T_valid?: boolean;
    WD_valid?: boolean;
    FS_valid?: boolean;
  };
}

interface FSVResult {
  round1_pairs: { sensor1: string; sensor2: string; r: number }[];
  round2_pairs: { sensor1: string; sensor2: string; r: number }[];
  verified_pairs: { sensor1: string; sensor2: string; r1: number; r2: number }[];
  dropped_pairs: { sensor1: string; sensor2: string; reason: string }[];
  verification_rate: number;
  adequate_sensors?: string[];
  adequate_count?: number;
  total_sensors?: number;
}

interface CorrelationItem {
  sensor1: string;
  sensor2: string;
  r_value: number;
  p_value: number;
  strength: string;
  is_significant: boolean;
}

interface CorrelationResult {
  total_pairs: number;
  by_strength: Record<string, number>;
  avg_r: number;
  max_r: number;
  results: CorrelationItem[];
}

export default function AdminPage() {
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "error">("loading");
  const [validity, setValidity] = useState<Record<string, ValidityResult>>({});
  const [fsv, setFsv] = useState<FSVResult | null>(null);
  const [correlations, setCorrelations] = useState<Record<string, CorrelationResult>>({});
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedType, setSelectedType] = useState<"T-T" | "T-WD" | "T-FS">("T-T");

  // 检查API连接
  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("error"));
  }, []);

  // 获取数据
  const fetchData = useCallback(async () => {
    try {
      // 获取相关性数据（包含验证信息）
      const corrData = await analysisApi.getCorrelation();
      if (corrData.correlations) {
        setCorrelations(corrData.correlations);
      }
      if (corrData.validity) {
        setValidity(corrData.validity as unknown as Record<string, ValidityResult>);
      }

      // 获取FSV数据
      try {
        const fsvData = await analysisApi.getFsv();
        if (fsvData) {
          setFsv(fsvData as unknown as FSVResult);
        }
      } catch (fsvError) {
        console.error("FSV fetch failed:", fsvError);
      }

      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
  }, []);

  // 初始加载和自动刷新
  useEffect(() => {
    if (apiStatus !== "connected") return;

    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [apiStatus, autoRefresh, fetchData]);

  // 获取验证指标卡片
  const renderValidityCard = (
    title: string,
    value: number | undefined,
    threshold: number,
    passed: boolean | undefined,
    format: string = "decimal"
  ) => {
    const displayValue = value !== undefined
      ? format === "percent" ? `${(value * 100).toFixed(1)}%` : value.toFixed(4)
      : "N/A";

    return (
      <div className="industrial-card p-4">
        <div className="text-xs text-dim mb-2 font-mono uppercase">{title}</div>
        <div className={`text-2xl font-mono mb-2 ${passed ? "text-ok" : passed === false ? "text-err" : "text-dim"}`}>
          {displayValue}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-dim">阈值: {format === "percent" ? `${threshold * 100}%` : threshold}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-mono ${passed ? "bg-normal/20 text-ok" : passed === false ? "bg-danger/20 text-err" : "bg-muted/20 text-dim"}`}>
            {passed ? "通过" : passed === false ? "失败" : "无数据"}
          </span>
        </div>
      </div>
    );
  };

  const currentValidity = validity[selectedType];

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="border-b border-edge bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="industrial-title text-lg">
              <span className="text-accent font-display">ANALYSIS</span>
              <span className="text-soft ml-2 text-sm font-body">相关性分析管理</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="industrial-btn text-xs px-3 py-1.5 hover:border-accent">
              返回主界面
            </Link>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`industrial-btn text-xs px-3 py-1.5 ${autoRefresh ? "border-accent text-accent" : ""}`}
            >
              {autoRefresh ? "自动刷新 30s" : "手动刷新"}
            </button>

            <button onClick={fetchData} className="industrial-btn text-xs px-3 py-1.5">
              刷新
            </button>

            <div className="flex items-center gap-1.5">
              <span className={`status-indicator ${apiStatus === "connected" ? "status-normal" : "status-danger"}`} />
              <span className="text-xs text-dim font-mono">{lastUpdate || "--:--:--"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4">
        {/* 类型选择 */}
        <div className="flex gap-2 mb-4">
          {(["T-T", "T-WD", "T-FS"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`industrial-btn text-xs px-4 py-2 ${selectedType === type ? "border-accent text-accent" : ""}`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* 信效度验证结果 - 四个指标卡片 */}
          <div className="col-span-12">
            <div className="industrial-card p-4 mb-4">
              <div className="industrial-title text-xs mb-4">信效度验证 - {selectedType}</div>
              <div className="grid grid-cols-4 gap-4">
                {renderValidityCard(
                  "Cronbach's Alpha",
                  currentValidity?.cronbach_alpha?.value,
                  currentValidity?.cronbach_alpha?.threshold || 0.6,
                  currentValidity?.cronbach_alpha?.passed
                )}
                {renderValidityCard(
                  "KMO",
                  currentValidity?.kmo?.value,
                  currentValidity?.kmo?.threshold || 0.6,
                  currentValidity?.kmo?.passed
                )}
                {renderValidityCard(
                  "Bartlett p-value",
                  currentValidity?.bartlett?.p_value,
                  currentValidity?.bartlett?.threshold || 0.001,
                  currentValidity?.bartlett?.passed
                )}
                {renderValidityCard(
                  "Communality",
                  currentValidity?.communality?.mean,
                  currentValidity?.communality?.threshold || 0.6,
                  currentValidity?.communality?.passed
                )}
              </div>

              {/* 整体验证状态 */}
              <div className="mt-4 pt-4 border-t border-edge flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-dim">整体状态:</span>
                  <span className={`px-3 py-1 rounded text-xs font-mono ${currentValidity?.overall_valid ? "bg-normal/20 text-ok border border-normal" : "bg-danger/20 text-err border border-danger"}`}>
                    {currentValidity?.overall_valid ? "已验证" : "未验证"}
                  </span>
                  {/* 分组验证详情 */}
                  {currentValidity?.validation_type === "grouped" && currentValidity?.group_summary && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${currentValidity.group_summary.T_valid ? "bg-normal/20 text-ok" : "bg-danger/20 text-err"}`}>
                        T组 {currentValidity.group_summary.T_valid ? "✓" : "✗"}
                      </span>
                      {selectedType === "T-WD" && (
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${currentValidity.group_summary.WD_valid ? "bg-normal/20 text-ok" : "bg-danger/20 text-err"}`}>
                          WD组 {currentValidity.group_summary.WD_valid ? "✓" : "✗"}
                        </span>
                      )}
                      {selectedType === "T-FS" && (
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${currentValidity.group_summary.FS_valid ? "bg-normal/20 text-ok" : "bg-danger/20 text-err"}`}>
                          FS组 {currentValidity.group_summary.FS_valid ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {currentValidity?.adequate_sensors && (
                  <span className="text-xs text-dim">
                    合格传感器: <span className="text-bright">{currentValidity.adequate_sensors.length}</span> 个
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* FSV 两轮验证 */}
          <div className="col-span-6">
            <div className="industrial-card p-4 h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="industrial-title text-xs">FSV 两轮验证</div>
                {fsv && (
                  <span className="text-xs font-mono text-accent">
                    验证率: {(fsv.verification_rate * 100).toFixed(1)}%
                  </span>
                )}
              </div>

              {fsv ? (
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    {/* 第一轮 */}
                    <div>
                      <div className="text-xs text-dim mb-2 font-mono">第一轮 (0-15秒)</div>
                      <div className="space-y-1">
                        {fsv.round1_pairs.slice(0, 15).map((pair, idx) => (
                          <div key={idx} className="flex items-center justify-between px-2 py-1 bg-tertiary/50 rounded text-xs">
                            <span className="font-mono text-soft">
                              {pair.sensor1.slice(-4)}-{pair.sensor2.slice(-4)}
                            </span>
                            <span className="font-mono text-bright">{pair.r.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 第二轮 */}
                    <div>
                      <div className="text-xs text-dim mb-2 font-mono">第二轮 (15-30秒)</div>
                      <div className="space-y-1">
                        {fsv.round2_pairs.slice(0, 15).map((pair, idx) => (
                          <div key={idx} className="flex items-center justify-between px-2 py-1 bg-tertiary/50 rounded text-xs">
                            <span className="font-mono text-soft">
                              {pair.sensor1.slice(-4)}-{pair.sensor2.slice(-4)}
                            </span>
                            <span className="font-mono text-bright">{pair.r.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 验证结果统计 */}
                  <div className="mt-4 pt-4 border-t border-edge">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="text-dim mb-1">验证通过对</div>
                        <div className="text-2xl font-mono text-ok">{fsv.verified_pairs.length}</div>
                      </div>
                      <div>
                        <div className="text-dim mb-1">剔除对</div>
                        <div className="text-2xl font-mono text-err">{fsv.dropped_pairs.length}</div>
                      </div>
                      <div>
                        <div className="text-dim mb-1">合格传感器</div>
                        <div className="text-2xl font-mono text-accent">{fsv.adequate_count || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-dim text-xs">
                  等待FSV数据...
                </div>
              )}
            </div>
          </div>

          {/* 数据分段分析可视化（简化版） */}
          <div className="col-span-6">
            <div className="industrial-card p-4 h-[400px] flex flex-col">
              <div className="industrial-title text-xs mb-4">数据分段分析</div>

              <div className="flex-1 flex flex-col items-center justify-center">
                {/* 简化的分段示意图 */}
                <div className="relative w-full max-w-xs">
                  {/* 全量数据 */}
                  <div className="text-center mb-4">
                    <div className="inline-block px-4 py-2 bg-accent/20 border border-accent rounded text-xs font-mono text-accent">
                      全量数据
                    </div>
                  </div>

                  {/* 分支线 */}
                  <div className="flex justify-center mb-2">
                    <svg width="200" height="30" className="text-dim">
                      <line x1="100" y1="0" x2="30" y2="30" stroke="currentColor" strokeWidth="1" />
                      <line x1="100" y1="0" x2="100" y2="30" stroke="currentColor" strokeWidth="1" />
                      <line x1="100" y1="0" x2="170" y2="30" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  </div>

                  {/* 三分 */}
                  <div className="flex justify-between mb-4 px-4">
                    <div className="px-3 py-1.5 bg-tertiary border border-edge rounded text-xs font-mono text-soft">
                      1/3
                    </div>
                    <div className="px-3 py-1.5 bg-tertiary border border-edge rounded text-xs font-mono text-soft">
                      2/3
                    </div>
                    <div className="px-3 py-1.5 bg-tertiary border border-edge rounded text-xs font-mono text-soft">
                      3/3
                    </div>
                  </div>

                  {/* 说明 */}
                  <div className="text-center text-xs text-dim space-y-2 mt-6">
                    <div>|r| &ge; 0.3 &rarr; 继续分割</div>
                    <div>|r| &lt; 0.3 &rarr; 停止 (弱相关)</div>
                    <div className="pt-2 border-t border-edge mt-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-normal mr-2" />
                      强相关 (&ge;0.7)
                      <span className="inline-block w-3 h-3 rounded-full bg-warning ml-4 mr-2" />
                      中等 (0.3-0.7)
                    </div>
                  </div>
                </div>

                {/* 当前数据统计 */}
                {correlations[selectedType] && (
                  <div className="mt-6 text-xs text-dim">
                    <span>当前对数: </span>
                    <span className="text-bright font-mono">{correlations[selectedType].total_pairs}</span>
                    <span className="mx-2">|</span>
                    <span>平均r值: </span>
                    <span className="text-accent font-mono">{correlations[selectedType].avg_r?.toFixed(4) || "N/A"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 相关性结果详表 */}
          <div className="col-span-12">
            <div className="industrial-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="industrial-title text-xs">相关性结果 - {selectedType}</div>
                {correlations[selectedType] && (
                  <div className="flex gap-4 text-xs font-mono">
                    <span className="text-dim">总数: <span className="text-bright">{correlations[selectedType].total_pairs}</span></span>
                    <span className="text-dim">平均r: <span className="text-accent">{correlations[selectedType].avg_r?.toFixed(4)}</span></span>
                    <span className="text-dim">最大r: <span className="text-ok">{correlations[selectedType].max_r?.toFixed(4)}</span></span>
                  </div>
                )}
              </div>

              <div className="overflow-auto max-h-[300px] custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-dim border-b border-edge">
                      <th className="text-left py-2 px-3 font-mono">传感器1</th>
                      <th className="text-left py-2 px-3 font-mono">传感器2</th>
                      <th className="text-left py-2 px-3 font-mono">类型</th>
                      <th className="text-right py-2 px-3 font-mono">r值</th>
                      <th className="text-center py-2 px-3 font-mono">强度</th>
                      <th className="text-right py-2 px-3 font-mono">p值</th>
                      <th className="text-center py-2 px-3 font-mono">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlations[selectedType]?.results?.slice(0, 50).map((item, idx) => (
                      <tr key={idx} className="border-b border-edge/50 hover:bg-tertiary/30">
                        <td className="py-2 px-3 font-mono text-soft">{item.sensor1}</td>
                        <td className="py-2 px-3 font-mono text-soft">{item.sensor2}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-mono">
                            {selectedType}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-bright">{item.r_value.toFixed(4)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                            item.strength === "VeryGood" || item.strength === "Good" ? "bg-normal/20 text-ok" :
                            item.strength === "Medium" ? "bg-warning/20 text-warn" :
                            "bg-muted/20 text-dim"
                          }`}>
                            {item.strength}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-dim">
                          {item.p_value < 0.001 ? "<0.001" : item.p_value.toFixed(4)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono ${item.is_significant ? "bg-normal/20 text-ok" : "bg-muted/20 text-dim"}`}>
                            {item.is_significant ? "显著" : "不显著"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!correlations[selectedType]?.results || correlations[selectedType].results.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-dim">
                          暂无相关性数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 强度分布 */}
              {correlations[selectedType]?.by_strength && (
                <div className="mt-4 pt-4 border-t border-edge">
                  <div className="flex items-center gap-6 text-xs">
                    <span className="text-dim">分布:</span>
                    {Object.entries(correlations[selectedType].by_strength).map(([strength, count]) => (
                      <span key={strength} className="font-mono">
                        <span className={
                          strength === "VeryGood" || strength === "Good" ? "text-ok" :
                          strength === "Medium" ? "text-warn" : "text-dim"
                        }>{strength}</span>
                        <span className="text-soft ml-1">({count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-edge bg-surface px-4 py-2 text-center text-xs text-dim font-mono">
        分析管理 | 传感器关联分析平台 | 自动刷新: {autoRefresh ? "开启 (30秒)" : "关闭"}
      </footer>
    </div>
  );
}
