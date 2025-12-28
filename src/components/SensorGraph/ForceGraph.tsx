"use client";

import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  type: "T" | "WD" | "FS";
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  r: number;
  strength: string;
  linkType: "T-T" | "T-WD" | "T-FS";
}

interface ForceGraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  title?: string;
}

// 连线颜色
const LINK_COLORS: Record<string, string> = {
  "T-T": "#00CED1",   // 青色 - Gas-Gas
  "T-WD": "#4169E1",  // 蓝色 - Gas-Temp
  "T-FS": "#2F4F4F",  // 藏青色 - Gas-Wind
};

// 节点颜色
const NODE_COLORS: Record<string, string> = {
  T: "#3B82F6",
  WD: "#10B981",
  FS: "#F59E0B",
};

// 连线粗细
function getStrokeWidth(strength: string): number {
  switch (strength) {
    case "great":
      return 4;
    case "very_good":
      return 3;
    case "good":
      return 2;
    case "fair":
      return 1;
    default:
      return 0.5;
  }
}

/**
 * D3.js 力导向图组件
 *
 * 显示传感器之间的相关性关系
 * - 节点: 传感器
 * - 连线: 相关性 (粗细=强度, 颜色=类型)
 */
export function ForceGraph({
  nodes,
  links,
  width = 280,
  height = 250,
  title,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // 克隆数据以避免D3修改原始数据
  const graphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    };
  }, [nodes, links]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);

    // 清除旧内容
    svg.selectAll("*").remove();

    // 创建容器
    const container = svg.append("g");

    // 创建力模拟
    const simulation = d3
      .forceSimulation(graphData.nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(graphData.links)
          .id((d: any) => d.id)
          .distance(50)
      )
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(20));

    // 创建连线
    const link = container
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d: any) => LINK_COLORS[d.linkType] || "#666")
      .attr("stroke-width", (d: any) => getStrokeWidth(d.strength))
      .attr("stroke-opacity", 0.7);

    // 创建节点容器
    const node = container
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .attr("class", "node")
      .call(
        d3
          .drag<SVGGElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // 节点圆圈
    node
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d: Node) => NODE_COLORS[d.type] || "#666")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // 节点标签
    node
      .append("text")
      .attr("dy", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "7px")
      .attr("fill", "#94A3B8")
      .text((d: Node) =>
        d.id.replace("T0", "T").replace("WD0", "W").replace("FS0", "F")
      );

    // 更新位置
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // 缩放
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // 清理
    return () => {
      simulation.stop();
    };
  }, [graphData, width, height]);

  return (
    <div className="force-graph-container">
      {title && (
        <div className="text-xs text-slate-400 mb-1 text-center">{title}</div>
      )}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-slate-900 rounded border border-slate-700"
      />
      {/* 图例 */}
      <div className="flex justify-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-1 rounded"
            style={{ backgroundColor: LINK_COLORS["T-T"] }}
          />
          T-T
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-1 rounded"
            style={{ backgroundColor: LINK_COLORS["T-WD"] }}
          />
          T-WD
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-1 rounded"
            style={{ backgroundColor: LINK_COLORS["T-FS"] }}
          />
          T-FS
        </span>
      </div>
    </div>
  );
}

export default ForceGraph;
