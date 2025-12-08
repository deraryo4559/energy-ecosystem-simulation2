"""
東京ガス エネルギーエコシステム PoC
工場誘致を支援するエネルギー最適化シミュレーション
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple, List
import matplotlib
import platform

# 日本語フォント設定
if platform.system() == 'Darwin':  # macOS
    matplotlib.rcParams['font.family'] = 'Hiragino Sans'
elif platform.system() == 'Windows':
    matplotlib.rcParams['font.family'] = 'MS Gothic'
else:  # Linux
    matplotlib.rcParams['font.family'] = 'DejaVu Sans'
matplotlib.rcParams['axes.unicode_minus'] = False  # マイナス記号の文字化けを防ぐ

# ==================== パラメータ設定 ====================

# 基本パラメータ
NUM_HOUSEHOLDS = 100  # 世帯数
HOUSEHOLD_PV_CAPACITY = 15.0  # 各世帯の太陽光容量 [kW] (12.0 → 15.0に増加: 余剰時間と売電を確保)
HOUSEHOLD_BATTERY_CAPACITY = 10.0  # 各世帯の蓄電池容量 [kWh]
SHARED_BATTERY_CAPACITY = 500.0  # 共用蓄電池容量 [kWh]

# 初期蓄電池残量（容量の50%）
HOUSEHOLD_BATTERY_INITIAL = HOUSEHOLD_BATTERY_CAPACITY * 0.5
SHARED_BATTERY_INITIAL = SHARED_BATTERY_CAPACITY * 0.5

# 時間設定
HOURS_PER_DAY = 24
SIMULATION_DAYS = 1  # シミュレーション日数（拡張可能）

# 工場負荷パターン設定
FACTORY_LOAD_BASE = 350.0  # 工場の基本負荷 [kW] (400.0 → 350.0に削減)
FACTORY_LOAD_PEAK = 550.0  # 工場のピーク負荷 [kW] (600.0 → 550.0に削減)

# 公共施設負荷設定
PUBLIC_FACILITY_LOAD_BASE = 70.0  # 公共施設の基本負荷 [kW] (80.0 → 70.0に削減)
PUBLIC_FACILITY_LOAD_PEAK = 130.0  # 公共施設のピーク負荷 [kW] (150.0 → 130.0に削減)

# EV充電設定
EV_CHARGING_POWER = 3.0  # 1世帯あたりのEV充電電力 [kW]
EV_CHARGING_HOURS = [22, 23, 0, 1, 2, 3]  # EV充電時間帯（22時〜3時）

# ==================== 需要パターン生成関数 ====================

def generate_household_load_pattern(hours: int) -> np.ndarray:
    """
    住宅の電力需要パターンを生成
    朝と夜にピークがある典型的な家庭用負荷パターン
    """
    t = np.arange(hours)
    # 朝のピーク（7-9時）と夜のピーク（18-22時）
    morning_peak = 0.3 * np.exp(-((t - 8) / 1.5) ** 2)
    evening_peak = 0.5 * np.exp(-((t - 20) / 2) ** 2)
    base_load = 0.2 + 0.1 * np.sin(2 * np.pi * t / 24)
    pattern = base_load + morning_peak + evening_peak
    # 1世帯あたりの平均負荷を1kW程度に正規化
    pattern = pattern / np.max(pattern) * 1.0
    return pattern

def generate_factory_load_pattern_a(hours: int) -> np.ndarray:
    """
    工場負荷パターンA：通常運転（昼夜をあまり意識しない）
    """
    t = np.arange(hours)
    # 24時間ほぼ一定の負荷に小さな変動を加える
    pattern = FACTORY_LOAD_BASE + (FACTORY_LOAD_PEAK - FACTORY_LOAD_BASE) * (
        0.5 + 0.3 * np.sin(2 * np.pi * t / 24) + 
        0.2 * np.random.normal(0, 0.1, hours)
    )
    return np.clip(pattern, FACTORY_LOAD_BASE * 0.8, FACTORY_LOAD_PEAK * 1.1)

def generate_factory_load_pattern_b(hours: int) -> np.ndarray:
    """
    工場負荷パターンB：太陽光が多い昼間にできるだけ負荷を寄せたプロファイル
    """
    t = np.arange(hours)
    # 昼間（10-16時）に負荷を集中させる
    daytime_boost = np.exp(-((t - 13) / 3) ** 2)  # 13時を中心としたガウス分布
    pattern = FACTORY_LOAD_BASE + (FACTORY_LOAD_PEAK - FACTORY_LOAD_BASE) * (
        0.3 + 0.7 * daytime_boost + 
        0.1 * np.random.normal(0, 0.05, hours)
    )
    return np.clip(pattern, FACTORY_LOAD_BASE * 0.5, FACTORY_LOAD_PEAK * 1.2)

def generate_public_facility_load_pattern(hours: int) -> np.ndarray:
    """
    公共施設の電力需要パターンを生成
    昼間にピークがある
    """
    t = np.arange(hours)
    # 昼間（9-17時）にピーク
    daytime_pattern = np.exp(-((t - 13) / 4) ** 2)
    base = PUBLIC_FACILITY_LOAD_BASE
    peak = PUBLIC_FACILITY_LOAD_PEAK
    pattern = base + (peak - base) * daytime_pattern
    return pattern

def generate_pv_generation_pattern(hours: int) -> np.ndarray:
    """
    太陽光発電パターンを生成
    昼間にピークがある典型的な発電パターン
    """
    t = np.arange(hours)
    # 6時から18時まで発電（太陽が昇っている時間帯）
    pv_pattern = np.zeros(hours)
    for i in range(hours):
        hour = i % 24
        if 6 <= hour <= 18:
            # 12時を中心としたガウス分布
            pv_pattern[i] = np.exp(-((hour - 12) / 3) ** 2)
        else:
            pv_pattern[i] = 0
    
    # 1世帯あたりのPV容量に基づいて正規化
    # ピーク時に定格容量の80%程度発電すると仮定
    pv_pattern = pv_pattern * HOUSEHOLD_PV_CAPACITY * 0.8
    return pv_pattern

def generate_ev_load_pattern(hours: int) -> np.ndarray:
    """
    EV充電負荷パターンを生成
    夜間に一定量を充電する追加負荷
    """
    ev_load = np.zeros(hours)
    for i in range(hours):
        hour = i % 24
        if hour in EV_CHARGING_HOURS:
            ev_load[i] = EV_CHARGING_POWER
    return ev_load

# ==================== シミュレーション関数 ====================

def simulate_one_hour(
    pv_generation: float,
    household_load: float,
    factory_load: float,
    public_load: float,
    ev_load: float,
    household_batteries: np.ndarray,
    shared_battery: float,
    household_battery_capacity: float,
    shared_battery_capacity: float
) -> Tuple[float, float, np.ndarray, float]:
    """
    1時間の電力割り当てをシミュレーション
    
    Returns:
        grid_purchase: 系統から購入した電力 [kWh]
        grid_sell: 系統へ売電した電力 [kWh]
        updated_household_batteries: 更新後の各世帯の蓄電池残量 [kWh]
        updated_shared_battery: 更新後の共用蓄電池残量 [kWh]
    """
    total_load = household_load + factory_load + public_load + ev_load
    net_generation = pv_generation - total_load
    
    grid_purchase = 0.0
    grid_sell = 0.0
    updated_household_batteries = household_batteries.copy()
    updated_shared_battery = shared_battery
    
    if net_generation > 0:
        # 余剰電力がある場合
        surplus = net_generation
        initial_surplus = surplus  # デバッグ用
        
        # 1. 各家庭の蓄電池に充電（上限まで）
        total_household_charge = 0.0
        for i in range(len(household_batteries)):
            if surplus > 0:
                available_capacity = household_battery_capacity - household_batteries[i]
                charge_amount = min(
                    surplus / len(household_batteries),
                    available_capacity
                )
                updated_household_batteries[i] += charge_amount
                total_household_charge += charge_amount
                surplus -= charge_amount
        
        # 2. まだ余れば共用蓄電池に充電
        shared_charge = 0.0
        if surplus > 0:
            available_capacity = shared_battery_capacity - updated_shared_battery
            shared_charge = min(surplus, available_capacity)
            updated_shared_battery += shared_charge
            surplus -= shared_charge
        
        # 3. さらに余れば系統へ売電
        if surplus > 0:
            grid_sell = surplus
        
        # デバッグ: 余剰電力の分配を確認（合計が一致することを確認）
        total_used = total_household_charge + shared_charge + grid_sell
        if abs(total_used - initial_surplus) > 1e-6:
            print(f"警告: 余剰電力の分配に不整合があります。余剰={initial_surplus:.2f}, 使用={total_used:.2f}")
    
    else:
        # 電力不足の場合
        shortage = -net_generation
        
        # 1. 各家庭の蓄電池から放電
        for i in range(len(household_batteries)):
            if shortage > 0:
                discharge_amount = min(
                    shortage / len(household_batteries),
                    household_batteries[i]
                )
                updated_household_batteries[i] -= discharge_amount
                shortage -= discharge_amount
        
        # 2. 共用蓄電池から放電
        if shortage > 0:
            discharge_amount = min(shortage, updated_shared_battery)
            updated_shared_battery -= discharge_amount
            shortage -= discharge_amount
        
        # 3. 系統から購入
        if shortage > 0:
            grid_purchase = shortage
    
    return grid_purchase, grid_sell, updated_household_batteries, updated_shared_battery

def simulate_one_day(
    household_load_pattern: np.ndarray,
    factory_load_pattern: np.ndarray,
    public_load_pattern: np.ndarray,
    pv_pattern: np.ndarray,
    ev_load_pattern: np.ndarray,
    num_households: int,
    household_battery_capacity: float,
    shared_battery_capacity: float
) -> Dict:
    """
    1日のシミュレーションを実行
    
    Returns:
        シミュレーション結果の辞書
    """
    hours = len(household_load_pattern)
    
    # 初期化
    household_batteries = np.full(num_households, HOUSEHOLD_BATTERY_INITIAL)
    shared_battery = SHARED_BATTERY_INITIAL
    
    # 結果を格納する配列
    grid_purchases = []
    grid_sells = []
    shared_battery_levels = []
    total_household_battery_levels = []
    pv_generations = []
    total_loads = []
    net_generations = []  # デバッグ用
    
    # 各時間ステップでシミュレーション
    for hour in range(hours):
        # 全世帯のPV発電量と負荷
        total_pv = pv_pattern[hour] * num_households
        total_household_load = household_load_pattern[hour] * num_households
        total_ev_load = ev_load_pattern[hour] * num_households
        total_load = total_household_load + factory_load_pattern[hour] + public_load_pattern[hour] + total_ev_load
        net_generation = total_pv - total_load
        
        # 1時間のシミュレーション
        grid_purchase, grid_sell, household_batteries, shared_battery = simulate_one_hour(
            total_pv,
            total_household_load,
            factory_load_pattern[hour],
            public_load_pattern[hour],
            total_ev_load,
            household_batteries,
            shared_battery,
            household_battery_capacity,
            shared_battery_capacity
        )
        
        # 結果を記録
        grid_purchases.append(grid_purchase)
        grid_sells.append(grid_sell)
        shared_battery_levels.append(shared_battery)
        total_household_battery_levels.append(np.sum(household_batteries))
        pv_generations.append(total_pv)
        total_loads.append(total_load)
        net_generations.append(net_generation)
    
    return {
        'grid_purchases': np.array(grid_purchases),
        'grid_sells': np.array(grid_sells),
        'shared_battery_levels': np.array(shared_battery_levels),
        'household_battery_levels': np.array(total_household_battery_levels),
        'pv_generations': np.array(pv_generations),
        'total_loads': np.array(total_loads),
        'net_generations': np.array(net_generations),  # デバッグ用
        'factory_load_pattern': factory_load_pattern
    }

# ==================== 指標計算関数 ====================

def calculate_metrics(results: Dict) -> Dict:
    """
    シミュレーション結果から指標を計算
    """
    total_grid_purchase = np.sum(results['grid_purchases'])
    total_grid_sell = np.sum(results['grid_sells'])
    total_pv_generation = np.sum(results['pv_generations'])
    total_load = np.sum(results['total_loads'])
    
    # 自己消費量 = 総需要 - 系統購入量（ただし、蓄電池からの放電分も含む）
    # より正確には、PV発電量のうち、直接需要に使われた分 + 蓄電池に充電された分
    # 簡易的に、PV発電量 - 売電量として計算
    self_consumption = total_pv_generation - total_grid_sell
    self_consumption_rate = (self_consumption / total_pv_generation * 100) if total_pv_generation > 0 else 0
    
    return {
        'total_grid_purchase': total_grid_purchase,
        'total_grid_sell': total_grid_sell,
        'total_pv_generation': total_pv_generation,
        'total_load': total_load,
        'self_consumption_rate': self_consumption_rate
    }

# ==================== グラフ描画関数 ====================

def plot_results(results_a: Dict, results_b: Dict, metrics_a: Dict, metrics_b: Dict):
    """
    シミュレーション結果をグラフで可視化
    """
    hours = len(results_a['pv_generations'])
    time_hours = np.arange(hours)
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('エネルギーエコシステム シミュレーション結果', fontsize=16, fontweight='bold')
    
    # グラフ1: 太陽光発電量、総需要、蓄電池残量の推移（パターンA）
    ax1 = axes[0, 0]
    ax1.plot(time_hours, results_a['pv_generations'], label='太陽光発電量', color='orange', linewidth=2)
    ax1.plot(time_hours, results_a['total_loads'], label='総需要', color='blue', linewidth=2)
    ax1_twin = ax1.twinx()
    total_battery = results_a['shared_battery_levels'] + results_a['household_battery_levels']
    ax1_twin.plot(time_hours, total_battery, label='総蓄電池残量', color='green', linewidth=2, linestyle='--')
    ax1.set_xlabel('時間 [時]')
    ax1.set_ylabel('電力 [kWh]', color='black')
    ax1_twin.set_ylabel('蓄電池残量 [kWh]', color='green')
    ax1.set_title('パターンA: 太陽光発電量・総需要・蓄電池残量')
    ax1.legend(loc='upper left')
    ax1_twin.legend(loc='upper right')
    ax1.grid(True, alpha=0.3)
    ax1.set_xticks(range(0, 24, 2))
    
    # グラフ2: 太陽光発電量、総需要、蓄電池残量の推移（パターンB）
    ax2 = axes[0, 1]
    ax2.plot(time_hours, results_b['pv_generations'], label='太陽光発電量', color='orange', linewidth=2)
    ax2.plot(time_hours, results_b['total_loads'], label='総需要', color='blue', linewidth=2)
    ax2_twin = ax2.twinx()
    total_battery_b = results_b['shared_battery_levels'] + results_b['household_battery_levels']
    ax2_twin.plot(time_hours, total_battery_b, label='総蓄電池残量', color='green', linewidth=2, linestyle='--')
    ax2.set_xlabel('時間 [時]')
    ax2.set_ylabel('電力 [kWh]', color='black')
    ax2_twin.set_ylabel('蓄電池残量 [kWh]', color='green')
    ax2.set_title('パターンB: 太陽光発電量・総需要・蓄電池残量')
    ax2.legend(loc='upper left')
    ax2_twin.legend(loc='upper right')
    ax2.grid(True, alpha=0.3)
    ax2.set_xticks(range(0, 24, 2))
    
    # グラフ3: 系統からの購入電力と売電電力の推移（パターンA）
    ax3 = axes[1, 0]
    ax3.plot(time_hours, results_a['grid_purchases'], label='系統購入', color='red', linewidth=2)
    ax3.plot(time_hours, results_a['grid_sells'], label='系統売電', color='green', linewidth=2)
    ax3.fill_between(time_hours, 0, results_a['grid_purchases'], alpha=0.3, color='red')
    ax3.fill_between(time_hours, 0, results_a['grid_sells'], alpha=0.3, color='green')
    ax3.set_xlabel('時間 [時]')
    ax3.set_ylabel('電力 [kWh]')
    ax3.set_title('パターンA: 系統購入・売電')
    ax3.legend()
    ax3.grid(True, alpha=0.3)
    ax3.set_xticks(range(0, 24, 2))
    
    # グラフ4: 系統からの購入電力と売電電力の推移（パターンB）
    ax4 = axes[1, 1]
    ax4.plot(time_hours, results_b['grid_purchases'], label='系統購入', color='red', linewidth=2)
    ax4.plot(time_hours, results_b['grid_sells'], label='系統売電', color='green', linewidth=2)
    ax4.fill_between(time_hours, 0, results_b['grid_purchases'], alpha=0.3, color='red')
    ax4.fill_between(time_hours, 0, results_b['grid_sells'], alpha=0.3, color='green')
    ax4.set_xlabel('時間 [時]')
    ax4.set_ylabel('電力 [kWh]')
    ax4.set_title('パターンB: 系統購入・売電')
    ax4.legend()
    ax4.grid(True, alpha=0.3)
    ax4.set_xticks(range(0, 24, 2))
    
    plt.tight_layout()
    plt.savefig('energy_ecosystem_results.png', dpi=300, bbox_inches='tight')
    print("グラフを 'energy_ecosystem_results.png' に保存しました。")
    plt.show()

# ==================== メイン実行 ====================

def main():
    """
    メイン実行関数
    """
    # 再現性のための乱数シード設定
    np.random.seed(42)
    
    print("=" * 60)
    print("東京ガス エネルギーエコシステム PoC シミュレーション")
    print("=" * 60)
    print(f"\nパラメータ設定:")
    print(f"  世帯数: {NUM_HOUSEHOLDS}")
    print(f"  各世帯のPV容量: {HOUSEHOLD_PV_CAPACITY} kW")
    print(f"  各世帯の蓄電池容量: {HOUSEHOLD_BATTERY_CAPACITY} kWh")
    print(f"  共用蓄電池容量: {SHARED_BATTERY_CAPACITY} kWh")
    print(f"  工場基本負荷: {FACTORY_LOAD_BASE} kW")
    print(f"  工場ピーク負荷: {FACTORY_LOAD_PEAK} kW")
    print()
    
    # 需要パターンと発電パターンを生成
    hours = HOURS_PER_DAY * SIMULATION_DAYS
    
    household_load_pattern = generate_household_load_pattern(hours)
    factory_load_pattern_a = generate_factory_load_pattern_a(hours)
    factory_load_pattern_b = generate_factory_load_pattern_b(hours)
    public_load_pattern = generate_public_facility_load_pattern(hours)
    pv_pattern = generate_pv_generation_pattern(hours)
    ev_load_pattern = generate_ev_load_pattern(hours)
    
    # デバッグ: パターン生成後の電力バランスを確認
    print("\n【デバッグ情報: パターンA（通常運転）の電力バランス】")
    print("=" * 60)
    total_pv_array = pv_pattern * NUM_HOUSEHOLDS
    total_load_array = (
        household_load_pattern * NUM_HOUSEHOLDS +
        factory_load_pattern_a +
        public_load_pattern +
        ev_load_pattern * NUM_HOUSEHOLDS
    )
    net_gen_array = total_pv_array - total_load_array
    
    print(f"total_pv: 最小={np.min(total_pv_array):.2f} kWh, 最大={np.max(total_pv_array):.2f} kWh")
    print(f"total_load: 最小={np.min(total_load_array):.2f} kWh, 最大={np.max(total_load_array):.2f} kWh")
    print(f"net_generation: 最小={np.min(net_gen_array):.2f} kWh, 最大={np.max(net_gen_array):.2f} kWh")
    print(f"net_generation > 0 の時間数: {np.sum(net_gen_array > 0)} 時間")
    print(f"net_generation < 0 の時間数: {np.sum(net_gen_array < 0)} 時間")
    print()
    
    # 各時間の詳細を表示（余剰/不足が発生する時間帯のみ）
    print("【時間別詳細（余剰/不足が大きい時間帯）】")
    for hour in range(24):
        if abs(net_gen_array[hour]) > 50:  # 50kWh以上の差がある時間のみ表示
            print(f"  {hour:2d}時: PV={total_pv_array[hour]:6.2f} kWh, "
                  f"負荷={total_load_array[hour]:6.2f} kWh, "
                  f"余剰={net_gen_array[hour]:6.2f} kWh")
    print()
    
    # パターンAのシミュレーション
    print("パターンA（通常運転）のシミュレーションを実行中...")
    results_a = simulate_one_day(
        household_load_pattern,
        factory_load_pattern_a,
        public_load_pattern,
        pv_pattern,
        ev_load_pattern,
        NUM_HOUSEHOLDS,
        HOUSEHOLD_BATTERY_CAPACITY,
        SHARED_BATTERY_CAPACITY
    )
    metrics_a = calculate_metrics(results_a)
    
    # デバッグ: パターンBの電力バランスを確認
    print("\n【デバッグ情報: パターンB（昼間負荷集中）の電力バランス】")
    print("=" * 60)
    total_load_array_b = (
        household_load_pattern * NUM_HOUSEHOLDS +
        factory_load_pattern_b +
        public_load_pattern +
        ev_load_pattern * NUM_HOUSEHOLDS
    )
    net_gen_array_b = total_pv_array - total_load_array_b
    
    print(f"total_pv: 最小={np.min(total_pv_array):.2f} kWh, 最大={np.max(total_pv_array):.2f} kWh")
    print(f"total_load: 最小={np.min(total_load_array_b):.2f} kWh, 最大={np.max(total_load_array_b):.2f} kWh")
    print(f"net_generation: 最小={np.min(net_gen_array_b):.2f} kWh, 最大={np.max(net_gen_array_b):.2f} kWh")
    print(f"net_generation > 0 の時間数: {np.sum(net_gen_array_b > 0)} 時間")
    print(f"net_generation < 0 の時間数: {np.sum(net_gen_array_b < 0)} 時間")
    print()
    
    # パターンBのシミュレーション
    print("パターンB（昼間負荷集中）のシミュレーションを実行中...")
    results_b = simulate_one_day(
        household_load_pattern,
        factory_load_pattern_b,
        public_load_pattern,
        pv_pattern,
        ev_load_pattern,
        NUM_HOUSEHOLDS,
        HOUSEHOLD_BATTERY_CAPACITY,
        SHARED_BATTERY_CAPACITY
    )
    metrics_b = calculate_metrics(results_b)
    
    # 結果を表示
    print("\n" + "=" * 60)
    print("シミュレーション結果")
    print("=" * 60)
    
    print("\n【パターンA（通常運転）】")
    print(f"  系統購入電力量合計: {metrics_a['total_grid_purchase']:.2f} kWh")
    print(f"  系統売電電力量合計: {metrics_a['total_grid_sell']:.2f} kWh")
    print(f"  太陽光発電量合計: {metrics_a['total_pv_generation']:.2f} kWh")
    print(f"  太陽光自己消費率: {metrics_a['self_consumption_rate']:.2f} %")
    
    # 蓄電池残量の確認
    total_battery_a = results_a['shared_battery_levels'] + results_a['household_battery_levels']
    print(f"\n【蓄電池残量の確認（パターンA）】")
    print(f"  初期総蓄電池残量: {total_battery_a[0]:.2f} kWh")
    print(f"  最終総蓄電池残量: {total_battery_a[-1]:.2f} kWh")
    print(f"  最大総蓄電池残量: {np.max(total_battery_a):.2f} kWh")
    print(f"  最小総蓄電池残量: {np.min(total_battery_a):.2f} kWh")
    print(f"  売電が発生した時間数: {np.sum(results_a['grid_sells'] > 0)} 時間")
    if np.sum(results_a['grid_sells'] > 0) > 0:
        print(f"  最大売電量: {np.max(results_a['grid_sells']):.2f} kWh")
    
    print("\n【パターンB（昼間負荷集中）】")
    print(f"  系統購入電力量合計: {metrics_b['total_grid_purchase']:.2f} kWh")
    print(f"  系統売電電力量合計: {metrics_b['total_grid_sell']:.2f} kWh")
    print(f"  太陽光発電量合計: {metrics_b['total_pv_generation']:.2f} kWh")
    print(f"  太陽光自己消費率: {metrics_b['self_consumption_rate']:.2f} %")
    
    # 蓄電池残量の確認
    total_battery_b = results_b['shared_battery_levels'] + results_b['household_battery_levels']
    print(f"\n【蓄電池残量の確認（パターンB）】")
    print(f"  初期総蓄電池残量: {total_battery_b[0]:.2f} kWh")
    print(f"  最終総蓄電池残量: {total_battery_b[-1]:.2f} kWh")
    print(f"  最大総蓄電池残量: {np.max(total_battery_b):.2f} kWh")
    print(f"  最小総蓄電池残量: {np.min(total_battery_b):.2f} kWh")
    print(f"  売電が発生した時間数: {np.sum(results_b['grid_sells'] > 0)} 時間")
    if np.sum(results_b['grid_sells'] > 0) > 0:
        print(f"  最大売電量: {np.max(results_b['grid_sells']):.2f} kWh")
    
    print("\n【比較】")
    purchase_diff = metrics_a['total_grid_purchase'] - metrics_b['total_grid_purchase']
    sell_diff = metrics_a['total_grid_sell'] - metrics_b['total_grid_sell']
    print(f"  系統購入電力量の差分（A - B）: {purchase_diff:.2f} kWh")
    print(f"  系統売電電力量の差分（A - B）: {sell_diff:.2f} kWh")
    print(f"  削減率: {purchase_diff / metrics_a['total_grid_purchase'] * 100:.2f} %")
    
    # グラフを描画
    print("\nグラフを生成中...")
    print("【グラフの説明】")
    print("  - 上段左: パターンAの太陽光発電量・総需要・蓄電池残量")
    print("    → 蓄電池残量が昼間に増え、夜間に減ることを確認")
    print("  - 上段右: パターンBの太陽光発電量・総需要・蓄電池残量")
    print("    → パターンBでは昼間負荷集中により、より効率的な自己消費")
    print("  - 下段: 系統購入・売電の推移")
    print("    → 売電が発生する時間帯があることを確認")
    plot_results(results_a, results_b, metrics_a, metrics_b)

if __name__ == "__main__":
    main()

