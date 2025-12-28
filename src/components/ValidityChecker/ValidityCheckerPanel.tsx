"use client";

import { useState, useCallback } from "react";
import { CronbachCard } from "./CronbachCard";
import { KMOCard } from "./KMOCard";
import { BartlettCard } from "./BartlettCard";
import { CommunalityCard } from "./CommunalityCard";
import { ValiditySummary } from "./ValiditySummary";
import { DataUploadModal } from "./DataUploadModal";
import { ValidityExplanation } from "./ValidityExplanation";

// API 响应类型
interface CronbachResult {
  value: number;
  threshold: number;
  passed: boolean;
  interpretation: string;
}

interface KMOResult {
  value: number;
  threshold: number;
  passed: boolean;
  interpretation: string;
  msa_per_variable: Record<string, number>;
}

interface BartlettResult {
  chi_square: number;
  p_value: number;
  df: number;
  threshold: number;
  passed: boolean;
}

interface CommunalityResult {
  values: Record<string, number>;
  avg_value: number;
  threshold: number;
  passed: boolean;
  low_communality_vars: string[];
}

interface InadequateSensor {
  id: string;
  msa: number;
  reason: string;
}

// 单组验证结果（用于分组验证）
interface GroupValidityResult {
  cronbach_alpha: CronbachResult;
  kmo: KMOResult;
  bartlett: BartlettResult;
  communality?: CommunalityResult;
  overall_valid: boolean;
  sensor_count: number;
  sample_size: number;
}

// 分组验证摘要
interface GroupSummary {
  T_valid: boolean;
  WD_valid?: boolean;
  FS_valid?: boolean;
  T_sensors: number;
  WD_sensors?: number;
  FS_sensors?: number;
}

export interface ValidityResult {
  cronbach_alpha: CronbachResult;
  kmo: KMOResult;
  bartlett: BartlettResult;
  overall_valid: boolean;
  sensor_count: number;
  sample_size: number;
  timestamp: string;
  error?: string;
  // v1.3 新增：MSA 传感器过滤
  msa_threshold?: number;
  adequate_sensors?: string[];
  inadequate_sensors?: InadequateSensor[];
  adequate_count?: number;
  inadequate_count?: number;
  // v1.4 新增：Communality 检验
  communality?: CommunalityResult;
  // v1.5 新增：上传数据信息
  data_type?: string;
  uploaded_rows?: number;
  valid_rows?: number;
  columns?: string[];
  // v1.6 新增：模拟就绪状态
  ready_to_simulate?: boolean;
  upload_info?: {
    data_type: string;
    rows: number;
    columns: string[];
    status: string;
  };
  // v1.7 新增：分组验证（T-WD, T-FS）
  validation_type?: "single" | "grouped";
  T_group?: GroupValidityResult;
  WD_group?: GroupValidityResult;
  FS_group?: GroupValidityResult;
  group_summary?: GroupSummary;
}

interface ValidityCheckerPanelProps {
  apiBaseUrl?: string;
  refreshInterval?: number;
  title?: string;
  showUploadButton?: boolean;
  onStartSimulation?: () => void;  // 开始模拟回调
}

/**
 * 数据有效性验证面板
 *
 * 工作流程（基于文献 Wu et al. 2023 FSV框架）：
 * 1. 用户上传 CSV 数据（前端上传优先）
 * 2. 后端按顺序执行四项检验：
 *    - Cronbach's Alpha ≥ 0.6 (内部一致性)
 *    - KMO ≥ 0.6 (抽样适当性)
 *    - Bartlett p < 0.001 (球形检验)
 *    - Communality ≥ 0.6 (共同性)
 * 3. MSA 过滤不合格传感器 (≥ 0.5)
 * 4. 显示验证结果
 */
