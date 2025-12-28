/**
 * 传感器位置配置
 *
 * 基于MaZhuang矿洞布局，分为5个采区
 */

export interface SensorPosition {
  x: number;
  y: number;
  zone: number;
  type: "T" | "WD" | "FS";
}

// 地图尺寸
export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 400;

// 采区颜色
export const ZONE_COLORS: Record<number, string> = {
  1: "#3B82F6", // 蓝色
  2: "#10B981", // 绿色
  3: "#F59E0B", // 橙色
  4: "#8B5CF6", // 紫色
  5: "#EC4899", // 粉色
};

// T传感器位置 (瓦斯浓度)
export const T_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  // 采区1 (01xx)
  T010101: { x: 80, y: 60, zone: 1, type: "T" },
  T010102: { x: 120, y: 60, zone: 1, type: "T" },
  T010103: { x: 160, y: 60, zone: 1, type: "T" },
  T010104: { x: 80, y: 100, zone: 1, type: "T" },
  T010105: { x: 120, y: 100, zone: 1, type: "T" },
  T010106: { x: 160, y: 100, zone: 1, type: "T" },

  // 采区2 (02xx)
  T010201: { x: 80, y: 180, zone: 2, type: "T" },
  T010202: { x: 120, y: 180, zone: 2, type: "T" },
  T010203: { x: 160, y: 180, zone: 2, type: "T" },
  T010204: { x: 80, y: 220, zone: 2, type: "T" },
  T010205: { x: 120, y: 220, zone: 2, type: "T" },

  // 采区3 (03xx)
  T010301: { x: 280, y: 60, zone: 3, type: "T" },
  T010302: { x: 320, y: 60, zone: 3, type: "T" },
  T010303: { x: 360, y: 60, zone: 3, type: "T" },
  T010304: { x: 400, y: 60, zone: 3, type: "T" },
  T010305: { x: 280, y: 100, zone: 3, type: "T" },
  T010306: { x: 320, y: 100, zone: 3, type: "T" },
  T010307: { x: 360, y: 100, zone: 3, type: "T" },
  T010308: { x: 400, y: 100, zone: 3, type: "T" },

  // 采区4 (04xx)
  T010401: { x: 200, y: 320, zone: 4, type: "T" },

  // 采区5 (05xx)
  T010501: { x: 400, y: 320, zone: 5, type: "T" },
};

// WD传感器位置 (温度)
export const WD_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  // 采区1
  WD010101: { x: 100, y: 40, zone: 1, type: "WD" },
  WD010102: { x: 140, y: 40, zone: 1, type: "WD" },
  WD010103: { x: 100, y: 80, zone: 1, type: "WD" },
  WD010104: { x: 140, y: 80, zone: 1, type: "WD" },
  WD010105: { x: 100, y: 120, zone: 1, type: "WD" },
  WD010106: { x: 140, y: 120, zone: 1, type: "WD" },
  WD010107: { x: 60, y: 60, zone: 1, type: "WD" },
  WD010108: { x: 60, y: 100, zone: 1, type: "WD" },
  WD010109: { x: 180, y: 60, zone: 1, type: "WD" },
  WD010110: { x: 180, y: 100, zone: 1, type: "WD" },
  WD010111: { x: 120, y: 140, zone: 1, type: "WD" },

  // 采区2
  WD010201: { x: 120, y: 200, zone: 2, type: "WD" },

  // 采区3
  WD010301: { x: 340, y: 80, zone: 3, type: "WD" },
  WD010302: { x: 340, y: 120, zone: 3, type: "WD" },

  // 采区4
  WD010401: { x: 220, y: 300, zone: 4, type: "WD" },

  // 采区5
  WD010501: { x: 420, y: 300, zone: 5, type: "WD" },
};

// FS传感器位置 (风速)
export const FS_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  FS010103: { x: 160, y: 80, zone: 1, type: "FS" },
  FS010104: { x: 80, y: 80, zone: 1, type: "FS" },
  FS010105: { x: 120, y: 80, zone: 1, type: "FS" },
  FS010201: { x: 100, y: 200, zone: 2, type: "FS" },
  FS010202: { x: 140, y: 200, zone: 2, type: "FS" },
  FS010301: { x: 300, y: 80, zone: 3, type: "FS" },
  FS010302: { x: 380, y: 80, zone: 3, type: "FS" },
};

// 所有传感器位置
export const ALL_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  ...T_SENSOR_POSITIONS,
  ...WD_SENSOR_POSITIONS,
  ...FS_SENSOR_POSITIONS,
};

// 获取传感器位置
export function getSensorPosition(sensorId: string): SensorPosition | null {
  return ALL_SENSOR_POSITIONS[sensorId] || null;
}
