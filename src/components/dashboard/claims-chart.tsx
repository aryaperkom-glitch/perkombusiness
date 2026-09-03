"use client";

import ReactECharts from "echarts-for-react";

const MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export interface MonthlyClaimsPoint {
  month: string; // "YYYY-MM"
  count: number;
}

// Single-series bar chart, no legend (the card title names the series).
// PERKOM tokens: primary bars, muted ink for axis text, recessive grid.
export function ClaimsChart({ data }: { data: MonthlyClaimsPoint[] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-base-content/50">
        Belum ada data claims.
      </div>
    );
  }

  const labels = data.map((d) => {
    const [, month] = d.month.split("-");
    return MONTHS_ID[Number(month) - 1] ?? d.month;
  });

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#ffffff",
      borderColor: "#E3E6EA",
      textStyle: { color: "#1C2733", fontSize: 12 },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#E3E6EA" } },
      axisLabel: { color: "#66707D", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#F0F1F4" } },
      axisLabel: { color: "#66707D", fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.count),
        barMaxWidth: 28,
        itemStyle: { color: "#2B5CE6", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 260, width: "100%" }}
      opts={{ renderer: "svg" }}
    />
  );
}
