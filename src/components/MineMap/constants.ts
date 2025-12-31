/**
 * 传感器位置配置
 *
 * 基于 drawio 文件坐标系重新设计
 * 画布尺寸: 1600 × 550
 *
 * 布局说明 (基于 drawio):
 * - 主进风巷: y=200-210 (顶部水平)
 * - 主回风巷: y=280-290 (中部水平)
 * - 下部巷道: y=360-370 (下层水平)
 * - MaZhuang入口: (770-870, 40-90) 斜向上
 * - L形分支: x=1120-1600, y=360-490
 */

export interface SensorPosition {
  x: number;
  y: number;
  zone: number;
  type: "T" | "WD" | "FS";
}

// 地图尺寸 - 基于 drawio 坐标系
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 550;

// 采区颜色
export const ZONE_COLORS: Record<number, string> = {
  1: "#3B82F6", // 蓝色 - 左侧区域
  2: "#10B981", // 绿色 - 中部区域
  3: "#F59E0B", // 橙色 - 右中区域
  4: "#8B5CF6", // 紫色 - MaZhuang入口区域
  5: "#EC4899", // 粉色 - L形分支区域
};

/**
 * T传感器位置 (瓦斯浓度) - 共21个
 * 基于 drawio 文件中的椭圆位置
 */
export const T_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  // ====== 采区01 - 左侧区域 (6个) ======
  T010101: { x: 115, y: 345, zone: 1, type: "T" },   // 下部巷道入口
  T010102: { x: 405, y: 305, zone: 1, type: "T" },   // 工作面区域上排
  T010103: { x: 465, y: 305, zone: 1, type: "T" },   // 工作面区域上排
  T010104: { x: 405, y: 345, zone: 1, type: "T" },   // 工作面区域下排
  T010105: { x: 465, y: 345, zone: 1, type: "T" },   // 工作面区域下排
  T010106: { x: 515, y: 345, zone: 1, type: "T" },   // 工作面区域下排延伸

  // ====== 采区02 - 中部垂直连接区域 (5个) ======
  T010201: { x: 565, y: 255, zone: 2, type: "T" },   // 垂直连接上部
  T010202: { x: 545, y: 315, zone: 2, type: "T" },   // 垂直连接中部
  T010203: { x: 635, y: 315, zone: 2, type: "T" },   // 交叉点
  T010204: { x: 665, y: 315, zone: 2, type: "T" },   // 工作面入口
  T010205: { x: 695, y: 315, zone: 2, type: "T" },   // 工作面内部

  // ====== 采区03 - 中右侧区域 (8个) ======
  T010301: { x: 635, y: 345, zone: 3, type: "T" },   // 下部巷道
  T010302: { x: 665, y: 345, zone: 3, type: "T" },   // 下部巷道
  T010303: { x: 695, y: 345, zone: 3, type: "T" },   // 下部巷道
  T010304: { x: 1085, y: 315, zone: 3, type: "T" },  // L分支入口上
  T010305: { x: 1145, y: 305, zone: 3, type: "T" },  // L分支竖直段上
  T010306: { x: 1145, y: 335, zone: 3, type: "T" },  // L分支竖直段下
  T010307: { x: 1065, y: 385, zone: 3, type: "T" },  // L分支斜向
  T010308: { x: 1085, y: 415, zone: 3, type: "T" },  // L分支中间

  // ====== 采区04 - MaZhuang入口区域 (1个) ======
  T010401: { x: 1235, y: 255, zone: 4, type: "T" },  // 主巷道右侧

  // ====== 采区05 - L形分支延伸 (1个) ======
  T010501: { x: 1275, y: 385, zone: 5, type: "T" },  // L分支下部
};

/**
 * WD传感器位置 (温度) - 共16个
 */
