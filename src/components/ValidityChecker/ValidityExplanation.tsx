"use client";

import { useState } from "react";

interface InadequateSensor {
  id: string;
  msa: number;
  reason: string;
}

interface ValidityExplanationProps {
  inadequateSensors?: InadequateSensor[];
  adequateCount?: number;
  inadequateCount?: number;
  msaThreshold?: number;
}

export function ValidityExplanation({
  inadequateSensors = [],
  adequateCount = 0,
  inadequateCount = 0,
  msaThreshold = 0.5,
}: ValidityExplanationProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="validity-explanation mt-3 text-xs">
      {/* 说明按钮 */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span>{showDetails ? "收起" : "查看"}</span>
        <span>检验说明</span>
        <span className="text-slate-500">{showDetails ? "▲" : "▼"}</span>
      </button>

      {/* 详细说明 */}
      {showDetails && (
        <div className="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
          {/* 检验说明 */}
          <div>
            <div className="font-medium text-slate-300 mb-2">检验指标说明</div>
            <div className="space-y-2 text-slate-400">
              <div>
                <span className="text-blue-400">Cronbach&apos;s Alpha</span>
                <span className="ml-2">
                  内部一致性系数，测量多个传感器数据的可靠性
                </span>
              </div>
              <div>
                <span className="text-green-400">KMO</span>
                <span className="ml-2">
                  抽样适当性检验，判断数据是否适合进行相关性分析
                </span>
              </div>
              <div>
                <span className="text-amber-400">Bartlett</span>
                <span className="ml-2">
                  球形度检验，验证变量间是否存在显著相关性
                </span>
              </div>
            </div>
          </div>

          {/* 阈值标准 */}
          <div>
            <div className="font-medium text-slate-300 mb-2">阈值标准</div>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <div className="flex justify-between">
                <span>文献要求</span>
                <span className="text-slate-500">α&gt;0.8, KMO&gt;0.8</span>
              </div>
              <div className="flex justify-between">
                <span>PRD 配置</span>
                <span className="text-slate-500">α≥0.6, KMO≥0.6</span>
              </div>
              <div className="flex justify-between">
                <span>MSA 阈值</span>
                <span className="text-slate-500">≥ {msaThreshold}</span>
              </div>
              <div className="flex justify-between">
                <span>Bartlett p</span>
                <span className="text-slate-500">&lt; 0.001</span>
              </div>
            </div>
          </div>

          {/* 传感器统计 */}
          {(adequateCount > 0 || inadequateCount > 0) && (
            <div>
              <div className="font-medium text-slate-300 mb-2">传感器 MSA 检验</div>
              <div className="flex gap-4 text-slate-400">
                <span className="text-green-400">
                  合格: {adequateCount}
                </span>
                <span className={inadequateCount > 0 ? "text-red-400" : "text-slate-500"}>
                  不合格: {inadequateCount}
                </span>
              </div>
            </div>
          )}

          {/* 不合格传感器列表 */}
          {inadequateSensors.length > 0 && (
            <div>
              <div className="font-medium text-red-400 mb-2">
                不合格传感器（将被排除）
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {inadequateSensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className="flex justify-between items-center py-1 px-2 bg-red-900/20 rounded text-slate-400"
                  >
                    <span className="font-mono">{sensor.id}</span>
                    <span className="text-red-400">
                      MSA: {sensor.msa.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 文献来源 */}
          <div className="text-slate-500 text-[10px] border-t border-slate-700 pt-2">
            基于 Wu et al. (2023) FSV 分析框架
          </div>
        </div>
      )}
    </div>
  );
}

export default ValidityExplanation;
