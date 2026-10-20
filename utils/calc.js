/**
 * 计算层：由 Web 版 src/lib/calculations.ts 移植。
 * 系数集中在 utils/data.js（impactFactors / avgPortionKg），口径与 Web 版一致。
 */
const { avgPortionKg, impactFactors } = require('./data')

const finiteNonNegative = (value) => (Number.isFinite(value) ? Math.max(0, value) : 0)
const boundedRate = (value) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/**
 * 估算这一餐的影响。
 * portionKg 是这一餐「一份」的重量：记录页按所选主要食物的类别传入（utils/data.js portionKgFor），
 * 不传时回落到全局平均 0.32kg。
 */
function calculateImpact(servings, wasteRate, portionKg) {
  const unitKg = finiteNonNegative(portionKg || 0) || avgPortionKg
  const wasteKg = finiteNonNegative(servings) * unitKg * boundedRate(wasteRate)
  return {
    wasteKg,
    water: wasteKg * impactFactors.water,
    carbon: wasteKg * impactFactors.carbon,
    money: wasteKg * impactFactors.money,
    servings: unitKg > 0 ? wasteKg / unitKg : 0,
  }
}

/** 已装满的桶数（非负整数）；空数据或无效容量返回 0。 */
function calculateFullBins(currentWasteKg, binCapacityKg) {
  const capacity = finiteNonNegative(binCapacityKg)
  return capacity > 0 ? Math.floor(finiteNonNegative(currentWasteKg) / capacity) : 0
}

/** 当前未满桶的填充率，返回 0—100。 */
function calculateCurrentBinPercent(currentWasteKg, binCapacityKg) {
  const capacity = finiteNonNegative(binCapacityKg)
  if (capacity === 0) return 0
  const remainder = finiteNonNegative(currentWasteKg) % capacity
  return Math.min(100, Math.max(0, (remainder / capacity) * 100))
}

/** 根据泔水重量判断当前桶状态。 */
function calculateBinStatus(currentWasteKg, binCapacityKg) {
  const capacity = finiteNonNegative(binCapacityKg)
  if (capacity === 0) return 'empty'
  const percent = calculateCurrentBinPercent(currentWasteKg, capacity)
  const full = calculateFullBins(currentWasteKg, capacity)
  if (full > 0 && percent === 0) return 'full'
  if (percent >= 90) return 'near-full'
  if (percent === 0) return 'empty'
  return 'in-progress'
}

/** 策略减损率最多按 80% 计算。返回策略后的剩余浪费。 */
function calculateSimulationReduction(baseWasteKg, active) {
  const totalReduction = (active || []).reduce((sum, item) => sum + boundedRate(item && item.reductionRate ? item.reductionRate : 0), 0)
  const reduction = Math.min(0.8, Math.max(0, totalReduction))
  return finiteNonNegative(baseWasteKg) * (1 - reduction)
}

/** 演示日里的三个开餐时段，与首页太阳滑杆的 6:00–21:00 对应。 */
const MEAL_WINDOWS = [
  { meal: '早餐', start: 6 * 60, end: 10 * 60 },
  { meal: '午餐', start: 10 * 60, end: 15 * 60 },
  { meal: '晚餐', start: 15 * 60, end: 21 * 60 },
]

/** 到某时刻为止累计的泔水量：已结束时段全额、进行中时段按时间比例、未开始为 0。 */
function wasteAtTime(minutes, perMeal) {
  const now = Number.isFinite(minutes) ? minutes : 0
  let total = 0
  for (let i = 0; i < MEAL_WINDOWS.length; i += 1) {
    const window = MEAL_WINDOWS[i]
    const amount = finiteNonNegative((perMeal && perMeal[window.meal]) || 0)
    if (now >= window.end) { total += amount; continue }
    if (now > window.start) total += amount * ((now - window.start) / (window.end - window.start))
    break
  }
  return total
}

function aggregateRecords(items) {
  return (items || []).reduce((sum, item) => {
    const impact = calculateImpact(item.servings, item.wasteRate)
    return {
      wasteKg: sum.wasteKg + impact.wasteKg,
      servings: sum.servings + finiteNonNegative(item.servings),
      water: sum.water + impact.water,
      carbon: sum.carbon + impact.carbon,
      money: sum.money + impact.money,
    }
  }, { wasteKg: 0, servings: 0, water: 0, carbon: 0, money: 0 })
}

/** 千分位 + 最多 digits 位小数（不依赖 Intl，真机兼容更稳）。 */
function formatNumber(value, digits) {
  const d = digits === undefined ? 1 : digits
  const num = Number.isFinite(value) ? value : 0
  const fixed = num.toFixed(d)
  const parts = fixed.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (d > 0) {
    parts[1] = parts[1].replace(/0+$/, '')
    if (!parts[1]) return parts[0]
  }
  return parts.join('.')
}

const formatClock = (minutes) => {
  const total = Math.max(0, Math.round(minutes))
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
}

module.exports = {
  calculateImpact,
  calculateFullBins,
  calculateCurrentBinPercent,
  calculateBinStatus,
  calculateSimulationReduction,
  wasteAtTime,
  aggregateRecords,
  formatNumber,
  formatClock,
  MEAL_WINDOWS,
}
