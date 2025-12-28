"use client";

interface BartlettResult {
  chi_square: number;
  p_value: number;
  df: number;
  threshold: number;
  passed: boolean;
}

interface BartlettCardProps {
  data: BartlettResult;
}

export function BartlettCard({ data }: BartlettCardProps) {
  const { chi_square, p_value, df, threshold, passed } = data;

  // 格式化 p 值显示
  const formatPValue = (p: number) => {
    if (p < 0.0001) return "< 0.0001";
    if (p < 0.001) return "< 0.001";
    return p.toFixed(4);
  };

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      {/* 标题 */}
      <div className="text-xs text-slate-400 mb-2">Bartlett 球形检验</div>

      {/* 卡方值 */}
      <div className="text-center mb-1">
        <span className="text-lg font-bold text-white">
          χ² = {chi_square.toFixed(2)}
        </span>
      </div>

      {/* p 值 */}
      <div className="text-center mb-2">
        <span className="text-sm text-slate-300">
          p = {formatPValue(p_value)}
        </span>
      </div>

      {/* 自由度 */}
      <div className="text-xs text-slate-500 text-center mb-2">
        自由度: {df} | 阈值: p &lt; {threshold}
      </div>

      {/* 结果 */}
      <div className={`text-xs text-center ${passed ? "text-green-400" : "text-red-400"}`}>
        {passed ? "✓" : "✗"} {passed ? "存在显著相关性" : "无显著相关性"}
      </div>
    </div>
  );
}

export default BartlettCard;
