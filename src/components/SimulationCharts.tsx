import { SimulationResult } from '../types';
import {
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

interface SimulationChartsProps {
  result: SimulationResult;
}

export function SimulationCharts({ result }: SimulationChartsProps) {
  const chartData = result.hourlyResults.map((r) => ({
    hour: r.hour,
    '太陽光発電量': r.pvGeneration,
    '総需要': r.totalLoad,
    '総蓄電池残量': r.householdBatteryLevel + r.sharedBatteryLevel,
    '系統購入': r.gridPurchase,
    '系統売電': r.gridSell,
  }));

  // モダンな配色定義
  const colors = {
    pv: '#f59e0b', // Amber 500 (太陽光)
    load: '#3b82f6', // Blue 500 (需要)
    battery: '#10b981', // Emerald 500 (蓄電池)
    gridPurchase: '#ef4444', // Red 500 (購入)
    gridSell: '#10b981', // Emerald 500 (売電)
    gridStroke: '#e5e7eb', // Gray 200 (グリッド線)
    text: '#6b7280', // Gray 500 (テキスト)
  };

  return (
    <div className="charts-container">
      <div className="chart-section">
        <h3>太陽光発電量・総需要・蓄電池残量</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: colors.text, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: colors.gridStroke }}
              label={{ value: '時間 [時]', position: 'insideBottom', offset: -5, fill: colors.text, fontSize: 12 }}
              ticks={[0, 4, 8, 12, 16, 20, 23]}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: colors.text, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: '電力 [kWh]', angle: -90, position: 'insideLeft', fill: colors.text, fontSize: 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: colors.text, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: '蓄電池残量 [kWh]', angle: 90, position: 'insideRight', fill: colors.text, fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="太陽光発電量"
              fill={colors.pv}
              stroke={colors.pv}
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="総需要"
              stroke={colors.load}
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="総蓄電池残量"
              stroke={colors.battery}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-section">
        <h3>系統購入・売電電力</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: colors.text, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: colors.gridStroke }}
              label={{ value: '時間 [時]', position: 'insideBottom', offset: -5, fill: colors.text, fontSize: 12 }}
              ticks={[0, 4, 8, 12, 16, 20, 23]}
            />
            <YAxis
              tick={{ fill: colors.text, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: '電力 [kWh]', angle: -90, position: 'insideLeft', fill: colors.text, fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Area
              type="monotone"
              dataKey="系統購入"
              stackId="1"
              stroke={colors.gridPurchase}
              fill={colors.gridPurchase}
              fillOpacity={0.6}
              strokeWidth={0}
            />
            <Area
              type="monotone"
              dataKey="系統売電"
              stackId="2"
              stroke={colors.gridSell}
              fill={colors.gridSell}
              fillOpacity={0.6}
              strokeWidth={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