export const WD_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  // ====== MaZhuang入口区域 (11个) - 上部密集分布 ======
  WD010101: { x: 805, y: 155, zone: 4, type: "WD" },  // 入口左
  WD010102: { x: 785, y: 185, zone: 4, type: "WD" },  // 入口左下
  WD010103: { x: 815, y: 185, zone: 4, type: "WD" },  // 入口右下
  WD010104: { x: 945, y: 165, zone: 4, type: "WD" },  // 入口右侧上
  WD010105: { x: 975, y: 155, zone: 4, type: "WD" },  // 入口右侧
  WD010106: { x: 975, y: 185, zone: 4, type: "WD" },  // 入口右侧下
  WD010107: { x: 1195, y: 150, zone: 4, type: "WD" }, // 主巷道右上
  WD010108: { x: 1175, y: 180, zone: 4, type: "WD" }, // 主巷道右中
  WD010109: { x: 1205, y: 180, zone: 4, type: "WD" }, // 主巷道右下
  WD010110: { x: 1235, y: 255, zone: 4, type: "WD" }, // 延伸段（与T010401共位）
  WD010111: { x: 1265, y: 255, zone: 4, type: "WD" }, // 延伸段

  // ====== 中部区域 (1个) ======
  WD010201: { x: 1055, y: 415, zone: 3, type: "WD" }, // L分支交叉

  // ====== L形分支区域 (2个) ======
  WD010301: { x: 1425, y: 425, zone: 5, type: "WD" }, // L分支水平段
  WD010302: { x: 1055, y: 385, zone: 5, type: "WD" }, // L分支上部

  // ====== 底部区域 (2个) ======
  WD010401: { x: 1255, y: 465, zone: 5, type: "WD" }, // 底部巷道左
  WD010501: { x: 1485, y: 465, zone: 5, type: "WD" }, // 底部巷道右
};

/**
 * FS传感器位置 (风速) - 共7个
 */
export const FS_SENSOR_POSITIONS: Record<string, SensorPosition> = {
  // ====== 上部进风区域 (3个) ======
  FS010103: { x: 545, y: 255, zone: 2, type: "FS" }, // 垂直连接入口
  FS010104: { x: 1055, y: 315, zone: 3, type: "FS" }, // L分支入口
  FS010105: { x: 1175, y: 325, zone: 3, type: "FS" }, // L分支交叉

  // ====== 中部回风区域 (2个) ======
  FS010201: { x: 1145, y: 305, zone: 3, type: "FS" }, // L分支竖直
  FS010202: { x: 1145, y: 335, zone: 3, type: "FS" }, // L分支竖直下

  // ====== L形分支区域 (2个) ======
  FS010301: { x: 1315, y: 505, zone: 5, type: "FS" }, // 底部巷道中
  FS010302: { x: 1375, y: 505, zone: 5, type: "FS" }, // 底部巷道右
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

// 获取传感器总数
export function getSensorCount(): { t: number; wd: number; fs: number; total: number } {
  const t = Object.keys(T_SENSOR_POSITIONS).length;
  const wd = Object.keys(WD_SENSOR_POSITIONS).length;
  const fs = Object.keys(FS_SENSOR_POSITIONS).length;
  return { t, wd, fs, total: t + wd + fs };
}

/**
 * 巷道路径定义 - 基于 drawio 坐标
 */
export const TUNNEL_PATHS = {
  // 主进风巷 (顶部水平)
  mainIntake: {
    x: 80,
    y: 200,
    width: 1520,
    height: 10,
  },
  // 主回风巷 (中部水平)
  mainReturn: {
    x: 0,
    y: 280,
    width: 1600,
    height: 10,
  },
  // 下部巷道
  lowerTunnel: {
    x: 100,
    y: 360,
    width: 1500,
    height: 10,
  },
  // L形分支竖直段
  lBranchVertical: {
    x: 1120,
    y: 210,
    width: 11,
    height: 150,
  },
  // L形分支底部水平段
  lBranchHorizontal: {
    x: 1160,
    y: 480,
    width: 440,
    height: 10,
  },
};

/**
 * 工作面定义 - 基于 drawio 的 polygon
 */
export const WORKING_FACES = [
  // 工作面1 (左上)
  { points: "10,280 80,210 90,210 20,280", zone: 1 },
  // 工作面2
  { points: "160,280 230,210 240,210 170,280", zone: 1 },
  // 工作面3
  { points: "350,320 380,290 390,290 360,320", zone: 2 },
  // 工作面4 (U形上部)
  { points: "520,290 440,290 440,320 530,320", zone: 2 },
  // 工作面5 (斜向)
  { points: "970,360 920,290 930,290 980,360", zone: 3 },
  // L形工作面
  { points: "1160,400 1190,370 1200,370 1170,400", zone: 5 },
];
