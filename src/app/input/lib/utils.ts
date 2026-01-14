// 格式化系统时间
export function formatSystemTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day}_${hours}:${minutes}:${seconds}`;
}

// 格式化数值（保留1-3位小数）
export function formatValue(value: number | null): string {
  if (value === null || isNaN(value)) return "-";
  return value.toFixed(3).replace(/\.?0+$/, "");
}

// 传感器阈值配置
const SENSOR_THRESHOLDS: Record<string, { warning: number; danger: number }> = {
  // T 传感器（瓦斯浓度）: warning > 0.8, danger > 1.0
  T: { warning: 0.8, danger: 1.0 },
  // WY 传感器（位移）: warning > 3mm, danger > 10mm
  WY: { warning: 3.0, danger: 10.0 },
  // YL 传感器（应力）: warning > 15MPa, danger > 25MPa
  YL: { warning: 15.0, danger: 25.0 },
  // CO 传感器（一氧化碳）: warning > 0.5%, danger > 1.5%
  CO: { warning: 0.5, danger: 1.5 },
  // SY 传感器（水压）: warning > 0.6MPa, danger > 1.2MPa
  SY: { warning: 0.6, danger: 1.2 },
  // LL 传感器（流量）: warning > 5L/s, danger > 20L/s
  LL: { warning: 5.0, danger: 20.0 },
};

// 根据值判断传感器状态
export function getSensorStatus(
  value: number | null,
  sensorName: string
): "normal" | "warning" | "danger" | "no-data" {
  if (value === null || isNaN(value)) return "no-data";

  // FS和WD开头的传感器不使用阈值，始终显示为正常
  if (sensorName.startsWith("FS") || sensorName.startsWith("WD")) {
    return "normal";
  }

  // 获取传感器前缀并查找对应阈值
  const prefix = sensorName.replace(/\d+$/, "");
  const thresholds = SENSOR_THRESHOLDS[prefix];

  if (thresholds) {
    if (value > thresholds.danger) return "danger";
    if (value > thresholds.warning) return "warning";
  }

  return "normal";
}

// 获取状态文本
export function getStatusText(
  status: "normal" | "warning" | "danger" | "no-data"
): string {
  switch (status) {
    case "normal":
      return "正常";
    case "warning":
      return "预警";
    case "danger":
      return "告警";
    case "no-data":
      return "无数据";
  }
}

// 格式化运行时间（秒 -> HH:MM:SS）
export function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
