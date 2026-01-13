// 数据行记录
export interface RowRecord {
  index?: number; // 数据索引
  timestamp: string; // 系统时间 YYYY/MM/DD_HH:mm:ss
  sensors: Record<string, number | null>; // 传感器名 -> 值
}

// 告警记录
export interface AlarmRecord {
  id: string;
  time: string; // 系统时间
  sensor: string;
  value: number;
  rule: string;
}

// 预警记录
export interface WarningRecord {
  id: string;
  time: string;
  sensor: string;
  value: number;
  rule: string;
}

// 传感器状态
export interface SensorStatus {
  name: string;
  value: number | null;
  status: "normal" | "warning" | "danger" | "no-data";
  lastUpdate: string;
}

// 应用状态
export type AppState = "stopped" | "running" | "completed";

// CSV文件数据
export interface CSVData {
  headers: string[]; // 传感器列名（不含时间列）
  rows: Array<Record<string, string | null>>; // 每行的传感器数据
}

// 解析后的所有CSV数据
export interface ParsedData {
  files: CSVData[];
  allSensorNames: string[]; // 所有CSV中出现的传感器名（去重）
  totalRows: number; // 总行数
}
