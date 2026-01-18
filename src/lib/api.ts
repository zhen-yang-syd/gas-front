const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";

/**
 * API 请求封装
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// 传感器配置类型
export interface SensorConfig {
  configured: {
    T: string[];
    WD: string[];
    FS: string[];
  };
  available: {
    T: string[];
    WD: string[];
    FS: string[];
  };
}

// Control API
export const controlApi = {
  start: () => request<{ status: string }>("/api/control/start", { method: "POST" }),
  stop: () => request<{ status: string }>("/api/control/stop", { method: "POST" }),
  reset: () => request<{ status: string }>("/api/control/reset", { method: "POST" }),
  setFrequency: (freq: number) =>
    request<{ status: string; frequency: number }>("/api/control/frequency", {
      method: "PUT",
      body: JSON.stringify({ freq }),
    }),
  getStatus: () =>
    request<{
      is_running: boolean;
      frequency: number;
      current_index: number;
      total_rows: number;
      progress: number;
    }>("/api/control/status"),
  getSensors: () => request<SensorConfig>("/api/control/sensors"),
};

// 相关性结果类型
interface CorrelationTypeResult {
  total_pairs: number;
  by_strength: Record<string, number>;
  avg_r: number;
  max_r: number;
  results: Array<{
    sensor1: string;
    sensor2: string;
    r_value: number;
    p_value: number;
    strength: string;
    is_significant: boolean;
  }>;
}

// 有效性验证结果类型
interface ValidityResult {
  cronbach_alpha: {
    value: number;
    threshold: number;
    passed: boolean;
    interpretation: string;
  };
  kmo: {
    value: number;
    threshold: number;
    passed: boolean;
    interpretation: string;
    msa_per_variable: Record<string, number>;
  };
  bartlett: {
    chi_square: number;
    p_value: number;
    df: number;
    threshold: number;
    passed: boolean;
  };
  overall_valid: boolean;
  sensor_count: number;
  sample_size: number;
  timestamp: string;
}

// Analysis API
export const analysisApi = {
  getCorrelation: () =>
    request<{
      correlations: {
        "T-T": CorrelationTypeResult;
        "T-WD": CorrelationTypeResult;
        "T-FS": CorrelationTypeResult;
      };
      data_sizes?: Record<string, number>;
      validity?: Record<string, ValidityResult>;
      blocked_types?: string[];
      validity_warning?: string;
      timestamp: string;
      error?: string;
    }>("/api/analysis/correlation"),

  getFsv: () =>
    request<{
      round1_pairs: [string, string][];
      round2_pairs: [string, string][];
      verified_pairs: [string, string][];
      dropped_pairs: [string, string][];
      verification_rate: number;
      timestamp: string;
    }>("/api/analysis/fsv"),

  getBubbleWall: () =>
    request<{
      bubbles: Array<{
        sensor_pair: string[];
        cav: number;
        type: string;           // T-T, T-WD, T-FS
        type_color: string;     // 类型颜色
        ulv: number;
        llv: number;
        is_pair_dynamic: boolean;
        pair_history_count: number;
        radius: number;
        status: string;
        status_cn: string;
        color: string;
        label: string;
      }>;
      summary: {
        total: number;
        by_status: Record<string, number>;
        by_type: Record<string, number>;  // T-T, T-WD, T-FS 各多少个
        warning_count: number;
        abnormal_count: number;
        normal_count: number;
      };
      global_thresholds: {
        ulv: number;
        llv: number;
        default_ulv: number;
        default_llv: number;
        is_dynamic: boolean;
        is_using_dynamic: boolean;
        total_history: number;
        dynamic_pairs: number;
        total_pairs: number;
        min_samples_per_pair: number;
      };
    }>("/api/analysis/bubble-wall"),

  getCav: () =>
    request<{
      cav: { cav: number; max: number; min: number; mean: number };
      calv: number;
      alert: { is_alert: boolean; level: string };
      timestamp: string;
    }>("/api/analysis/cav"),

  getPrediction: (sensorId: string) =>
    request<{
      sensor_id: string;
      history: number[];
      prediction: number[];
      confidence: number;
      trend: "rising" | "falling" | "stable";
      timestamps: { history: string[]; prediction: string[] };
      upper_bound?: number[];  // 95% 置信区间上界
      lower_bound?: number[];  // 95% 置信区间下界
      error_std?: number;      // 预测误差标准差
      error?: string;
    }>(`/api/analysis/prediction/${sensorId}`),

  getAlertHistory: () =>
    request<{
      alerts: Array<{
        type: string;
        sensor: string;
        value: number;
        timestamp: string;
      }>;
      total_count: number;
    }>("/api/analysis/alerts/history"),
};

// Health check
export const healthCheck = () =>
  request<{ status: string }>("/health");
