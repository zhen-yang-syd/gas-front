"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

// 动态导入ECharts避免SSR问题
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface PredictionChartProps {
  sensorId: string;
  history: number[];
  prediction: number[];
  trend?: "rising" | "falling" | "stable";
  confidence?: number;
  height?: number;
}

/**
 * 预测曲线组件
 *
 * 显示:
 * - 左侧: 历史数据（黑色实线）
 * - 右侧: 预测数据（粉色虚线）
 * - 中间: 当前时间分隔线
 */
export function PredictionChart({
  sensorId,
  history,
  prediction,
  trend = "stable",
  confidence = 0.5,
  height = 100,
}: PredictionChartProps) {
  const option = useMemo(() => {
    const historyLen = history.length;
    const predictionLen = prediction.length;
    const totalLen = historyLen + predictionLen;

    // 生成X轴标签
    const xAxisData = [
      ...history.map((_, i) => `H${historyLen - i}`),
      ...prediction.map((_, i) => `P${i + 1}`),
    ];

    // 历史数据系列
    const historyData = [...history, ...Array(predictionLen).fill(null)];

    // 预测数据系列（从最后一个历史点连接）
    const predictionData = [
      ...Array(historyLen - 1).fill(null),
      history[historyLen - 1], // 连接点
      ...prediction,
    ];

    // 趋势颜色
    const trendColors: Record<string, string> = {
      rising: "#EF4444", // 红色 - 上升趋势（危险）
      falling: "#10B981", // 绿色 - 下降趋势（安全）
      stable: "#F59E0B", // 橙色 - 稳定
    };

    return {
      backgroundColor: "transparent",
      title: {
        text: sensorId.replace("T0", "T"),
        left: 5,
        top: 0,
        textStyle: {
          fontSize: 11,
          color: "#94A3B8",
          fontWeight: "normal",
        },
      },
      grid: {
        top: 25,
        right: 10,
        bottom: 20,
        left: 35,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1E293B",
        borderColor: "#475569",
        textStyle: { color: "#E2E8F0", fontSize: 10 },
        formatter: (params: any[]) => {
          const lines = params.map((p) => {
            if (p.value === null || p.value === undefined) return "";
            const type = p.seriesName === "历史" ? "历史" : "预测";
            return `${type}: ${p.value.toFixed(3)}%`;
          });
          return lines.filter(Boolean).join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: xAxisData,
        axisLine: { lineStyle: { color: "#475569" } },
        axisTick: { show: false },
        axisLabel: {
          show: false, // 隐藏X轴标签以节省空间
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: (value: { max: number }) => Math.max(1, value.max * 1.2),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 9,
          color: "#64748B",
          formatter: (v: number) => v.toFixed(1),
        },
        splitLine: {
          lineStyle: { color: "#334155", type: "dashed" },
        },
      },
      series: [
        {
          name: "历史",
          type: "line",
          data: historyData,
          lineStyle: { color: "#1F2937", width: 2 },
          itemStyle: { color: "#1F2937" },
          symbol: "none",
          smooth: true,
        },
        {
          name: "预测",
          type: "line",
          data: predictionData,
          lineStyle: {
            color: trendColors[trend],
            width: 2,
            type: "dashed",
          },
          itemStyle: { color: trendColors[trend] },
          symbol: "none",
          smooth: true,
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${trendColors[trend]}33` },
                { offset: 1, color: `${trendColors[trend]}00` },
              ],
            },
          },
        },
      ],
      // 当前时间标记线
      markLine: {
        silent: true,
        data: [
          {
            xAxis: historyLen - 1,
            lineStyle: { color: "#EF4444", type: "solid", width: 1 },
            label: {
              formatter: "现在",
              position: "start",
              fontSize: 8,
              color: "#EF4444",
            },
          },
        ],
      },
    };
  }, [sensorId, history, prediction, trend]);

  // 趋势图标
  const trendIcon = useMemo(() => {
    switch (trend) {
      case "rising":
        return "↑";
      case "falling":
        return "↓";
      default:
        return "→";
    }
  }, [trend]);

  const trendColor = useMemo(() => {
    switch (trend) {
      case "rising":
        return "text-red-500";
      case "falling":
        return "text-green-500";
      default:
        return "text-yellow-500";
    }
  }, [trend]);

  return (
    <div className="prediction-chart bg-slate-900 rounded border border-slate-700 p-2">
      <ReactECharts
        option={option}
        style={{ height: height, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
      <div className="flex justify-between items-center mt-1 px-1 text-xs">
        <span className={`${trendColor} font-medium`}>
          {trendIcon} {trend === "rising" ? "上升" : trend === "falling" ? "下降" : "稳定"}
        </span>
        <span className="text-slate-500">
          置信度: {(confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default PredictionChart;
