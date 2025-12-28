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
}

/**
 * 预测曲线网格组件
 *
 * 显示多个传感器的预测曲线
 */
export function PredictionGrid({
  predictions,
  columns = 3,
}: PredictionGridProps) {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        暂无预测数据
      </div>
    );
  }

  return (
    <div
      className="prediction-grid gap-2"
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
          height={80}
        />
      ))}
    </div>
  );
}

export default PredictionGrid;
