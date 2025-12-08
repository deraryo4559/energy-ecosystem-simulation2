import { useState, useEffect } from 'react';
import { SimulationParams, SimulationResult } from './types';
import { runSimulation } from './simulation';
import { SimulationControls } from './components/SimulationControls';
import { SimulationCharts } from './components/SimulationCharts';
import { SummaryCards } from './components/SummaryCards';
import { ConceptDiagram } from './components/ConceptDiagram';
import './App.css';

// デフォルトパラメータ（Python版と同期）
const DEFAULT_PARAMS: SimulationParams = {
  numHouseholds: 100,
  householdPvCapacity: 15.0, // 5.0 → 15.0に増加（日中余剰と売電を確保）
  householdBatteryCapacity: 10.0,
  sharedBatteryCapacity: 500.0,
  factoryLoadPattern: 'A',
};

function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // 初期表示時にデフォルトパラメータでシミュレーション実行
  useEffect(() => {
    const initialResult = runSimulation(DEFAULT_PARAMS);
    setResult(initialResult);
  }, []);

  const handleRunSimulation = () => {
    const newResult = runSimulation(params);
    setResult(newResult);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>エネルギーエコシステム 概念ダッシュボード</h1>
        <p>工場誘致支援ソリューション</p>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <SimulationControls
            params={params}
            onParamsChange={setParams}
            onRunSimulation={handleRunSimulation}
          />
        </aside>

        <main className="main-content">
          {result && (
            <>
              <SimulationCharts result={result} />
              <SummaryCards result={result} />
              <ConceptDiagram result={result} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

