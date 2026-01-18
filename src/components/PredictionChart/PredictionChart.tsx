"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { getSensorLabel } from "@/lib/sensors";

// 动态导入ECharts避免SSR问题
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface PredictionChartProps {
  sensorId: string;
  history: number[];
  prediction: number[];
  trend?: "rising" | "falling" | "stable";
  confidence?: number;
  upperBound?: number[];  // 95% 置信区间上界
  lowerBound?: number[];  // 95% 置信区间下界
  height?: number;
}

/**
 * 实时预测曲线组件
 *
 * 显示:
 * - 历史数据（青色渐变实线）
 * - 预测数据（橙/红/绿色虚线，根据趋势）
 * - 当前时间分隔线
 * - 实时滚动更新
 */
export function PredictionChart({
  sensorId,
  history,
  prediction,
  trend = "stable",
  confidence = 0.5,
  upperBound,
  lowerBound,
  height = 160,
}: PredictionChartProps) {
  const option = useMemo(() => {
    const historyLen = history.length;
    const predictionLen = prediction.length;

    // 计算数据范围（用于动态Y轴，放大小幅波动的视觉效果）
    // 包含置信区间上下界，确保带子完全可见
    const allValues = [
      ...history,
      ...prediction,
      ...(upperBound || []),
      ...(lowerBound || [])
    ].filter(v => v !== null && v !== undefined);
    const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0;
    const dataMax = allValues.length > 0 ? Math.max(...allValues) : 1;
    const dataRange = dataMax - dataMin;
    // 紧贴数据范围，padding 只给 10%，让波动占满图表高度
    // 最小 padding 0.005 防止数据完全平坦时 Y 轴范围为 0
    const padding = Math.max(dataRange * 0.1, 0.005);
    // Y 轴最小值：紧贴数据下界，但不低于 0
    const yMin = Math.max(0, dataMin - padding);
    // Y 轴最大值：紧贴数据上界，不强制到 0.9（让波动放大显示）
    const yMax = dataMax + padding;

    // 生成时间标签（相对时间）
    const xAxisData = [
      ...history.map((_, i) => {
        const secAgo = (historyLen - i - 1);
        if (secAgo === 0) return "现在";
        if (secAgo < 60) return `-${secAgo}s`;
        return `-${Math.floor(secAgo / 60)}m`;
      }),
      ...prediction.map((_, i) => `+${(i + 1) * 5}m`),
    ];

    // 历史数据系列
    const historyData = [...history, ...Array(predictionLen).fill(null)];

    // 预测数据系列（从最后一个历史点连接）
    const predictionData = historyLen > 0
      ? [
          ...Array(historyLen - 1).fill(null),
          history[historyLen - 1], // 连接点
          ...prediction,
        ]
      : prediction;

    // 趋势颜色
    const trendColors: Record<string, string> = {
      rising: "#EF4444",   // 红色 - 上升趋势（危险）
      falling: "#10B981",  // 绿色 - 下降趋势（安全）
      stable: "#F59E0B",   // 橙色 - 稳定
    };

    // 当前值
    const currentValue = historyLen > 0 ? history[historyLen - 1] : null;

    // 固定阈值线
    const thresholdValue = 0.8;

    // 95% 置信区间数据（带子形式，跟随预测线形状）
    // 起始点收口：上界/下界在"现在"点与当前值重合，然后逐渐扩散
    // 上界数据：历史部分为 null，起始点为当前值，然后是 upperBound
    const upperBoundData = upperBound && upperBound.length > 0
      ? [
          ...Array(historyLen - 1).fill(null),
          currentValue,  // 收口：起始点使用当前值
          ...upperBound,
        ]
      : [];
    // 下界数据：历史部分为 null，起始点为当前值，然后是 lowerBound
    const lowerBoundData = lowerBound && lowerBound.length > 0
      ? [
          ...Array(historyLen - 1).fill(null),
          currentValue,  // 收口：起始点使用当前值
          ...lowerBound,
        ]
      : [];
    // 是否有置信区间数据
    const hasConfidenceBand = upperBoundData.length > 0 && lowerBoundData.length > 0;

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 300,
      title: {
        text: getSensorLabel(sensorId),
        subtext: currentValue !== null ? `${currentValue.toFixed(3)}` : "",
        left: 8,
        top: 5,
        textStyle: {
          fontSize: 13,
          color: "#E2E8F0",
          fontWeight: "bold",
        },
        subtextStyle: {
          fontSize: 12,
          color: "#06B6D4",
          fontWeight: "bold",
        },
      },
      grid: {
        top: 45,
        right: 15,
        bottom: 30,
        left: 45,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1E293B",
        borderColor: "#475569",
        textStyle: { color: "#E2E8F0", fontSize: 11 },
        formatter: (params: unknown) => {
          const paramsArray = params as Array<{ seriesName: string; value: number | null | undefined; axisValue: string }>;
          const lines = paramsArray.map((p) => {
            if (p.value === null || p.value === undefined) return "";
            const type = p.seriesName === "实时" ? "实时" : "预测";
            const color = type === "实时" ? "#06B6D4" : trendColors[trend];
            return `<span style="color:${color}">●</span> ${type}: <b>${p.value.toFixed(4)}</b>`;
          });
          return `<div style="font-family:monospace">${paramsArray[0]?.axisValue || ""}<br/>${lines.filter(Boolean).join("<br/>")}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: xAxisData,
        axisLine: { lineStyle: { color: "#475569" } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 9,
          color: "#64748B",
          interval: (index: number) => {
            // 显示关键点：开始、现在、结束
            if (index === 0) return true;
            if (index === historyLen - 1) return true;
            if (index === historyLen + predictionLen - 1) return true;
            // 每10个点显示一个
            return index % 10 === 0;
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: yMin,
        max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10,
          color: "#64748B",
          formatter: (v: number) => v.toFixed(2),
        },
        splitLine: {
          lineStyle: { color: "#334155", type: "dashed", opacity: 0.5 },
        },
        splitNumber: 4,
      },
      series: [
        {
          name: "实时",
          type: "line",
          data: historyData,
          lineStyle: {
            color: "#06B6D4",
            width: 2.5,
          },
          itemStyle: { color: "#06B6D4" },
          symbol: "none",
          smooth: 0.3,
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(6, 182, 212, 0.3)" },
                { offset: 1, color: "rgba(6, 182, 212, 0.02)" },
              ],
            },
          },
          // 阈值标注线 (0.8) - 只在 Y 轴范围包含阈值时显示
          markLine: yMax >= thresholdValue ? {
            silent: true,
            symbol: "none",
            data: [
              {
                yAxis: thresholdValue,
                lineStyle: { color: "#F59E0B", type: "dashed", width: 1.5 },
                label: {
                  show: true,
                  position: "insideEndTop",
                  formatter: `阈值: ${thresholdValue}`,
                  color: "#F59E0B",
                  fontSize: 10,
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  padding: [2, 4],
                  borderRadius: 2,
                },
              },
            ],
          } : undefined,
          // 阈值以上区域红色警示背景
          markArea: yMax >= thresholdValue ? {
            silent: true,
            data: [
              [
                { yAxis: thresholdValue },
                { yAxis: yMax },
              ],
            ],
            itemStyle: {
              color: "rgba(239, 68, 68, 0.15)",  // 红色半透明
            },
          } : undefined,
        },
        {
          name: "预测",
          type: "line",
          data: predictionData,
          lineStyle: {
            color: trendColors[trend],
            width: 2.5,
          },
          itemStyle: { color: trendColors[trend] },
          symbol: predictionLen > 0 ? "circle" : "none",
          symbolSize: 4,
          smooth: 0.3,
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${trendColors[trend]}40` },
                { offset: 1, color: `${trendColors[trend]}05` },
              ],
            },
          },
        },
        // 当前时间分割线（白色长竖线，贯穿Y轴）
        {
          name: "分割线",
          type: "line",
          data: [],
          markLine: historyLen > 0 ? {
            silent: true,
            symbol: "none",
            data: [
              {
                xAxis: historyLen - 1,
                lineStyle: { color: "#FFFFFF", type: "solid", width: 2, opacity: 0.8 },
                label: {
                  show: true,
                  position: "insideEndTop",
                  formatter: "现在",
                  color: "#FFFFFF",
                  fontSize: 10,
                  fontWeight: "bold",
                  backgroundColor: "rgba(30, 41, 59, 0.9)",
                  padding: [2, 6],
                  borderRadius: 3,
                },
              },
            ],
          } : undefined,
        },
        // 95% 置信区间带（使用差值堆叠实现带子效果）
        // 下界线（基础层，透明填充到底部）
        ...(hasConfidenceBand ? [{
          name: "95%下界",
          type: "line" as const,
          data: lowerBoundData,
          lineStyle: {
            color: "rgba(139, 92, 246, 0.6)",
            width: 1.5,
            type: "dashed" as const,
          },
          itemStyle: { color: "rgba(139, 92, 246, 0.6)" },
          symbol: "none",
          smooth: 0.3,
          stack: "confidence",
          areaStyle: {
            color: "transparent",  // 下界以下透明
          },
          z: 1,
          // 下界 tag 标注（在末端显示，用透明点承载标签）
          markPoint: {
            symbol: "circle",
            symbolSize: 1,
            data: [{
              coord: [historyLen + predictionLen - 1, lowerBound![lowerBound!.length - 1]],
              itemStyle: { color: "transparent" },
              label: {
                show: true,
                position: "left",
                formatter: `下界: ${lowerBound![lowerBound!.length - 1].toFixed(3)}`,
                color: "#A78BFA",
                fontSize: 9,
                backgroundColor: "rgba(30, 41, 59, 0.9)",
                padding: [2, 4],
                borderRadius: 2,
              },
            }],
          },
        }] : []),
        // 差值带（堆叠在下界上，显示紫色填充）
        ...(hasConfidenceBand ? [{
          name: "置信带",
          type: "line" as const,
          // 数据是上界与下界的差值
          data: upperBoundData.map((upper, i) => {
            const lower = lowerBoundData[i];
            if (upper === null || lower === null) return null;
            return upper - lower;  // 差值
          }),
          lineStyle: { width: 0 },  // 不显示差值线
          symbol: "none",
          smooth: 0.3,
          stack: "confidence",  // 堆叠在下界上
          areaStyle: {
            color: "rgba(139, 92, 246, 0.3)",  // 紫色半透明带子
          },
          z: 0,
        }] : []),
        // 上界线（虚线边框）
        ...(hasConfidenceBand ? [{
          name: "95%上界",
          type: "line" as const,
          data: upperBoundData,
          lineStyle: {
            color: "rgba(139, 92, 246, 0.6)",
            width: 1.5,
            type: "dashed" as const,
          },
          itemStyle: { color: "rgba(139, 92, 246, 0.6)" },
          symbol: "none",
          smooth: 0.3,
          z: 2,
          // 上界 tag 标注（在末端显示，用透明点承载标签）
          markPoint: {
            symbol: "circle",
            symbolSize: 1,
            data: [{
              coord: [historyLen + predictionLen - 1, upperBound![upperBound!.length - 1]],
              itemStyle: { color: "transparent" },
              label: {
                show: true,
                position: "left",
                formatter: `上界: ${upperBound![upperBound!.length - 1].toFixed(3)}`,
                color: "#A78BFA",
                fontSize: 9,
                backgroundColor: "rgba(30, 41, 59, 0.9)",
                padding: [2, 4],
                borderRadius: 2,
              },
            }],
          },
        }] : []),
      ],
    };
  }, [sensorId, history, prediction, trend, upperBound, lowerBound]);

  // 趋势信息
  const trendInfo = useMemo(() => {
    const icons: Record<string, string> = {
      rising: "↗",
      falling: "↘",
      stable: "→",
    };
    const colors: Record<string, string> = {
      rising: "text-red-400",
      falling: "text-green-400",
      stable: "text-yellow-400",
    };
    const labels: Record<string, string> = {
      rising: "上升",
      falling: "下降",
      stable: "稳定",
    };
    return { icon: icons[trend], color: colors[trend], label: labels[trend] };
  }, [trend]);

  return (
    <div className="prediction-chart bg-slate-900/80 rounded-lg border border-slate-700/50 p-2 backdrop-blur">
      <ReactECharts
        option={option}
        style={{ height: height, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
      <div className="flex justify-between items-center px-2 text-xs">
        <div className="flex items-center gap-2">
          <span className={`${trendInfo.color} font-bold text-sm`}>
            {trendInfo.icon}
          </span>
          <span className="text-slate-400">{trendInfo.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">
            历史: <span className="text-cyan-400 font-mono">{history.length}</span>
          </span>
          {prediction.length > 0 && (
            <span className="text-slate-500">
              预测: <span className={`${trendInfo.color} font-mono`}>{prediction.length}</span>
            </span>
          )}
          <span className="text-slate-500">
            置信: <span className="text-slate-300 font-mono">{(confidence * 100).toFixed(0)}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default PredictionChart;
