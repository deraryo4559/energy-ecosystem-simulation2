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

  return (
    <div className="charts-container">
      <div className="chart-section">
        <h3>太陽光発電量・総需要・蓄電池残量</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              label={{ value: '時間 [時]', position: 'insideBottom', offset: -5 }}
              ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]}
            />
            <YAxis
              yAxisId="left"
              label={{ value: '電力 [kWh]', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{ value: '蓄電池残量 [kWh]', angle: 90, position: 'insideRight' }}
            />
            <Tooltip />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="太陽光発電量"
              fill="#ff9800"
              stroke="#ff9800"
              fillOpacity={0.3}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="総需要"
              stroke="#2196f3"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="総蓄電池残量"
              stroke="#4caf50"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-section">
        <h3>系統購入・売電電力</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              label={{ value: '時間 [時]', position: 'insideBottom', offset: -5 }}
              ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]}
            />
            <YAxis label={{ value: '電力 [kWh]', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="系統購入"
              stackId="1"
              stroke="#f44336"
              fill="#f44336"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="系統売電"
              stackId="2"
              stroke="#4caf50"
              fill="#4caf50"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

