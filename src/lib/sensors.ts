/**
 * 传感器配置 - 基于文档定义的传感器对照表
 *
 * 数据来源: intro.md 四、数据说明
 */

// ============================================
// T传感器 (瓦斯浓度) - 21个
// ============================================
export const T_SENSOR_MAP: Record<string, string> = {
  T010101: "T1",   // Three mining total wind-back alley T
  T010102: "T2",   // Three mining auxiliary wind-back alley T
  T010103: "T3",   // Three mining east wing wind-back alley T
  T010104: "T4",   // Three mining emergency shelter Back transition room T
  T010105: "T5",   // Three mining emergency shelter front transition room T
  T010106: "T6",   // Three mining emergency refuge survival room T
  T010201: "T7",   // Four mining water bin working face T
  T010202: "T8",   // Four mining water bin wind-back alley T
  T010203: "T9",   // Four mining water bin air vent T
  T010204: "T10",  // Four mining water bin fan front T
  T010205: "T11",  // Four mining water bin mixing T
  T010301: "T12",  // Four mining trackway 500 m refuge chambers T
  T010302: "T13",  // Four mining trackway air vent T
  T010303: "T14",  // Four mining trackway fan front T
  T010304: "T15",  // Four mining trackway working face T
  T010305: "T16",  // Four mining trackway wind-back alley T
  T010306: "T17",  // Four mining trackway mixing T
  T010307: "T18",  // Four mining trackway middle T
  T010308: "T19",  // Four mining trackway downwind side of the rig T
  T010401: "T20",  // Four mining north wing wind-back alley T
  T010501: "T21",  // Four mining belt lanes coal bin T
};

// ============================================
// WD传感器 (温度) - 16个
// ============================================
export const WD_SENSOR_MAP: Record<string, string> = {
  WD010101: "WD1",   // Three mining Total wind-back alley WD
  WD010102: "WD2",   // Three mining auxiliary wind-back alley WD
  WD010103: "WD3",   // Three mining East Wing wind-back alley WD
  WD010104: "WD4",   // Three mining Emergency Shelter Back Transition Room WD
  WD010105: "WD5",   // Three mining Emergency Shelter Front Transition Room WD
  WD010106: "WD6",   // Three mining Emergency Refuge Survival Room WD
  WD010107: "WD7",   // Three mining trackway winch house WD
  WD010108: "WD8",   // Three mining waiting room WD
  WD010109: "WD9",   // Three mining Infinity rope WD
  WD010110: "WD10",  // Three mining substation WD
  WD010111: "WD11",  // Three mining belt lanes WD
  WD010201: "WD12",  // Four mining water bin wind-back alley WD
  WD010301: "WD13",  // Four mining trackway 500 m Refuge Chambers WD
  WD010302: "WD14",  // Four mining trackway wind-back alley WD
  WD010401: "WD15",  // Four mining North Wing wind-back alley WD
  WD010501: "WD16",  // Four mining Infinity rope Refuge Chambers WD
};

// ============================================
// FS传感器 (风速) - 10个
// ============================================
export const FS_SENSOR_MAP: Record<string, string> = {
  FS010101: "FS1",   // Three mining Total wind-back alley FS
  FS010102: "FS2",   // Three mining auxiliary wind-back alley FS
  FS010103: "FS3",   // Three mining East Wing wind-back alley FS
  FS010104: "FS4",   // Three mining trackway middle FS
  FS010105: "FS5",   // Three mining West Wing Orbital Lane Belt Lane Duplex Lane FS
  FS010201: "FS6",   // Four mining water bin air vent FS
  FS010202: "FS7",   // Four mining water bin wind-back alley FS
  FS010301: "FS8",   // Four mining trackway air vent FS
  FS010302: "FS9",   // Four mining trackway wind-back alley FS
  FS010401: "FS10",  // Four mining North Wing wind-back alley FS
};

// ============================================
// 合并所有传感器映射
// ============================================
export const ALL_SENSOR_MAP: Record<string, string> = {
  ...T_SENSOR_MAP,
  ...WD_SENSOR_MAP,
  ...FS_SENSOR_MAP,
};

// 反向映射 (简称 -> 编码)
export const LABEL_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_SENSOR_MAP).map(([code, label]) => [label, code])
);

// ============================================
// 传感器编码列表
// ============================================
export const T_SENSORS = Object.keys(T_SENSOR_MAP);
export const WD_SENSORS = Object.keys(WD_SENSOR_MAP);
export const FS_SENSORS = Object.keys(FS_SENSOR_MAP);
export const ALL_SENSORS = [...T_SENSORS, ...WD_SENSORS, ...FS_SENSORS];

// ============================================
// 工具函数
// ============================================

/**
 * 获取传感器简称
 * @param code 传感器编码 (如 T010101)
 * @returns 简称 (如 T1)，如果找不到则返回原编码
 */
export function getSensorLabel(code: string): string {
  return ALL_SENSOR_MAP[code] || code;
}

/**
 * 获取传感器编码
 * @param label 传感器简称 (如 T1)
 * @returns 编码 (如 T010101)，如果找不到则返回原简称
 */
export function getSensorCode(label: string): string {
  return LABEL_TO_CODE[label] || label;
}

/**
 * 获取传感器类型
 * @param code 传感器编码或简称
 * @returns 类型 "T" | "WD" | "FS"
 */
export function getSensorType(code: string): "T" | "WD" | "FS" {
  if (code.startsWith("T")) return "T";
  if (code.startsWith("WD")) return "WD";
  if (code.startsWith("FS")) return "FS";
  return "T"; // 默认
}

/**
 * 格式化传感器对标签
 * @param sensor1 传感器1编码
 * @param sensor2 传感器2编码
 * @returns 格式化的标签 (如 "T1-WD3")
 */
export function formatSensorPairLabel(sensor1: string, sensor2: string): string {
  return `${getSensorLabel(sensor1)}-${getSensorLabel(sensor2)}`;
}

/**
 * 传感器数量统计
 */
export const SENSOR_COUNTS = {
  T: T_SENSORS.length,   // 21
  WD: WD_SENSORS.length, // 16
  FS: FS_SENSORS.length, // 10
  total: ALL_SENSORS.length, // 47
};
