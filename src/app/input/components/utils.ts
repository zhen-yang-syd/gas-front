// 格式化数值（保留3位小数，去除尾部0）
export function formatValue(value: number | null): string {
  if (value === null || isNaN(value)) return '-';
  return value.toFixed(3).replace(/\.?0+$/, '');
}

// 根据值判断传感器状态（阈值只适用于T开头的传感器）
export function getSensorStatus(
  value: number | null,
  sensorName: string
): 'normal' | 'warning' | 'danger' | 'no-data' {
  if (value === null || isNaN(value)) return 'no-data';

  // FS和WD开头的传感器不使用阈值，始终显示为正常
  if (sensorName.startsWith('FS') || sensorName.startsWith('WD')) {
    return 'normal';
  }

  // T开头的传感器使用阈值判断
  if (value > 1.0) return 'danger';
  if (value > 0.8) return 'warning';
  return 'normal';
}

// 获取状态文本
export function getStatusText(
  status: 'normal' | 'warning' | 'danger' | 'no-data'
): string {
  switch (status) {
    case 'normal':
      return '正常';
    case 'warning':
      return '预警';
    case 'danger':
      return '告警';
    case 'no-data':
      return '无数据';
  }
}

// 获取状态颜色类
export function getStatusColorClass(
  status: 'normal' | 'warning' | 'danger' | 'no-data'
): string {
  switch (status) {
    case 'normal':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'danger':
      return 'bg-red-500';
    case 'no-data':
      return 'bg-gray-600';
  }
}

// 格式化运行时间（秒 -> HH:MM:SS）
export function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 格式化系统时间
export function formatSystemTime(date: Date = new Date()): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
