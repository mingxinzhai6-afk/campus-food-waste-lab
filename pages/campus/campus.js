const {
  calculateImpact,
  calculateFullBins,
  calculateCurrentBinPercent,
  calculateBinStatus,
  wasteAtTime,
  aggregateRecords,
  formatNumber,
  formatClock,
} = require('../../utils/calc')
const data = require('../../utils/data')
const chart = require('../../utils/chart')

const DAY_START_MIN = 6 * 60
const DAY_END_MIN = 21 * 60
const MEAL_MID = { 早餐: 7 * 60 + 30, 午餐: 12 * 60 + 20, 晚餐: 18 * 60 }
const SIM_HOURS = []
for (let h = 6; h <= 21; h += 1) SIM_HOURS.push(h)
const SIM_MINUTES = []
for (let m = 0; m < 60; m += 5) SIM_MINUTES.push(m)
const MEAL_TONES = ['#8fbdec', '#eea46a', '#8cc7a8']
const CANTEEN_TONES = { 学苑餐厅: '#4a86c8', 学海餐厅: '#e0763c', 学者餐厅: '#58a87a' }
const STATUS_TEXT = { empty: '空桶待装', 'in-progress': '正在装载', 'near-full': '接近满桶', full: '整桶装满' }
const BIN_CAPACITY_KG = data.binAssumptions.volumeLiters * data.binAssumptions.usableRate * data.binAssumptions.densityKgPerLiter

/* ---------- 图表数据模型（静态部分只算一次） ---------- */

const LABELS = data.campusCafeterias.map((item) => item.name)
const MEAL_SERIES = data.meals.map((meal, i) => ({
  name: meal,
  color: MEAL_TONES[i],
  data: data.campusCafeterias.map((info) => ((info.meals.find((item) => item.meal === meal) || {}).simulatedWasteKg) || 0),
}))
const BAR_MODEL = chart.stackedBarModel(LABELS, MEAL_SERIES)

const MENU_POINTS = []
data.cafeteriaInfo.forEach((info) => {
  info.menu.slice(0, 6).forEach((item) => MENU_POINTS.push({ x: item.price, y: item.portionG / 10, name: item.name }))
})
const SCATTER_MODEL = chart.scatterModel(MENU_POINTS)

