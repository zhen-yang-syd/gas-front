"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { DxfGeometry, parseDxfFile } from "./dxfParser";

interface DxfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ViewState {
  userScale: number;
  rotationRad: number;
  offsetX: number;
  offsetY: number;
}

export const DxfPreviewModal: React.FC<DxfPreviewModalProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [geometry, setGeometry] = useState<DxfGeometry | null>(null);
  const [status, setStatus] = useState<string>("请选择 DXF 文件");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const [viewState, setViewState] = useState<ViewState>({
    userScale: 1,
    rotationRad: 0,
    offsetX: 0,
    offsetY: 0,
  });

  // 拖拽状态
  const [isPanning, setIsPanning] = useState(false);
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

  // 调整 Canvas 尺寸
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  // 渲染几何图形
  const renderGeometry = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geometry) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { lines, polylines, bbox } = geometry;
    if (!bbox) {
      setStatus("无法计算边界框");
      setIsError(true);
      return;
    }

    const dx = bbox.maxX - bbox.minX || 1;
    const dy = bbox.maxY - bbox.minY || 1;

    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;

    const padding = 40;
    const vw = canvas.width - padding * 2;
    const vh = canvas.height - padding * 2;

    const baseScale = Math.min(vw / dx, vh / dy);
    const scale = baseScale * viewState.userScale;

    const cosA = Math.cos(viewState.rotationRad);
    const sinA = Math.sin(viewState.rotationRad);

    // 坐标转换函数
    const toScreen = (p: { x: number; y: number }) => {
      const mx = (p.x - centerX) * scale;
      const my = (p.y - centerY) * scale;

      const rx = mx * cosA - my * sinA;
      const ry = mx * sinA + my * cosA;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      return {
        x: cx + rx + viewState.offsetX,
        y: cy - ry + viewState.offsetY,
      };
    };

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#22c55e";

    // 绘制线段
    lines.forEach((l) => {
      const s = toScreen(l.start);
      const e = toScreen(l.end);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    });

    // 绘制折线
    polylines.forEach((p) => {
      if (!p.points || p.points.length < 2) return;
      ctx.beginPath();
      const first = toScreen(p.points[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < p.points.length; i++) {
        const pt = toScreen(p.points[i]);
        ctx.lineTo(pt.x, pt.y);
      }
      if (p.isClosed) {
        ctx.closePath();
      }
      ctx.stroke();
    });

    setStatus(`渲染完成：线段 ${lines.length}，折线 ${polylines.length}`);
    setIsError(false);
  }, [geometry, viewState]);

  // 监听窗口大小变化
  useEffect(() => {
    if (!isOpen) return;

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [isOpen, resizeCanvas]);

  // 几何数据或视图状态变化时重新渲染
  useEffect(() => {
    if (isOpen && geometry) {
      resizeCanvas();
      renderGeometry();
    }
  }, [isOpen, geometry, viewState, resizeCanvas, renderGeometry]);

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setStatus("正在解析 DXF 文件...");
    setIsError(false);

    try {
      const geo = await parseDxfFile(file);
      setGeometry(geo);
      setViewState({ userScale: 1, rotationRad: 0, offsetX: 0, offsetY: 0 });
    } catch (err) {
      console.error("DXF 解析失败:", err);
      setStatus("DXF 解析失败，请检查文件格式");
      setIsError(true);
      setGeometry(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 旋转
  const handleRotateLeft = () => {
    setViewState((prev) => ({ ...prev, rotationRad: prev.rotationRad - Math.PI / 12 }));
  };

  const handleRotateRight = () => {
    setViewState((prev) => ({ ...prev, rotationRad: prev.rotationRad + Math.PI / 12 }));
  };

  // 重置视图
  const handleResetView = () => {
    setViewState({ userScale: 1, rotationRad: 0, offsetX: 0, offsetY: 0 });
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!geometry) return;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setViewState((prev) => ({
      ...prev,
      userScale: prev.userScale * zoomFactor,
    }));
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!geometry) return;
    setIsPanning(true);
    setLastPan({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPan.x;
    const dy = e.clientY - lastPan.y;
    setLastPan({ x: e.clientX, y: e.clientY });
    setViewState((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface border border-edge rounded-lg w-[90vw] h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-accent">巷道图预览</h2>
            {fileName && <span className="text-xs text-dim font-mono">{fileName}</span>}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".dxf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="industrial-btn text-xs px-3 py-1.5"
            >
              {isLoading ? "解析中..." : "选择文件"}
            </button>
            <button
              onClick={handleRotateLeft}
              disabled={!geometry}
              className="industrial-btn text-xs px-3 py-1.5"
            >
              左旋
            </button>
            <button
              onClick={handleRotateRight}
              disabled={!geometry}
              className="industrial-btn text-xs px-3 py-1.5"
            >
              右旋
            </button>
            <button
              onClick={handleResetView}
              disabled={!geometry}
              className="industrial-btn text-xs px-3 py-1.5"
            >
              重置
            </button>
            <button
              onClick={onClose}
              className="industrial-btn text-xs px-3 py-1.5 hover:border-red-500 hover:text-red-400"
            >
              关闭
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-slate-950"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isPanning ? "grabbing" : geometry ? "grab" : "default" }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ background: "radial-gradient(circle at top left, #1e293b, #020617)" }}
          />
          {!geometry && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-dim">
                <div className="text-lg mb-2">请选择 DXF 文件</div>
                <div className="text-xs">支持 .dxf 格式的 CAD 巷道图</div>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex items-center gap-2 text-accent">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span>解析中...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="px-4 py-2 border-t border-edge">
          <span className={`text-xs ${isError ? "text-red-400" : "text-dim"}`}>{status}</span>
          {geometry && (
            <span className="text-xs text-dim ml-4">
              滚轮缩放 | 拖拽平移 | 按钮旋转
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
