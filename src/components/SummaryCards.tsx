import { SimulationResult } from '../types';

interface SummaryCardsProps {
  result: SimulationResult;
}

export function SummaryCards({ result }: SummaryCardsProps) {
  const formatNumber = (value: number) => {
    return value.toFixed(2);
  };

  return (
    <div className="summary-cards">
      <div className="card">
        <h4>系統購入電力量合計</h4>
        <p className="value">{formatNumber(result.totalGridPurchase)} kWh</p>
      </div>
      <div className="card">
        <h4>系統売電電力量合計</h4>
        <p className="value">{formatNumber(result.totalGridSell)} kWh</p>
      </div>
      <div className="card">
        <h4>太陽光発電量合計</h4>
        <p className="value">{formatNumber(result.totalPvGeneration)} kWh</p>
      </div>
      <div className="card">
        <h4>太陽光自己消費率</h4>
        <p className="value">{formatNumber(result.selfConsumptionRate)} %</p>
      </div>
    </div>
  );
}