Page({
  data: {
    safeStyle: '',
    simHours: SIM_HOURS,
    simMinutes: SIM_MINUTES,
    simIndex: [5, 8],
    clock: '11:40',
    playing: true,
    playLabel: '⏸ 暂停演示',
    flagText: '演示进行中',
    flagLive: true,
    mealChips: data.meals.map((meal) => ({ meal, clock: formatClock(MEAL_MID[meal]) })),
    activeMeal: '午餐',
    // 三食堂当前状态
    rows: [],
    maxWaste: 1,
    // 图表
    mealLegend: data.meals.map((meal, i) => ({ meal, color: MEAL_TONES[i] })),
    barsView: { ticks: BAR_MODEL.ticks, bars: BAR_MODEL.bars, big: false },
    barsViewBig: { ticks: BAR_MODEL.ticks, bars: BAR_MODEL.bars, big: true },
    scatterView: { ticks: SCATTER_MODEL.ticks, xTicks: SCATTER_MODEL.xTicks, dots: SCATTER_MODEL.dots, big: false },
    scatterViewBig: { ticks: SCATTER_MODEL.ticks, xTicks: SCATTER_MODEL.xTicks, dots: SCATTER_MODEL.dots, big: true },
    // 装载结构环形（随演示时间更新）
    fillRingStyle: '',
    fillTotal: '',
    fillLegend: [],
    // 类别构成
    ringStyle: '',
    ringCenter: '',
    ringLegend: [],
    // 表格
    detailId: '',
    mealTable: [],
    actions: [],
    totalWaste: '',
    // 放大浮层
    zoom: '',
    zoomTitle: '',
    zoomKicker: '',
    zoomSub: '',
  },

  onLoad() {
    this.setData({ safeStyle: getApp().safeStyle() })
    const total = aggregateRecords(data.records)
    this.totalWasteKg = total.wasteKg
    const actions = data.strategies.filter((item) => item.id !== 'none').map((item) => ({
      label: item.label,
      detail: item.detail,
      rate: `-${Math.round(item.reductionRate * 100)}%`,
    }))
    this.setData({ totalWaste: formatNumber(total.wasteKg), actions })
    // 三餐拆解表（静态）
    const mealTable = data.campusCafeterias.map((info) => {
      const sum = info.meals.reduce((s, item) => s + item.simulatedWasteKg, 0)
      const lunch = (info.meals.find((item) => item.meal === '午餐') || {}).simulatedWasteKg || 0
      return {
        id: info.id,
        name: info.name,
        area: info.livingArea,
        cells: info.meals.map((item) => ({ meal: item.meal, kg: item.simulatedWasteKg, bar: Math.min(100, (item.simulatedWasteKg / 160) * 100) })),
        lunchShare: `${Math.round((lunch / sum) * 100)}%`,
      }
    })
    this.setData({ mealTable })
    // 类别构成（静态）
    this.buildCategoryRing()
  },

  onShow() {
    const minutes = getApp().globalData.simulationMinutes || 11 * 60 + 40
    const playing = getApp().globalData.simulationPlaying !== false
    this.applySim(minutes, playing)
  },

  onHide() {
    this.stopTimer()
    const g = getApp().globalData
    g.simulationMinutes = this.minutes
    g.simulationPlaying = this.playing
  },

  onUnload() {
    this.stopTimer()
  },

  /* ---------- 演示时间 ---------- */
  applySim(minutes, playing) {
    this.minutes = minutes
    this.playing = playing && minutes < DAY_END_MIN
    const hourIdx = Math.min(SIM_HOURS.length - 1, Math.max(0, Math.floor(minutes / 60) - 6))
    const minIdx = Math.max(0, SIM_MINUTES.indexOf(Math.floor((minutes % 60) / 5) * 5))
    this.updateRows()
    this.setData({
      simIndex: [hourIdx, minIdx],
      clock: formatClock(this.minutes),
      playing: this.playing,
      playLabel: this.playing ? '⏸ 暂停演示' : '▶ 继续演示',
      flagText: this.playing ? '演示进行中' : this.minutes >= DAY_END_MIN ? '已到 21:00' : '已暂停',
      flagLive: this.playing,
      activeMeal: this.minutes < 10 * 60 ? '早餐' : this.minutes < 15 * 60 ? '午餐' : '晚餐',
    })
    if (this.playing) this.startTimer()
    else this.stopTimer()
  },

  startTimer() {
    this.stopTimer()
    this.timer = setInterval(() => {
      const next = Math.min(DAY_END_MIN, this.minutes + 10)
      this.applySim(next, next < DAY_END_MIN)
    }, 2000)
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  onSimWheel(event) {
    const value = event.detail.value
    const hour = SIM_HOURS[value[0]]
    const minute = SIM_MINUTES[value[1]]
    this.applySim(Math.min(DAY_END_MIN, hour * 60 + minute), false)
  },

  /** 用户一开始拨动滚轮就停掉自动播放，免得每 2 秒的推进把刚选的时刻顶回去。 */
  onSimPickStart() {
    if (this.playing) this.applySim(this.minutes, false)
  },

  pickMeal(event) {
    const meal = event.currentTarget.dataset.meal
    this.applySim(MEAL_MID[meal], false)
  },

  togglePlay() {
    const next = this.minutes >= DAY_END_MIN ? DAY_START_MIN : this.minutes
    this.applySim(next, !this.playing)
  },

  resetSim() {
    this.applySim(11 * 60 + 40, true)
  },

  /** 三食堂当前泔水量：完全由演示时间推算。 */
  updateRows() {
    const dayWaste = data.campusCafeterias.map((info) => {
      const per = {}
      info.meals.forEach((m) => { per[m.meal] = m.simulatedWasteKg })
      return wasteAtTime(DAY_END_MIN, per)
    })
    const maxDay = Math.max.apply(null, dayWaste.concat([1]))
    const rows = data.campusCafeterias.map((info) => {
      const perMeal = {}
      info.meals.forEach((item) => { perMeal[item.meal] = item.simulatedWasteKg })
      const currentWasteKg = wasteAtTime(this.minutes, perMeal)
      const percent = calculateCurrentBinPercent(currentWasteKg, info.binCapacityKg)
      return {
        id: info.id,
        name: info.name,
        area: info.livingArea,
        current: formatNumber(currentWasteKg),
        currentRaw: currentWasteKg,
        fullBins: calculateFullBins(currentWasteKg, info.binCapacityKg),
        percent: Math.round(percent),
        percentBar: Math.round(percent),
        fillBar: Math.round((currentWasteKg / maxDay) * 100),
        statusText: STATUS_TEXT[calculateBinStatus(currentWasteKg, info.binCapacityKg)],
        nearFull: calculateBinStatus(currentWasteKg, info.binCapacityKg) === 'near-full',
        capacity: formatNumber(info.binCapacityKg),
      }
    })
    this.rows = rows
    this.setData({ rows })
    this.buildFillRing()
  },

  /** 装载构成环形：随演示时间更新（CSS conic-gradient，不用 canvas）。 */
  buildFillRing() {
    if (!this.rows || !this.rows.length) return
    const model = chart.ringModel(this.rows.map((row) => ({
      label: row.name,
      value: Math.max(0, row.currentRaw),
      color: CANTEEN_TONES[row.name],
    })), 'kg · 当前合计')
    this.setData({
      fillRingStyle: model.style,
      fillTotal: model.center,
      fillLegend: model.legend,
    })
  },

  /** 类别构成：CSS conic 环 + 图例（与 Web 版 RingBreakdown 同一套数据）。 */
  buildCategoryRing() {
    const items = data.categories.map((category, index) => {
      const list = data.records.filter((item) => item.category === category)
      const kg = list.reduce((sum, item) => sum + calculateImpact(item.servings, item.wasteRate).wasteKg, 0)
      return { label: category, value: kg, color: data.CATEGORY_TONES[index] }
    })
    const model = chart.ringModel(items, 'kg · 样本合计')
    this.setData({
      ringStyle: model.style,
      ringCenter: model.center,
      ringLegend: model.legend,
    })
  },

  /* ---------- 表格 ---------- */
  toggleDetail(event) {
    const id = event.currentTarget.dataset.id
    this.setData({ detailId: this.data.detailId === id ? '' : id })
  },

  /* ---------- 放大浮层 ---------- */
  openZoom(event) {
    const id = event.currentTarget.dataset.id
    const titles = {
      'viz-fill': { kicker: '装载结构', title: '三食堂当前重量构成' },
      'viz-meal': { kicker: '时段贡献', title: '早餐 / 午餐 / 晚餐重量堆叠' },
      'viz-menu': { kicker: '菜品画像', title: '价格 × 分量散点图', sub: '每个点是一个演示菜品 · 横轴价格 ￥ · 纵轴分量 g/10' },
      'viz-ring': { kicker: '类别构成', title: '五类食物的泔水占比', sub: '按主要食物汇总 · 主食类占约六成' },
    }
    const meta = titles[id] || {}
    this.zoom = id
    this.setData({
      zoom: id,
      zoomKicker: meta.kicker || '',
      zoomTitle: meta.title || '',
      zoomSub: meta.sub || '',
    })
    this.stopTimer()
  },

  closeZoom() {
    this.zoom = ''
    this.setData({ zoom: '' })
    if (this.playing) this.startTimer()
  },

  noop() {},

  goLab() {
    getApp().go('lab')
  },

  /* 转发与朋友圈分享（真机上右上角菜单可用） */
  onShareAppMessage() {
    return { title: '一餐之后 · 校园餐桌行动实验室', path: '/pages/home/home' }
  },
  onShareTimeline() {
    return { title: '一餐之后 · 校园餐桌行动实验室' }
  },
})
