import { useMemo } from 'react';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarChartData[];
  height?: number;
  showLabels?: boolean;
}

export function SimpleBarChart({ data, height = 200, showLabels = true }: SimpleBarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex h-full items-end gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="bg-primary-500 w-full rounded-t-md transition-all"
              style={{
                height: `${(item.value / maxValue) * 100}%`,
                minHeight: item.value > 0 ? '4px' : '0',
              }}
            />
            {showLabels && <span className="text-fg-muted truncate text-xs">{item.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineChartData {
  label: string;
  value: number;
}

interface SimpleLineChartProps {
  data: LineChartData[];
  height?: number;
  showLabels?: boolean;
  color?: string;
}

export function SimpleLineChart({
  data,
  height = 200,
  showLabels = true,
  color = '#3b82f6',
}: SimpleLineChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  const minValue = useMemo(() => Math.min(...data.map((d) => d.value), 0), [data]);
  const range = maxValue - minValue || 1;

  const points = useMemo(() => {
    if (data.length === 0) return '';
    return data
      .map((item, index) => {
        const x = (index / (data.length - 1 || 1)) * 100;
        const y = 100 - ((item.value - minValue) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, minValue, range]);

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showLabels && (
        <div className="mt-1 flex justify-between">
          {data.map((item, index) => (
            <span key={index} className="text-fg-muted truncate text-xs">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
