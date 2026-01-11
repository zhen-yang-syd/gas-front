// 数据行记录（适配 demo-gas 格式）
export interface RowRecord {
  timestamp: string;
  sensors: Record<string, number | null>;
}

// 告警记录（表格形式）
export interface AlarmRecord {
  id: string;
  time: string;
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
  status: 'normal' | 'warning' | 'danger' | 'no-data';
  lastUpdate: string;
}

// 应用状态
export type AppState = 'stopped' | 'running' | 'completed';

// 系统状态（从API获取）
export interface SystemStatus {
  is_running: boolean;
  frequency: number;
  current_index: number;
  total_rows: number;
  progress: number;
}

// SSE 分析数据格式
export interface SSEAnalysisData {
  timestamp: string;
  index: number;
  correlations: Record<string, unknown>;
  validity: Record<string, unknown>;
  cav: {
    latest: number | null;
    count: number;
  };
  alert: {
    is_alert: boolean;
    cav: number;
    calv: number;
    level: string;
  } | null;
  bubble_wall: Record<string, unknown>;
  sensor_readings: Record<string, number>;
}
