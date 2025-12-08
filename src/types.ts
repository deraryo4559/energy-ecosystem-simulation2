/**
 * シミュレーションパラメータの型定義
 */
export interface SimulationParams {
  /** 世帯数 */
  numHouseholds: number;
  /** 1世帯あたりのPV容量 [kW] */
  householdPvCapacity: number;
  /** 1世帯あたりの蓄電池容量 [kWh] */
  householdBatteryCapacity: number;
  /** 共用蓄電池容量 [kWh] */
  sharedBatteryCapacity: number;
  /** 工場負荷パターン ('A': 通常運転, 'B': 昼間集中) */
  factoryLoadPattern: 'A' | 'B';
}

/**
 * 1時間ごとのシミュレーション結果
 */
export interface HourlyResult {
  /** 時刻（0-23） */
  hour: number;
  /** 太陽光発電量 [kWh] */
  pvGeneration: number;
  /** 総需要 [kWh] */
  totalLoad: number;
  /** 家庭用蓄電池残量合計 [kWh] */
  householdBatteryLevel: number;
  /** 共用蓄電池残量 [kWh] */
  sharedBatteryLevel: number;
  /** 系統から購入した電力 [kWh] */
  gridPurchase: number;
  /** 系統へ売電した電力 [kWh] */
  gridSell: number;
}

/**
 * シミュレーション結果全体
 */
export interface SimulationResult {
  /** 1時間ごとの結果 */
  hourlyResults: HourlyResult[];
  /** 系統購入電力量合計 [kWh] */
  totalGridPurchase: number;
  /** 系統売電電力量合計 [kWh] */
  totalGridSell: number;
  /** 太陽光発電量合計 [kWh] */
  totalPvGeneration: number;
  /** 太陽光自己消費率 [%] */
  selfConsumptionRate: number;
}

