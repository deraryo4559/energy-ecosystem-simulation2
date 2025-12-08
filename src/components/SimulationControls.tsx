import { SimulationParams } from '../types';

interface SimulationControlsProps {
  params: SimulationParams;
  onParamsChange: (params: SimulationParams) => void;
  onRunSimulation: () => void;
}

export function SimulationControls({
  params,
  onParamsChange,
  onRunSimulation,
}: SimulationControlsProps) {
  const handleChange = (field: keyof SimulationParams, value: number | 'A' | 'B') => {
    onParamsChange({ ...params, [field]: value });
  };

  return (
    <div className="controls-panel">
      <h2>パラメータ設定</h2>
      <div className="control-group">
        <label>
          世帯数:
          <input
            type="number"
            min="1"
            max="1000"
            value={params.numHouseholds}
            onChange={(e) => handleChange('numHouseholds', parseInt(e.target.value) || 1)}
          />
        </label>
      </div>
      <div className="control-group">
        <label>
          1世帯あたりPV容量 [kW]:
          <input
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={params.householdPvCapacity}
            onChange={(e) => handleChange('householdPvCapacity', parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className="control-group">
        <label>
          1世帯あたり蓄電池容量 [kWh]:
          <input
            type="number"
            min="0"
            max="50"
            step="0.1"
            value={params.householdBatteryCapacity}
            onChange={(e) => handleChange('householdBatteryCapacity', parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className="control-group">
        <label>
          共用蓄電池容量 [kWh]:
          <input
            type="number"
            min="0"
            max="5000"
            step="10"
            value={params.sharedBatteryCapacity}
            onChange={(e) => handleChange('sharedBatteryCapacity', parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className="control-group">
        <label>
          工場負荷パターン:
          <select
            value={params.factoryLoadPattern}
            onChange={(e) => handleChange('factoryLoadPattern', e.target.value as 'A' | 'B')}
          >
            <option value="A">A: 通常運転</option>
            <option value="B">B: 昼間負荷集中</option>
          </select>
        </label>
      </div>
      <button className="run-button" onClick={onRunSimulation}>
        シミュレーション実行
      </button>
    </div>
  );
}

