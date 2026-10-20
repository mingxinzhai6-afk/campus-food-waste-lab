const { calculateImpact, formatNumber, formatClock } = require('../../utils/calc')
const data = require('../../utils/data')

const DAY_START_MIN = 6 * 60
const DAY_END_MIN = 21 * 60
const MEAL_MID = { 早餐: 7 * 60 + 30, 午餐: 12 * 60 + 20, 晚餐: 18 * 60 }
const clampMinutes = (v) => Math.min(DAY_END_MIN, Math.max(DAY_START_MIN, v))
const mealOfMinutes = (minutes) => (minutes < 10 * 60 ? '早餐' : minutes < 15 * 60 ? '午餐' : '晚餐')

const REASONS = ['分量偏大', '赶时间离开', '口味不合', '临时有事', '取多了', '其他']

/* ---------- 太阳时钟（CSS 半环刻度盘）几何 ----------
   刻度盘是一段上半个圆：圆心在 track 底边中点，太阳沿半径 65.5 的圆弧移动。 */
const DIAL_SIZE = 140
const DIAL_HEIGHT = 70
const DIAL_RADIUS = 65.5

/** 由时刻算出进度角的度数，以及太阳在刻度盘里的百分比坐标。 */
const dialProgress = (minutes) => {
  const ratio = (clampMinutes(minutes) - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)
  const theta = Math.PI - ratio * Math.PI
  return {
    ratio,
    deg: ratio * 180,
    left: ((DIAL_SIZE / 2 + DIAL_RADIUS * Math.cos(theta)) / DIAL_SIZE) * 100,
    top: ((DIAL_HEIGHT - DIAL_RADIUS * Math.sin(theta)) / DIAL_HEIGHT) * 100,
  }
}

/** 10:00 / 15:00 两个时段分界刻度（静态）。 */
const DIAL_TICKS = [10 * 60, 15 * 60].map((boundary) => {
  const point = dialProgress(boundary)
  const theta = Math.PI - point.ratio * Math.PI
  return {
    label: formatClock(boundary),
    left: Math.round(point.left * 100) / 100,
    top: Math.round(point.top * 100) / 100,
    rot: Math.round(90 - (theta * 180) / Math.PI),
    labelTop: Math.round((point.top + 11) * 100) / 100,
  }
})

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

const canteens = data.cafeteriaInfo.map((info) => ({
  id: info.id,
  name: info.name,
  area: info.area.replace(/^学生/, ''),
  photo: info.photo,
  photoFocus: info.photoFocus || 'center',
  waitLabel: `早 ${info.waitMinutes.早餐} / 午 ${info.waitMinutes.午餐} / 晚 ${info.waitMinutes.晚餐} 分钟`,
  featured: info.featured.slice(0, 3).join(' · '),
  openHours: info.openHours,
}))

/** 根据剩余原因生成解释，不做道德评判（与 Web 版同一段文案）。 */
function explainLeftover(reason) {
  if (reason === '分量偏大') return '分量偏大：这更像是分量本身带来的结果，不是一个人的道德分数。下一次可以先点半份，或者先少取一点。'
  if (reason === '口味不合') return '口味不合：下一次可以先少取一点，把试错成本留在餐盘之外。'
  if (reason === '临时有事') return '临时离席：离席前的一次提醒，可能比离席后的倡议更有效。'
  if (reason === '赶时间离开') return '时间紧张：把“打包带走”提前到点餐时决定，通常比离席前再想办法更容易做到。'
  if (reason === '取多了') return '取多了：先少取、不够再加，是这一餐最直接的调整方式。'
  return `${reason}：把它当成一次观察，而不是一次评判。下一次记录时，可以比较不同食物类型下的差别。`
}

