"use client";

import { PredictionChart } from "./PredictionChart";

interface PredictionData {
  sensor_id: string;
  history: number[];
  prediction: number[];
  trend: "rising" | "falling" | "stable";
  confidence: number;
}

interface PredictionGridProps {
  predictions: PredictionData[];
  columns?: number;
  chartHeight?: number;
}

/**
 * 实时预测曲线网格组件
 *
 * 显示多个传感器的实时滚动预测曲线
 */
export function PredictionGrid({
  predictions,
  columns = 1,
  chartHeight = 140,
}: PredictionGridProps) {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <div>等待传感器数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="prediction-grid gap-3"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {predictions.map((pred) => (
        <PredictionChart
          key={pred.sensor_id}
          sensorId={pred.sensor_id}
          history={pred.history}
          prediction={pred.prediction}
          trend={pred.trend}
          confidence={pred.confidence}
          height={chartHeight}
        />
      ))}
    </div>
  );
}

export default PredictionGrid;
