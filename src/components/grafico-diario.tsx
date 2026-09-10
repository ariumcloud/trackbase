"use client";

import React, { useState, useMemo } from "react";
import type { SaleRow, InsightRow } from "@/lib/types";
import { dayInZone } from "@/lib/metrics";
import { isApprovedSaleStatus } from "@/lib/sale-status";
import { Calendar } from "lucide-react";

interface DailyChartProps {
  sales: SaleRow[];
  insights: InsightRow[];
  periodDays: number;
  endDate: string;
  timezone: string;
  currency: string;
}

interface DayData {
  dateStr: string; // YYYY-MM-DD
  label: string;   // DD/MM
  revenue: number;
  spend: number;
  profit: number;
  roas: number | null;
  salesCount: number;
}

export function GraficoDiario({
  sales,
  insights,
  periodDays,
  endDate,
  timezone,
  currency,
}: DailyChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const daysData = useMemo(() => {
    const result: DayData[] = [];
    const periodEnd = new Date(`${endDate}T12:00:00Z`);

    // Generate list of days in ascending order
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(periodEnd);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const parts = dateStr.split("-");
      const label = `${parts[2]}/${parts[1]}`;

      result.push({
        dateStr,
        label,
        revenue: 0,
        spend: 0,
        profit: 0,
        roas: null,
        salesCount: 0,
      });
    }

    const dayMap = new Map<string, DayData>(result.map((item) => [item.dateStr, item]));

    // Aggregate sales
    for (const s of sales) {
      if (s.is_test || !isApprovedSaleStatus(s.status)) continue;
      const sDay = dayInZone(new Date(s.occurred_at), timezone);
      const entry = dayMap.get(sDay);
      if (entry) {
        entry.revenue += Number(s.amount || 0);
        entry.salesCount += 1;
      }
    }

    // Aggregate insights (spend)
    for (const inst of insights) {
      if (inst.currency !== currency) continue;
      const entry = dayMap.get(inst.day);
      if (entry) {
        entry.spend += Number(inst.spend || 0);
      }
    }

    // Calculate profit and roas
    for (const item of result) {
      item.profit = item.revenue - item.spend;
      item.roas = item.spend > 0 ? item.revenue / item.spend : null;
    }

    return result;
  }, [sales, insights, periodDays, endDate, timezone, currency]);

  const maxVal = useMemo(() => {
    let max = 100;
    for (const d of daysData) {
      if (d.revenue > max) max = d.revenue;
      if (d.spend > max) max = d.spend;
      if (Math.abs(d.profit) > max) max = Math.abs(d.profit);
    }
    return max * 1.15; // 15% headroom
  }, [daysData]);

  const totals = useMemo(() => {
    let rev = 0;
    let spd = 0;
    let salesCount = 0;
    for (const d of daysData) {
      rev += d.revenue;
      spd += d.spend;
      salesCount += d.salesCount;
    }
    const prof = rev - spd;
    const roas = spd > 0 ? rev / spd : null;
    return { rev, spd, prof, roas, salesCount };
  }, [daysData]);

  const money = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);

  const chartHeight = 220;
  const paddingBottom = 28;
  const paddingTop = 16;
  const usableHeight = chartHeight - paddingBottom - paddingTop;

  return (
    <div className="panel" style={{ marginTop: "1rem", marginBottom: "1.25rem" }}>
      <div className="panel-heading" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={18} style={{ color: "var(--primary, #5B34EA)" }} />
            <h2 style={{ margin: 0 }}>Evolução Diária de Resultados</h2>
          </div>
          <p style={{ margin: "0.2rem 0 0" }}>
            Receita bruta vs. Investimento em tráfego Meta Ads vs. Lucro real dia a dia
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#5B34EA" }} />
            <span>Receita</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#94A3B8" }} />
            <span>Investimento</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#10B981" }} />
            <span>Lucro Líquido</span>
          </div>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: periodDays > 14 ? "720px" : "100%", height: chartHeight }}>
          <svg
            width="100%"
            height={chartHeight}
            style={{ overflow: "visible" }}
            viewBox={`0 0 ${daysData.length * 50} ${chartHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingTop + usableHeight * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={0}
                  y1={y}
                  x2={daysData.length * 50}
                  y2={y}
                  stroke="var(--line, #E2E8F0)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              );
            })}

            {/* Bars for each day */}
            {daysData.map((d, idx) => {
              const colWidth = 50;
              const barWidth = 10;
              const centerX = idx * colWidth + colWidth / 2;

              const revH = (d.revenue / maxVal) * usableHeight;
              const spdH = (d.spend / maxVal) * usableHeight;
              const profH = (Math.abs(d.profit) / maxVal) * usableHeight;

              const revY = paddingTop + (usableHeight - revH);
              const spdY = paddingTop + (usableHeight - spdH);
              const profY = paddingTop + (usableHeight - profH);

              const isHovered = hoverIndex === idx;

              return (
                <g
                  key={d.dateStr}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Hover background column */}
                  {isHovered && (
                    <rect
                      x={idx * colWidth}
                      y={0}
                      width={colWidth}
                      height={chartHeight - paddingBottom}
                      fill="rgba(91, 52, 234, 0.05)"
                      rx="4"
                    />
                  )}

                  {/* Revenue Bar */}
                  <rect
                    x={centerX - barWidth * 1.5 - 2}
                    y={revY}
                    width={barWidth}
                    height={Math.max(revH, 2)}
                    fill={isHovered ? "#4826C6" : "#5B34EA"}
                    rx="3"
                  />

                  {/* Spend Bar */}
                  <rect
                    x={centerX - barWidth / 2}
                    y={spdY}
                    width={barWidth}
                    height={Math.max(spdH, 2)}
                    fill={isHovered ? "#64748B" : "#94A3B8"}
                    rx="3"
                  />

                  {/* Profit Bar */}
                  <rect
                    x={centerX + barWidth / 2 + 2}
                    y={profY}
                    width={barWidth}
                    height={Math.max(profH, 2)}
                    fill={d.profit >= 0 ? (isHovered ? "#059669" : "#10B981") : (isHovered ? "#DC2626" : "#EF3340")}
                    rx="3"
                  />

                  {/* Date label */}
                  <text
                    x={centerX}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill={isHovered ? "#5B34EA" : "#64748B"}
                    fontWeight={isHovered ? "bold" : "normal"}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoverIndex !== null && daysData[hoverIndex] && (
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 15,
                background: "#17152F",
                color: "#FFFFFF",
                padding: "0.6rem 0.9rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                pointerEvents: "none",
                zIndex: 10,
                minWidth: "190px",
              }}
            >
              <div style={{ fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", marginBottom: "6px" }}>
                📅 Dia {daysData[hoverIndex].label}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ color: "#CBD5E1" }}>Receita:</span>
                <strong style={{ color: "#A78BFA" }}>{money(daysData[hoverIndex].revenue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ color: "#CBD5E1" }}>Investimento:</span>
                <strong style={{ color: "#E2E8F0" }}>{money(daysData[hoverIndex].spend)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ color: "#CBD5E1" }}>Lucro:</span>
                <strong style={{ color: daysData[hoverIndex].profit >= 0 ? "#34D399" : "#F87171" }}>
                  {daysData[hoverIndex].profit >= 0 ? "+ " : ""}{money(daysData[hoverIndex].profit)}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.15)", paddingTop: "4px", marginTop: "4px" }}>
                <span style={{ color: "#CBD5E1" }}>ROAS:</span>
                <strong>
                  {daysData[hoverIndex].roas ? `${daysData[hoverIndex].roas?.toFixed(2)}x` : "—"}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Footer */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginTop: "0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--line, #E2E8F0)",
        }}
      >
        <div>
          <small style={{ color: "var(--muted, #64748B)" }}>Receita Período</small>
          <strong style={{ display: "block", color: "#5B34EA", fontSize: "1.1rem" }}>
            {money(totals.rev)}
          </strong>
        </div>
        <div>
          <small style={{ color: "var(--muted, #64748B)" }}>Gasto Total Meta</small>
          <strong style={{ display: "block", color: "var(--ink, #0F172A)", fontSize: "1.1rem" }}>
            {money(totals.spd)}
          </strong>
        </div>
        <div>
          <small style={{ color: "var(--muted, #64748B)" }}>Lucro Líquido</small>
          <strong
            style={{
              display: "block",
              color: totals.prof >= 0 ? "#10B981" : "#EF3340",
              fontSize: "1.1rem",
            }}
          >
            {totals.prof >= 0 ? "+ " : ""}{money(totals.prof)}
          </strong>
        </div>
        <div>
          <small style={{ color: "var(--muted, #64748B)" }}>ROAS Consolidado</small>
          <strong style={{ display: "block", color: "var(--ink, #0F172A)", fontSize: "1.1rem" }}>
            {totals.roas ? `${totals.roas.toFixed(2)}x` : "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}
