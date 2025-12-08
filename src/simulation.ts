import { SimulationParams, SimulationResult, HourlyResult } from "./types";

// 定数定義
const FACTORY_LOAD_BASE = 350.0; // 工場の基本負荷 [kW] (500.0 → 350.0に削減)
const FACTORY_LOAD_PEAK = 550.0; // 工場のピーク負荷 [kW] (800.0 → 550.0に削減)
const PUBLIC_FACILITY_LOAD_BASE = 70.0; // 公共施設の基本負荷 [kW] (100.0 → 70.0に削減)
const PUBLIC_FACILITY_LOAD_PEAK = 130.0; // 公共施設のピーク負荷 [kW] (200.0 → 130.0に削減)
const EV_CHARGING_POWER = 3.0; // 1世帯あたりのEV充電電力 [kW]
const EV_CHARGING_HOURS = [22, 23, 0, 1, 2, 3]; // EV充電時間帯

/**
 * 住宅の電力需要パターンを生成（決定論的）
 */
function generateHouseholdLoadPattern(hours: number): number[] {
  const pattern: number[] = [];
  for (let t = 0; t < hours; t++) {
    // 朝のピーク（7-9時）と夜のピーク（18-22時）
    const morningPeak = 0.3 * Math.exp(-Math.pow((t - 8) / 1.5, 2));
    const eveningPeak = 0.5 * Math.exp(-Math.pow((t - 20) / 2, 2));
    const baseLoad = 0.2 + 0.1 * Math.sin((2 * Math.PI * t) / 24);
    let value = baseLoad + morningPeak + eveningPeak;
    pattern.push(value);
  }
  // 1世帯あたりの平均負荷を1kW程度に正規化
  const maxValue = Math.max(...pattern);
  return pattern.map((p) => (p / maxValue) * 1.0);
}

/**
 * 工場負荷パターンA：通常運転（決定論的、乱数なし）
 */
function generateFactoryLoadPatternA(hours: number): number[] {
  const pattern: number[] = [];
  for (let t = 0; t < hours; t++) {
    // 24時間ほぼ一定の負荷に小さな変動を加える（乱数なし）
    const value =
      FACTORY_LOAD_BASE +
      (FACTORY_LOAD_PEAK - FACTORY_LOAD_BASE) *
        (0.5 + 0.3 * Math.sin((2 * Math.PI * t) / 24));
    pattern.push(
      Math.max(
        FACTORY_LOAD_BASE * 0.8,
        Math.min(FACTORY_LOAD_PEAK * 1.1, value)
      )
    );
  }
  return pattern;
}

/**
 * 工場負荷パターンB：太陽光が多い昼間に負荷を集中（決定論的）
 */
function generateFactoryLoadPatternB(hours: number): number[] {
  const pattern: number[] = [];
  for (let t = 0; t < hours; t++) {
    // 昼間（10-16時）に負荷を集中させる
    const daytimeBoost = Math.exp(-Math.pow((t - 13) / 3, 2));
    const value =
      FACTORY_LOAD_BASE +
      (FACTORY_LOAD_PEAK - FACTORY_LOAD_BASE) * (0.3 + 0.7 * daytimeBoost);
    pattern.push(
      Math.max(
        FACTORY_LOAD_BASE * 0.5,
        Math.min(FACTORY_LOAD_PEAK * 1.2, value)
      )
    );
  }
  return pattern;
}

/**
 * 公共施設の電力需要パターンを生成
 */
function generatePublicFacilityLoadPattern(hours: number): number[] {
  const pattern: number[] = [];
  for (let t = 0; t < hours; t++) {
    // 昼間（9-17時）にピーク
    const daytimePattern = Math.exp(-Math.pow((t - 13) / 4, 2));
    const value =
      PUBLIC_FACILITY_LOAD_BASE +
      (PUBLIC_FACILITY_LOAD_PEAK - PUBLIC_FACILITY_LOAD_BASE) * daytimePattern;
    pattern.push(value);
  }
  return pattern;
}

/**
 * 太陽光発電パターンを生成
 */
function generatePvGenerationPattern(
  hours: number,
  pvCapacity: number
): number[] {
  const pattern: number[] = [];
  for (let i = 0; i < hours; i++) {
    const hour = i % 24;
    let value = 0;
    if (hour >= 6 && hour <= 18) {
      // 12時を中心としたガウス分布
      value = Math.exp(-Math.pow((hour - 12) / 3, 2));
    }
    // ピーク時に定格容量の80%程度発電すると仮定
    pattern.push(value * pvCapacity * 0.8);
  }
  return pattern;
}

/**
 * EV充電負荷パターンを生成
 */
function generateEvLoadPattern(hours: number): number[] {
  const pattern: number[] = [];
  for (let i = 0; i < hours; i++) {
    const hour = i % 24;
    pattern.push(EV_CHARGING_HOURS.includes(hour) ? EV_CHARGING_POWER : 0);
  }
  return pattern;
}

/**
 * 1時間の電力割り当てをシミュレーション
 */
