// ============================================================
// Matric Mind AI - Progress Chart Component
// Reusable Recharts-based progress chart
// ============================================================

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ============================================================
// Types
// ============================================================

export interface ChartDataPoint {
  date: string;
  score: number;
  hours: number;
}

export interface ProgressChartProps {
  data: ChartDataPoint[];
  type: 'score' | 'hours' | 'combined';
  height?: number;
  showLegend?: boolean;
  className?: string;
}

// ============================================================
// Custom Tooltip
// ============================================================

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.dataKey === 'score' ? `Score: ${entry.value}%` : `Hours: ${entry.value}h`}
        </p>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function ProgressChart({
  data,
  type,
  height = 300,
  showLegend = true,
  className = '',
}: ProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-muted-foreground text-sm">No data available yet</p>
      </div>
    );
  }

  const showScore = type === 'score' || type === 'combined';
  const showHours = type === 'hours' || type === 'combined';

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            domain={type === 'score' ? [0, 100] : [0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}

          {showScore && (
            <Area
              type="monotone"
              dataKey="score"
              name="Score (%)"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          )}

          {showHours && (
            <Area
              type="monotone"
              dataKey="hours"
              name="Study Hours"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#hoursGradient)"
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
