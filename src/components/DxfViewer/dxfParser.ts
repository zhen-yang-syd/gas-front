/**
 * DXF 解析工具函数
 *
 * 从 DXF 文件中提取几何数据用于 Canvas 渲染
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import DxfParser from "dxf-parser";

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  type: "line";
  start: Point;
  end: Point;
  layer?: string;
}

export interface Polyline {
  type: "polyline";
  points: Point[];
  isClosed: boolean;
  layer?: string;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface DxfGeometry {
  lines: Line[];
  polylines: Polyline[];
  bbox: BoundingBox | null;
}

/**
 * 从 DXF 解析结果中提取几何数据
 */
function extractGeometry(dxf: any): DxfGeometry {
  const entities = dxf.entities || [];
  const lines: Line[] = [];
  const polylines: Polyline[] = [];

  for (const e of entities) {
    // LINE: 线段
    if (e.type === "LINE") {
      const start = e.start || e.startPoint;
      const end = e.end || e.endPoint;
      if (!start || !end || typeof start.x !== "number" || typeof end.x !== "number") {
        continue;
      }
      lines.push({
        type: "line",
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        layer: e.layer,
      });
    }
    // LWPOLYLINE: 多段线
    else if (e.type === "LWPOLYLINE" && Array.isArray(e.vertices)) {
      const points = e.vertices
        .filter((v: any) => v && typeof v.x === "number" && typeof v.y === "number")
        .map((v: any) => ({ x: v.x, y: v.y }));
      if (points.length < 2) {
        continue;
      }
      polylines.push({
        type: "polyline",
        points,
        isClosed: !!e.shape || !!e.closed,
        layer: e.layer,
      });
    }
    // POLYLINE: 传统多段线
    else if (e.type === "POLYLINE" && Array.isArray(e.vertices)) {
      const points = e.vertices
        .filter((v: any) => v && typeof v.x === "number" && typeof v.y === "number")
        .map((v: any) => ({ x: v.x, y: v.y }));
      if (points.length < 2) {
        continue;
      }
      polylines.push({
        type: "polyline",
        points,
        isClosed: !!e.shape || !!e.closed,
        layer: e.layer,
      });
    }
  }

  // 计算边界框
  const allPoints = [
    ...lines.flatMap((l) => [l.start, l.end]),
    ...polylines.flatMap((p) => p.points),
  ];

  let bbox: BoundingBox | null = null;
  if (allPoints.length > 0) {
    let minX = allPoints[0].x;
    let maxX = allPoints[0].x;
    let minY = allPoints[0].y;
    let maxY = allPoints[0].y;
    for (const p of allPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    bbox = { minX, maxX, minY, maxY };
  }

  return { lines, polylines, bbox };
}

/**
 * 解析 DXF 文件内容
 *
 * @param content DXF 文件的文本内容
 * @returns 解析后的几何数据
 */
export function parseDxf(content: string): DxfGeometry {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);
  return extractGeometry(dxf);
}

/**
 * 从 File 对象读取并解析 DXF
 *
 * @param file 用户选择的文件
 * @returns Promise<DxfGeometry>
 */
export function parseDxfFile(file: File): Promise<DxfGeometry> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const geometry = parseDxf(content);
        resolve(geometry);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}