function simulateOneHour(
  pvGeneration: number,
  householdLoad: number,
  factoryLoad: number,
  publicLoad: number,
  evLoad: number,
  householdBatteries: number[],
  sharedBattery: number,
  householdBatteryCapacity: number,
  sharedBatteryCapacity: number
): {
  gridPurchase: number;
  gridSell: number;
  updatedHouseholdBatteries: number[];
  updatedSharedBattery: number;
} {
  const totalLoad = householdLoad + factoryLoad + publicLoad + evLoad;
  const netGeneration = pvGeneration - totalLoad;

  let gridPurchase = 0;
  let gridSell = 0;
  const updatedHouseholdBatteries = [...householdBatteries];
  let updatedSharedBattery = sharedBattery;

  if (netGeneration > 0) {
    // 余剰電力がある場合
    let surplus = netGeneration;

    // 1. 各家庭の蓄電池に充電
    for (let i = 0; i < updatedHouseholdBatteries.length && surplus > 0; i++) {
      const chargeAmount = Math.min(
        surplus / updatedHouseholdBatteries.length,
        householdBatteryCapacity - updatedHouseholdBatteries[i]
      );
      updatedHouseholdBatteries[i] += chargeAmount;
      surplus -= chargeAmount;
    }

    // 2. 共用蓄電池に充電
    if (surplus > 0) {
      const chargeAmount = Math.min(
        surplus,
        sharedBatteryCapacity - updatedSharedBattery
      );
      updatedSharedBattery += chargeAmount;
      surplus -= chargeAmount;
    }

    // 3. 系統へ売電
    if (surplus > 0) {
      gridSell = surplus;
    }
  } else {
    // 電力不足の場合
    let shortage = -netGeneration;

    // 1. 各家庭の蓄電池から放電
    for (let i = 0; i < updatedHouseholdBatteries.length && shortage > 0; i++) {
      const dischargeAmount = Math.min(
        shortage / updatedHouseholdBatteries.length,
        updatedHouseholdBatteries[i]
      );
      updatedHouseholdBatteries[i] -= dischargeAmount;
      shortage -= dischargeAmount;
    }

    // 2. 共用蓄電池から放電
    if (shortage > 0) {
      const dischargeAmount = Math.min(shortage, updatedSharedBattery);
      updatedSharedBattery -= dischargeAmount;
      shortage -= dischargeAmount;
    }

    // 3. 系統から購入
    if (shortage > 0) {
      gridPurchase = shortage;
    }
  }

  return {
    gridPurchase,
    gridSell,
    updatedHouseholdBatteries,
    updatedSharedBattery,
  };
}

/**
 * シミュレーションを実行
 */
export function runSimulation(params: SimulationParams): SimulationResult {
  const hours = 24;
  const householdBatteryInitial = params.householdBatteryCapacity * 0.5;
  const sharedBatteryInitial = params.sharedBatteryCapacity * 0.5;

  // パターン生成
  const householdLoadPattern = generateHouseholdLoadPattern(hours);
  const factoryLoadPattern =
    params.factoryLoadPattern === "A"
      ? generateFactoryLoadPatternA(hours)
      : generateFactoryLoadPatternB(hours);
  const publicLoadPattern = generatePublicFacilityLoadPattern(hours);
  const pvPattern = generatePvGenerationPattern(
    hours,
    params.householdPvCapacity
  );
  const evLoadPattern = generateEvLoadPattern(hours);

  // 初期化
  const householdBatteries = new Array(params.numHouseholds).fill(
    householdBatteryInitial
  );
  let sharedBattery = sharedBatteryInitial;

  // 結果を格納
  const hourlyResults: HourlyResult[] = [];
  let totalGridPurchase = 0;
  let totalGridSell = 0;
  let totalPvGeneration = 0;

  // 各時間ステップでシミュレーション
  for (let hour = 0; hour < hours; hour++) {
    // 全世帯のPV発電量と負荷
    const totalPv = pvPattern[hour] * params.numHouseholds;
    const totalHouseholdLoad =
      householdLoadPattern[hour] * params.numHouseholds;
    const totalEvLoad = evLoadPattern[hour] * params.numHouseholds;

    // 1時間のシミュレーション
    const result = simulateOneHour(
      totalPv,
      totalHouseholdLoad,
      factoryLoadPattern[hour],
      publicLoadPattern[hour],
      totalEvLoad,
      householdBatteries,
      sharedBattery,
      params.householdBatteryCapacity,
      params.sharedBatteryCapacity
    );

    // 状態を更新
    householdBatteries.splice(
      0,
      householdBatteries.length,
      ...result.updatedHouseholdBatteries
    );
    sharedBattery = result.updatedSharedBattery;

    // 結果を記録
    const totalLoad =
      totalHouseholdLoad +
      factoryLoadPattern[hour] +
      publicLoadPattern[hour] +
      totalEvLoad;
    const householdBatteryLevel = householdBatteries.reduce(
      (sum, b) => sum + b,
      0
    );

    hourlyResults.push({
      hour,
      pvGeneration: totalPv,
      totalLoad,
      householdBatteryLevel,
      sharedBatteryLevel: sharedBattery,
      gridPurchase: result.gridPurchase,
      gridSell: result.gridSell,
    });

    totalGridPurchase += result.gridPurchase;
    totalGridSell += result.gridSell;
    totalPvGeneration += totalPv;
  }

  // 指標を計算
  const selfConsumption = totalPvGeneration - totalGridSell;
  const selfConsumptionRate =
    totalPvGeneration > 0 ? (selfConsumption / totalPvGeneration) * 100 : 0;

  return {
    hourlyResults,
    totalGridPurchase,
    totalGridSell,
    totalPvGeneration,
    selfConsumptionRate,
  };
}
