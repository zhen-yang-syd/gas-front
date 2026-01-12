import { RowRecord, ParsedData } from "./types";
import { formatSystemTime } from "./utils";

export type SchedulerCallback = (record: RowRecord) => void;
export type SchedulerBatchCallback = (records: RowRecord[]) => void;

// 每个tick最多输出的行数，防止卡顿
const MAX_BATCH_PER_TICK = 200;

export class DataScheduler {
  private parsedData: ParsedData | null = null;
  private callback: SchedulerCallback | null = null;
  private batchCallback: SchedulerBatchCallback | null = null;
  private currentFileIndex = 0;
  private currentRowIndex = 0;
  private globalIndex = 0; // 全局行索引（跨文件）
  private ratePerMinute = 1;
  private nextRatePerMinute: number | null = null; // 下一个要切换的频率
  private rateSwitchTime: number = 0; // 频率切换的时间点（下一个完整分钟）
  private timeoutId: number | null = null;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private startTime: number = 0; // 开始时间戳（用于运行时间计算）
  private lastTickTime: number = 0; // 上次tick的时间戳
  private accumulator: number = 0; // 累积应输出的条数

  // 设置数据
  setData(data: ParsedData) {
    this.parsedData = data;
  }

  // 设置回调
  setCallback(callback: SchedulerCallback) {
    this.callback = callback;
  }

  // 设置批量回调（用于快速批量更新）
  setBatchCallback(callback: SchedulerBatchCallback) {
    this.batchCallback = callback;
  }

  // 设置更新频率（条/分）
  setRatePerMinute(rate: number) {
    if (rate <= 0) return;

    if (!this.isRunning || this.startTime === 0) {
      // 如果还没开始运行，直接设置频率
      this.ratePerMinute = rate;
      return;
    }

    // 如果正在运行，计算下一个完整分钟的时间点
    const now = Date.now();
    const runtimeSeconds = (now - this.startTime) / 1000;
    const currentMinute = Math.floor(runtimeSeconds / 60);
    const nextMinuteStart = (currentMinute + 1) * 60; // 下一个完整分钟的秒数
    const nextMinuteTime = this.startTime + nextMinuteStart * 1000; // 下一个完整分钟的时间戳

    // 保存下一个频率和切换时间
    this.nextRatePerMinute = rate;
    this.rateSwitchTime = nextMinuteTime;
  }

  // 获取当前全局索引
  getCurrentIndex(): number {
    return this.globalIndex;
  }

  // 获取总行数
  getTotalRows(): number {
    return this.parsedData?.totalRows || 0;
  }

