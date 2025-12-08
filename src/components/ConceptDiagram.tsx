import { SimulationResult } from '../types';

interface ConceptDiagramProps {
  result: SimulationResult;
}

export function ConceptDiagram({ result }: ConceptDiagramProps) {
  // 平均的な値を計算して色の強度を決定
  const avgGridPurchase = result.totalGridPurchase / 24;
  const avgGridSell = result.totalGridSell / 24;
  const avgPvGeneration = result.totalPvGeneration / 24;

  // 色の強度を0-1の範囲に正規化（簡易版）
  const purchaseIntensity = Math.min(1, avgGridPurchase / 1000);
  const sellIntensity = Math.min(1, avgGridSell / 1000);
  const pvIntensity = Math.min(1, avgPvGeneration / 200);

  return (
    <div className="concept-diagram">
      <h3>エネルギーエコシステム概念図</h3>
      <div className="diagram-container">
        <div className="diagram-row">
          <div className="diagram-item pv">
            <div className="icon">☀️</div>
            <div className="label">太陽光発電</div>
            <div className="value" style={{ opacity: 0.5 + pvIntensity * 0.5 }}>
              {result.totalPvGeneration.toFixed(0)} kWh
            </div>
          </div>
        </div>

        <div className="diagram-row">
          <div className="diagram-item household">
            <div className="icon">🏠</div>
            <div className="label">住宅エリア</div>
          </div>
          <div className="diagram-item factory">
            <div className="icon">🏭</div>
            <div className="label">工場エリア</div>
          </div>
          <div className="diagram-item public">
            <div className="icon">🏛️</div>
            <div className="label">公共施設</div>
          </div>
        </div>

        <div className="diagram-row">
          <div className="diagram-item battery">
            <div className="icon">🔋</div>
            <div className="label">エネルギーセンター</div>
            <div className="value">
              {result.hourlyResults[0].sharedBatteryLevel.toFixed(0)} kWh
            </div>
          </div>
        </div>

        <div className="diagram-row">
          <div className="diagram-item grid">
            <div className="icon">⚡</div>
            <div className="label">系統</div>
            <div className="value purchase" style={{ opacity: 0.5 + purchaseIntensity * 0.5 }}>
              購入: {result.totalGridPurchase.toFixed(0)} kWh
            </div>
            <div className="value sell" style={{ opacity: 0.5 + sellIntensity * 0.5 }}>
              売電: {result.totalGridSell.toFixed(0)} kWh
            </div>
          </div>
        </div>

        {/* 矢印 */}
        <div className="arrows">
          <div className="arrow arrow-pv" style={{ opacity: 0.5 + pvIntensity * 0.5 }}>
            ↓
          </div>
          <div className="arrow arrow-battery" style={{ opacity: 0.3 }}>
            ↓
          </div>
          <div className="arrow arrow-grid" style={{ opacity: 0.3 }}>
            ↓
          </div>
        </div>
      </div>
    </div>
  );
}

