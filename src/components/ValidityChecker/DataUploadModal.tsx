"use client";

import { useState, useRef, useCallback } from "react";
import type { ValidityResult } from "./ValidityCheckerPanel";

type DataType = "T-T" | "T-WD" | "T-FS";

interface DataUploadModalProps {
  apiBaseUrl: string;
  onClose: () => void;
  onComplete: (result: ValidityResult) => void;
}

const DATA_TYPE_OPTIONS: { value: DataType; label: string; description: string }[] = [
  { value: "T-T", label: "T-T (Gas-Gas)", description: "瓦斯传感器间相关性" },
  { value: "T-WD", label: "T-WD (Gas-温度)", description: "瓦斯与温度相关性" },
  { value: "T-FS", label: "T-FS (Gas-风速)", description: "瓦斯与风速相关性" },
];

export function DataUploadModal({
  apiBaseUrl,
  onClose,
  onComplete,
}: DataUploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<DataType>("T-T");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);

      try {
        // 读取文件内容
        const content = await file.text();

        // 确定文件类型
        const fileType = file.name.endsWith(".json") ? "json" : "csv";

        // 发送到 API（包含 data_type）
        const response = await fetch(`${apiBaseUrl}/validity/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_content: content,
            file_type: fileType,
            data_type: selectedDataType,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
          setError(result.error);
        } else {
          onComplete(result);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to upload and validate file"
        );
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, onComplete, selectedDataType]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 w-full max-w-lg mx-4">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-200">
            上传数据进行有效性验证
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            x
          </button>
        </div>

        {/* 数据类型选择 */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">
            选择数据类型
          </label>
          <div className="flex gap-2">
            {DATA_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedDataType(option.value)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  selectedDataType === option.value
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs opacity-75 mt-0.5">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 说明 */}
        <div className="text-sm text-slate-400 mb-4">
          支持格式: CSV, JSON
        </div>

        {/* 上传区域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-slate-600 hover:border-slate-500"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {loading ? (
            <div className="text-slate-400">
              <span className="animate-pulse">验证中...</span>
            </div>
          ) : (
            <>
              <div className="text-slate-300 mb-2">
                拖拽文件到此处，或点击选择文件
              </div>
              <div className="text-xs text-slate-500">
                支持 .csv 或 .json 格式
              </div>
            </>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 格式说明 */}
        <div className="mt-4 text-xs text-slate-500">
          <div className="font-medium text-slate-400 mb-2">CSV 格式要求:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>第一行为表头 (传感器ID)</li>
            <li>每行为一个时间点的数据</li>
            <li>最少 30 行数据</li>
          </ul>
        </div>

        {/* 示例 */}
        <div className="mt-4 bg-slate-900 rounded p-3 text-xs font-mono text-slate-400">
          <div>T010101, T010102, T010103, WD010101, FS010103</div>
          <div>0.45, 0.52, 0.48, 25.3, 2.1</div>
          <div>0.47, 0.51, 0.49, 25.4, 2.2</div>
          <div>...</div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataUploadModal;