Page({
  data: {
    safeStyle: '',
    step: 'pick',
    canteens,
    reasons: REASONS,
    cafeteria: '学苑餐厅',
    foodSelected: { 主食类: true },
    // 表单状态
    meal: '午餐',
    foodCategories: ['主食类'],
    wasteRate: 1 / 3,
    reason: '分量偏大',
    dayMinutes: 11 * 60 + 40,
    foodList: data.categories.map((item, index) => ({
      name: item,
      photo: data.foodPhotos[item],
      dot: data.CATEGORY_TONES[index],
    })),
    // 实时估算（refresh 时的派生数据）
    wastePercent: 33,
    estimate: {},
    portionLabel: '主食类',
    portionNote: '',
    baselineRate: 0,
    baselineLabel: '',
    ringStyle: '',
    liquidHeight: '0%',
    marks: [],
    stats: [],
    explain: '',
    // 太阳时钟
    clockText: '11:40',
    sunDeg: 0,
    sun: { left: 50, top: 6 },
    dialTicks: DIAL_TICKS,
    sunRays: SUN_RAYS,
    // 开场遮罩
    splash: '',
  },

  onLoad() {
    this.setData({ safeStyle: getApp().safeStyle() })
    const g = getApp().globalData
    const minutes = clampMinutes(g.dayMinutes)
    this.setData({
      meal: g.meal,
      cafeteria: g.cafeteria,
      foodCategories: g.foodCategories,
      foodSelected: this.selectedMap(g.foodCategories),
      wasteRate: g.wasteRate,
      reason: g.reason,
      dayMinutes: minutes,
      step: g.recordStep || 'pick',
      splash: g.splashSeen ? '' : 'in',
    })
    if (!g.splashSeen) {
      this.splashTimer = setTimeout(() => this.dismissSplash(), 2100)
    }
  },

  onUnload() {
    if (this.splashTimer) clearTimeout(this.splashTimer)
  },

  onReady() {
    this.refreshEstimate()
    this.refreshDial()
    if (this.data.step === 'record') this.measureDial()
  },

  dismissSplash() {
    if (!this.data.splash) return
    if (this.splashTimer) clearTimeout(this.splashTimer)
    this.setData({ splash: 'out' })
    setTimeout(() => {
      this.setData({ splash: '' })
      getApp().globalData.splashSeen = true
    }, 480)
  },

  /* ---------- STEP 1：餐厅 ---------- */
  pickCanteen(event) {
    const name = event.currentTarget.dataset.name
    const g = getApp().globalData
    g.cafeteria = name
    g.recordStep = 'record'
    this.setData({
      step: 'record',
      cafeteria: name,
    })
    // 等 wx:else 分支渲染出刻度盘后再量一次它的位置
    setTimeout(() => this.measureDial(), 80)
  },

  backToPick() {
    getApp().globalData.recordStep = 'pick'
    this.setData({ step: 'pick' })
  },

  /* ---------- 太阳时钟：CSS 刻度盘 ---------- */
  /** 量一次刻度盘位置，供拖动时把屏幕坐标换算成角度。 */
  measureDial() {
    this.createSelectorQuery()
      .select('#sun-dial')
      .boundingClientRect()
      .select('.dial-track')
      .boundingClientRect()
      .exec((res) => {
        const outer = res && res[0]
        const track = res && res[1]
        if (!outer || !track || !track.width) {
          this.dialGeom = null
          return
        }
        this.dialGeom = {
          left: outer.left,
          top: outer.top,
          cx: track.left - outer.left + track.width / 2,
          cy: track.top - outer.top + track.height,
        }
      })
  },

  /** 刷新太阳位置、进度弧与中央时间。 */
  refreshDial() {
    const point = dialProgress(this.data.dayMinutes)
    this.setData({
      clockText: formatClock(this.data.dayMinutes),
      sunDeg: Math.round(point.deg * 100) / 100,
      sun: {
        left: Math.round(point.left * 100) / 100,
        top: Math.round(point.top * 100) / 100,
      },
    })
  },

  onSunTouch(event) {
    const touch = event.touches && event.touches[0]
    const geom = this.dialGeom
    if (!touch || !geom) return
    // 普通组件的触摸事件给的是 clientX/clientY（相对窗口），减去刻度盘位置换成盘内坐标
    const rawX = touch.clientX === undefined ? touch.pageX : touch.clientX
    const rawY = touch.clientY === undefined ? touch.pageY : touch.clientY
    const x = Number(rawX)
    const y = Number(rawY)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const dx = x - geom.left - geom.cx
    const dy = geom.cy - (y - geom.top)
    // 手指落在下半平面时，按左右方向吸附到两端
    let theta = Math.atan2(dy, dx)
    if (theta < 0) theta = dx >= 0 ? 0 : Math.PI
    const next = DAY_START_MIN + (1 - theta / Math.PI) * (DAY_END_MIN - DAY_START_MIN)
    this.changeDayTime(Math.round(next / 5) * 5)
  },

  changeDayTime(next) {
    const clamped = clampMinutes(next)
    // 非数值的输入（异常事件等）直接忽略，避免把 NaN 写进页面数据
    if (!Number.isFinite(clamped)) return
    const nextMeal = mealOfMinutes(clamped)
    const patch = { dayMinutes: clamped }
    if (nextMeal !== this.data.meal) patch.meal = nextMeal
    this.setData(patch)
    const g = getApp().globalData
    g.dayMinutes = clamped
    g.meal = nextMeal
    this.refreshDial()
    this.refreshEstimate()
  },

  /* ---------- 主要食物（多选，至少一类） ---------- */
  toggleFood(event) {
    const item = event.currentTarget.dataset.name
    const current = this.data.foodCategories
    let picked = current.indexOf(item) >= 0 ? current.filter((entry) => entry !== item) : current.concat(item)
    if (!picked.length) return
    picked = data.categories.filter((entry) => picked.indexOf(entry) >= 0)
    this.setData({ foodCategories: picked, foodSelected: this.selectedMap(picked) })
    getApp().globalData.foodCategories = picked
    this.refreshEstimate()
  },

  selectedMap(list) {
    const map = {}
    list.forEach((item) => { map[item] = true })
    return map
  },

  onWasteChanging(event) {
    const value = Number(event.detail.value)
    this.setData({ wasteRate: value })
    getApp().globalData.wasteRate = value
    this.refreshEstimate()
  },

  onReasonChange(event) {
    const reason = REASONS[Number(event.detail.value)]
    this.setData({ reason })
    getApp().globalData.reason = reason
    this.refreshEstimate()
  },

  /* ---------- 实时估算 ---------- */
  refreshEstimate() {
    const { meal, foodCategories, wasteRate, reason } = this.data
    const portionKg = data.portionKgFor(foodCategories)
    const estimate = calculateImpact(1, wasteRate, portionKg)
    const wastePercent = Math.round(wasteRate * 100)
    const baselineRate = data.mealBaselineRate[meal]
    const stats = [
      { key: 'kg', tone: 'kg', value: formatNumber(estimate.wasteKg, 3), unit: 'kg 被浪费的食物' },
      { key: 'water', tone: 'water', value: formatNumber(estimate.water, 0), unit: 'L 隐含用水' },
      { key: 'co2', tone: 'co2', value: formatNumber(estimate.carbon, 2), unit: 'kg CO₂e 碳排放' },
      { key: 'money', tone: 'money', value: `￥${formatNumber(estimate.money, 2)}`, unit: '食物成本' },
    ].map((item) => ({ ...item, bar: Math.min(100, wastePercent * 2) }))
    this.setData({
      wastePercent,
      estimate: { wasteKg: estimate.wasteKg, text: formatNumber(estimate.wasteKg, 2) },
      portionLabel: foodCategories.join('、'),
      portionNote: data.portionNote(foodCategories[0]),
      baselineRate,
      baselineLabel: `${meal}样本平均 ${Math.round(baselineRate * 100)}%`,
      ringStyle: `background: conic-gradient(#e0763c 0 ${wastePercent}%, #eae4dc ${wastePercent}% 100%);`,
      liquidHeight: `${wastePercent}%`,
      marks: [0.25, 0.5, 0.75, 1].map((f) => ({
        bottom: `${f * 100}%`,
        label: `${Math.round(portionKg * f * 1000)}g${f === 1 ? ' · 一份' : ''}`,
        top: f === 1,
      })),
      stats,
      explain: explainLeftover(reason),
    })
  },

  goImpact() {
    getApp().go('impact')
  },

  /* 转发与朋友圈分享（真机上右上角菜单可用） */
  onShareAppMessage() {
    return { title: '一餐之后 · 校园餐桌行动实验室', path: '/pages/home/home' }
  },
  onShareTimeline() {
    return { title: '一餐之后 · 校园餐桌行动实验室' }
  },
})
