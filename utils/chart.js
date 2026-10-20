/**
 * 手绘风图表的「数据模型」：只算几何与比例，交给 WXML + WXSS 渲染。
 *
 * 为什么不用 canvas：canvas 是原生组件，在部分运行环境（如开发者工具模拟器）
 * 里会被合成到独立图层，页面滚动时图形不跟随、残留在屏幕原处。
 * 改成普通元素 + CSS 渐变/绝对定位后，图形和文字一样走同层渲染，滚动正常。
 */
const { formatNumber } = require('./calc')

/** 坐标轴「好看」的最大值：1 / 1.2 / 1.5 / 2 … × 10^n。 */
function niceMax(value) {
  if (value <= 0) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const scaled = value / pow
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  for (let i = 0; i < steps.length; i += 1) {
    if (scaled <= steps[i]) return steps[i] * pow
  }
  return 10 * pow
}

const tickLabel = (tick) => (tick % 1 === 0 ? String(tick) : tick.toFixed(0))

/** 堆叠柱：labels / series（自底向上）-> 轴刻度 + 每根柱子的分段高度百分比。 */
function stackedBarModel(labels, series, stepCount) {
  const steps = stepCount === undefined ? 3 : stepCount
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.data[i] || 0), 0))
  const max = niceMax(Math.max.apply(null, totals.concat([1])))
  const ticks = []
  for (let i = 0; i <= steps; i += 1) ticks.push((max / steps) * i)
  return {
    max,
    ticks: ticks.map((tick) => ({ pos: (tick / max) * 100, label: tickLabel(tick) })),
    bars: labels.map((name, i) => ({
      name,
      segs: series.map((s) => ({
        meal: s.name || s.meal,
        color: s.color,
        h: ((s.data[i] || 0) / max) * 100,
      })),
    })),
  }
}

/** 散点：points -> 轴上限、纵向刻度、每个点的百分比坐标。 */
function scatterModel(points) {
  const list = points || []
  const maxX = niceMax(Math.max.apply(null, list.map((p) => p.x).concat([1])))
  const maxY = niceMax(Math.max.apply(null, list.map((p) => p.y).concat([1])))
  return {
    maxX,
    maxY,
    ticks: [0, maxY / 2, maxY].map((tick) => ({ pos: (tick / maxY) * 100, label: tickLabel(tick) })),
    xTicks: [0, maxX / 2, maxX].map((tick) => ({ label: tickLabel(tick) })),
    dots: list.map((p, i) => ({
      key: `${p.name || 'p'}-${i}`,
      left: (p.x / maxX) * 100,
      bottom: (p.y / maxY) * 100,
    })),
  }
}

/** 环形图：items（[{label,value,color}]）-> conic-gradient 背景、中心数值、图例。 */
function ringModel(items, centerCap) {
  const list = (items || []).filter((item) => item.value > 0)
  const total = list.reduce((sum, item) => sum + item.value, 0) || 1
  let passed = 0
  const stops = []
  const legend = []
  list.forEach((item) => {
    const startDeg = (passed / total) * 360
    passed += item.value
    const endDeg = (passed / total) * 360
    stops.push(`${item.color} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`)
    legend.push({
      label: item.label,
      color: item.color,
      pct: `${Math.round((item.value / total) * 100)}%`,
      kg: formatNumber(item.value, 1),
    })
  })
  return {
    style: `background: conic-gradient(${stops.join(', ')});`,
    center: formatNumber(total, 1),
    cap: centerCap || '',
    legend,
  }
}

module.exports = { niceMax, stackedBarModel, scatterModel, ringModel }