export function ValidityCheckerPanel({
  apiBaseUrl = "http://localhost:8000/api/analysis",
  title = "数据有效性验证",
  showUploadButton = true,
  onStartSimulation,
}: ValidityCheckerPanelProps) {
  // 初始状态：无数据，等待用户上传
  const [data, setData] = useState<ValidityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dataSource, setDataSource] = useState<"none" | "uploaded" | "backend">("none");

  // 从后端获取验证结果（可选，用于已有数据流）
  const fetchValidity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/validity`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result);
        setError(null);
        setDataSource("backend");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch validity data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // 上传完成回调
  const handleUploadComplete = (result: ValidityResult) => {
    setData(result);
    setError(null);
    setShowUploadModal(false);
    setDataSource("uploaded");
  };

  return (
    <div className="validity-checker-panel bg-slate-800 rounded-lg border border-slate-700 p-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="flex gap-2">
          {showUploadButton && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              上传数据
            </button>
          )}
          {dataSource !== "none" && (
            <button
              onClick={fetchValidity}
              disabled={loading}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-50"
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
          )}
        </div>
      </div>

      {/* 数据来源标识 */}
      {dataSource !== "none" && (
        <div className="mb-3 text-xs">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
            dataSource === "uploaded" ? "bg-blue-900/50 text-blue-400" : "bg-slate-700 text-slate-400"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {dataSource === "uploaded" ? "上传数据" : "后端数据"}
            {data?.data_type && ` (${data.data_type})`}
          </span>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <span className="animate-pulse">验证中...</span>
        </div>
      )}

      {/* 初始状态：提示用户上传数据 */}
      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 space-y-3">
          <div className="text-center">
            <div className="text-sm mb-1">请上传 CSV 数据进行有效性验证</div>
            <div className="text-xs text-slate-500">
              基于 Wu et al. (2023) FSV 分析框架
            </div>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            上传数据文件
          </button>
          <div className="text-xs text-slate-500">
            支持 CSV 或 JSON 格式，至少 30 行数据
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && !data && (
        <div className="flex flex-col items-center justify-center h-40 space-y-3">
          <div className="text-red-400 text-sm text-center">{error}</div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            重新上传
          </button>
        </div>
      )}

      {/* 验证结果 */}
      {data && !loading && (
        <div className="space-y-4">
          {/* 上传数据信息 */}
          {data.uploaded_rows && (
            <div className="text-xs text-slate-500 flex gap-4">
              <span>原始行数: {data.uploaded_rows}</span>
              <span>有效行数: {data.valid_rows}</span>
              <span>列数: {data.columns?.length || data.sensor_count}</span>
            </div>
          )}

          {/* 分组验证提示 (T-WD, T-FS) */}
          {data.validation_type === "grouped" && data.group_summary && (
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">分组验证 (文献要求)</div>
              <div className="flex gap-4 text-xs">
                <div className={`flex items-center gap-1 ${data.group_summary.T_valid ? "text-green-400" : "text-red-400"}`}>
                  <span>{data.group_summary.T_valid ? "✓" : "✗"}</span>
                  <span>T组 ({data.group_summary.T_sensors}个)</span>
                </div>
                {data.group_summary.WD_valid !== undefined && (
                  <div className={`flex items-center gap-1 ${data.group_summary.WD_valid ? "text-green-400" : "text-red-400"}`}>
                    <span>{data.group_summary.WD_valid ? "✓" : "✗"}</span>
                    <span>WD组 ({data.group_summary.WD_sensors}个)</span>
                  </div>
                )}
                {data.group_summary.FS_valid !== undefined && (
                  <div className={`flex items-center gap-1 ${data.group_summary.FS_valid ? "text-green-400" : "text-red-400"}`}>
                    <span>{data.group_summary.FS_valid ? "✓" : "✗"}</span>
                    <span>FS组 ({data.group_summary.FS_sensors}个)</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                下方显示 T 组验证结果（主要分析对象）
              </div>
            </div>
          )}

          {/* 四个检验卡片 (2x2 布局) - 显示 T 组结果 */}
          <div className="grid grid-cols-2 gap-3">
            <CronbachCard data={data.cronbach_alpha} />
            <KMOCard data={data.kmo} />
            <BartlettCard data={data.bartlett} />
            {data.communality ? (
              <CommunalityCard data={data.communality} />
            ) : (
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <div className="text-xs text-slate-400 mb-2">Communality</div>
                <div className="text-center text-slate-500 text-sm py-4">
                  计算中...
                </div>
              </div>
            )}
          </div>

          {/* 综合结论 */}
          <ValiditySummary
            overallValid={data.overall_valid}
            sensorCount={data.sensor_count}
            sampleSize={data.sample_size}
            timestamp={data.timestamp}
          />

          {/* 说明组件 */}
          <ValidityExplanation
            inadequateSensors={data.inadequate_sensors}
            adequateCount={data.adequate_count}
            inadequateCount={data.inadequate_count}
            msaThreshold={data.msa_threshold}
          />

          {/* 开始模拟按钮 - 上传成功且验证通过后显示 */}
          {data.ready_to_simulate && onStartSimulation && (
            <div className="pt-3 border-t border-slate-700">
              <button
                onClick={onStartSimulation}
                className={`w-full py-2 text-sm font-medium rounded transition-colors ${
                  data.overall_valid
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-amber-600 hover:bg-amber-500 text-white"
                }`}
              >
                {data.overall_valid ? "✓ 验证通过，开始模拟推送" : "⚠ 部分验证未通过，仍可开始模拟"}
              </button>
              {!data.overall_valid && (
                <div className="mt-2 text-xs text-amber-400 text-center">
                  建议检查数据质量后再进行分析
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 上传弹窗 */}
      {showUploadModal && (
        <DataUploadModal
          apiBaseUrl={apiBaseUrl}
          onClose={() => setShowUploadModal(false)}
          onComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}

export default ValidityCheckerPanel;
