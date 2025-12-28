"use client";

interface ValiditySummaryProps {
  overallValid: boolean;
  sensorCount: number;
  sampleSize: number;
  timestamp: string;
}

export function ValiditySummary({
  overallValid,
  sensorCount,
  sampleSize,
  timestamp,
}: ValiditySummaryProps) {
  // 格式化时间
  const formatTime = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  return (
    <div
      className={`rounded-lg p-3 border ${
        overallValid
          ? "bg-green-900/20 border-green-700"
          : "bg-red-900/20 border-red-700"
      }`}
    >
      <div className="flex items-center justify-between">
        {/* 综合结论 */}
        <div className="flex items-center gap-2">
          <span
            className={`text-lg ${
              overallValid ? "text-green-400" : "text-red-400"
            }`}
          >
            {overallValid ? "✓" : "✗"}
          </span>
          <span className="text-sm text-slate-200">
            {overallValid
              ? "数据通过有效性验证，适合进行相关性分析"
              : "数据未通过有效性验证，建议检查数据质量"}
          </span>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        <span>传感器: {sensorCount}</span>
        <span>样本量: {sampleSize}</span>
        <span>检验时间: {formatTime(timestamp)}</span>
      </div>
    </div>
  );
}

export default ValiditySummary;
