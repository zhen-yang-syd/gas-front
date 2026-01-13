/**
 * Control API Client
 *
 * 控制后端数据生成器的API客户端
 * 用于统一Input页面和Main页面的数据控制
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ControlStatus {
  is_running: boolean;
  frequency: number;
  rate_per_minute: number;
  current_index: number;
  total_rows: number;
  progress: number;
  datasets: {
    gas_gas: { total: number; current: number; progress: number };
    gas_wd: { total: number; current: number; progress: number };
    gas_fs: { total: number; current: number; progress: number };
  };
}

export const controlApi = {
  /**
   * 启动数据流
   */
  start: async (): Promise<{ status: string; frequency: number }> => {
    const res = await fetch(`${API_BASE}/api/control/start`, { method: "POST" });
    return res.json();
  },

  /**
   * 停止数据流
   */
  stop: async (): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/api/control/stop`, { method: "POST" });
    return res.json();
  },

  /**
   * 重置到数据开始位置
   */
  reset: async (): Promise<{ status: string; index: number }> => {
    const res = await fetch(`${API_BASE}/api/control/reset`, { method: "POST" });
    return res.json();
  },

  /**
   * 设置每分钟推送条数（前端单位）
   */
  setRatePerMinute: async (
    rate: number
  ): Promise<{ status: string; rate_per_minute: number; frequency: number }> => {
    const res = await fetch(`${API_BASE}/api/control/rate-per-minute`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate }),
    });
    return res.json();
  },

  /**
   * 设置每秒推送条数（后端单位）
   */
  setFrequency: async (
    freq: number
  ): Promise<{ status: string; frequency: number }> => {
    const res = await fetch(`${API_BASE}/api/control/frequency`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freq }),
    });
    return res.json();
  },

  /**
   * 跳转到指定索引
   */
  seek: async (
    index: number
  ): Promise<{ status: string; index: number } | { error: string }> => {
    const res = await fetch(`${API_BASE}/api/control/seek/${index}`, {
      method: "PUT",
    });
    return res.json();
  },

  /**
   * 获取当前状态
   */
  getStatus: async (): Promise<ControlStatus> => {
    const res = await fetch(`${API_BASE}/api/control/status`);
    return res.json();
  },
};