  // 获取运行时间（秒）
  getRuntime(): number {
    if (!this.isRunning || this.startTime === 0) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  // 跳转到指定全局索引（下一次读取将从该索引开始）
  jumpToIndex(targetIndex: number) {
    if (!this.parsedData) return;

    const totalRows = this.parsedData.totalRows;
    if (targetIndex < 0 || targetIndex > totalRows) return;

    // 如果跳转到最后，直接设置完成状态
    if (targetIndex >= totalRows) {
      this.currentFileIndex = this.parsedData.files.length;
      this.currentRowIndex = 0;
      this.globalIndex = totalRows;
      return;
    }

    // 计算目标在哪个文件的哪一行
    let accumulatedRows = 0;
    let fileIndex = 0;
    let rowIndex = 0;

    for (let i = 0; i < this.parsedData.files.length; i++) {
      const fileRows = this.parsedData.files[i].rows.length;
      if (targetIndex < accumulatedRows + fileRows) {
        fileIndex = i;
        rowIndex = targetIndex - accumulatedRows;
        break;
      }
      accumulatedRows += fileRows;
    }

    this.currentFileIndex = fileIndex;
    this.currentRowIndex = rowIndex;
    this.globalIndex = targetIndex;
  }

  // 读取下一行
  private readNextRow(): RowRecord | null {
    if (!this.parsedData) return null;

    // 检查是否已读完所有文件
    if (this.currentFileIndex >= this.parsedData.files.length) {
      return null;
    }

    const currentFile = this.parsedData.files[this.currentFileIndex];

    // 检查当前文件是否读完
    if (this.currentRowIndex >= currentFile.rows.length) {
      // 移动到下一个文件
      this.currentFileIndex++;
      this.currentRowIndex = 0;

      // 再次检查
      if (this.currentFileIndex >= this.parsedData.files.length) {
        return null;
      }
    }

    const row = currentFile.rows[this.currentRowIndex];
    const sensors: Record<string, number | null> = {};

    // 解析传感器值
    currentFile.headers.forEach((header) => {
      const value = row[header];
      if (value === null || value === undefined || value === "") {
        sensors[header] = null;
      } else {
        const numValue = parseFloat(value);
        sensors[header] = isNaN(numValue) ? null : numValue;
      }
    });

    const record: RowRecord = {
      timestamp: formatSystemTime(),
      sensors,
    };

    // 更新索引
    this.currentRowIndex++;
    this.globalIndex++;

    return record;
  }

  // 主调度循环（使用requestAnimationFrame实现平滑输出）
  private tick() {
    if (!this.isRunning) return;

    const now = Date.now();

    // 如果这是第一次tick，立即输出第一条数据，然后初始化时间
    if (this.lastTickTime === 0) {
      // 启动时只输出第一条，然后按频率继续更新
      const record = this.readNextRow();
      if (record) {
        if (this.callback) {
          this.callback(record);
        }
      } else {
        this.isRunning = false;
        return;
      }

      this.lastTickTime = now;
      // 继续下一帧
      this.animationFrameId = requestAnimationFrame(() => this.tick());
      return;
    }

    // 检查是否需要切换频率（等到下一个完整分钟）
    if (this.nextRatePerMinute !== null && now >= this.rateSwitchTime) {
      // 切换到新频率
      this.ratePerMinute = this.nextRatePerMinute;
      this.nextRatePerMinute = null;
      this.rateSwitchTime = 0;
    }

    // 计算时间差（毫秒）
    const dt = now - this.lastTickTime;
    this.lastTickTime = now;

    // 累积应输出的条数
    // accumulator += dt * ratePerMinute / 60000
    this.accumulator += (dt / 60000) * this.ratePerMinute;

    // 当accumulator >= 1时，输出数据
    // 使用循环确保所有应该输出的数据都被输出
    while (this.accumulator >= 1 && this.isRunning) {
      // 计算本次要输出的条数
      const k = Math.min(Math.floor(this.accumulator), MAX_BATCH_PER_TICK);

      if (k <= 0) break;

      // 读取k行数据
      const records: RowRecord[] = [];
      for (let i = 0; i < k; i++) {
        if (!this.isRunning) break;

        const record = this.readNextRow();
        if (!record) {
          this.isRunning = false;
          break;
        }
        records.push(record);
      }

      // 批量更新
      if (records.length > 0) {
        if (this.batchCallback) {
          // 使用批量回调，一次性更新所有数据
          this.batchCallback(records);
        } else if (this.callback) {
          // 如果没有批量回调，逐条调用（兼容旧方式）
          records.forEach((record) => this.callback!(record));
        }

        // 减少accumulator
        this.accumulator -= records.length;
      } else {
        break;
      }

      // 如果还有数据要输出但已经达到MAX_BATCH_PER_TICK，使用时间片让出控制权
      if (this.accumulator >= 1 && records.length >= MAX_BATCH_PER_TICK) {
        // 让出控制权，下一帧继续处理
        this.animationFrameId = requestAnimationFrame(() => this.tick());
        return;
      }
    }

    // 继续下一帧
    this.animationFrameId = requestAnimationFrame(() => this.tick());
  }

  // 开始
  start() {
    if (this.isRunning) return;
    if (!this.parsedData) return;

    // 如果已经完成，需要重置才能重新开始
    if (this.currentFileIndex >= this.parsedData.files.length) {
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.lastTickTime = 0; // 重置，让第一次tick初始化
    this.accumulator = 0; // 重置accumulator
    this.nextRatePerMinute = null; // 重置下一个频率
    this.rateSwitchTime = 0; // 重置切换时间
    this.tick(); // 开始tick循环
  }

  // 停止
  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // 重置
  reset() {
    this.stop();
    this.currentFileIndex = 0;
    this.currentRowIndex = 0;
    this.globalIndex = 0;
    this.startTime = 0;
    this.lastTickTime = 0;
    this.accumulator = 0;
    this.nextRatePerMinute = null;
    this.rateSwitchTime = 0;
  }

  // 是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }

  // 是否已完成
  isCompleted(): boolean {
    if (!this.parsedData) return false;
    return this.globalIndex >= this.parsedData.totalRows;
  }
}
