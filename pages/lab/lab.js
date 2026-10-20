const { calculateSimulationReduction, aggregateRecords, formatNumber } = require('../../utils/calc')
const data = require('../../utils/data')

const BIN_CAPACITY_KG = data.binAssumptions.volumeLiters * data.binAssumptions.usableRate * data.binAssumptions.densityKgPerLiter
const SIGNER_KEY = 'after-meal-signer'

const STRATEGY_ART = [
  { id: 'portion', src: '/images/strategy/portion.jpg', caption: '半份菜，按需选择分量' },
  { id: 'less', src: '/images/strategy/less.jpg', caption: '少取一点，不够再加' },
  { id: 'pack', src: '/images/strategy/pack.jpg', caption: '打包带走，不浪费食物' },
  { id: 'check', src: '/images/strategy/check.jpg', caption: '离席前检查一次，不留遗憾' },
]

const artList = STRATEGY_ART.map((art) => {
  const item = data.strategies.find((entry) => entry.id === art.id)
  return { ...art, label: item.label, detail: item.detail, rate: Math.round(item.reductionRate * 100) }
})

// 鼓励语由当前策略组合与减损量生成；同一套组合固定一句，「换一句」再轮换。
const ENCOURAGE_LINES = [
  (c) => `从「${c.focus}」开始，每一餐都算数。`,
  (c) => `一周少浪费 ${c.saved} kg，你正在替校园减负。`,
  (c) => '不必等完美，先做一件小事，就已经在改变。',
  (c) => '今天的一个小选择，会慢慢长成明天的新习惯。',
  (c) => `把「${c.focus}」坚持下去，餐盘会替你记住这份心意。`,
  (c) => '少剩一口，就是多留一份善意给食物和土地。',
  (c) => (c.count > 1
    ? `${c.count} 个行动加在一起，就是校园里看得见的改变。`
    : '一个行动坚持下去，就是校园里看得见的改变。'),
  (c) => '你不需要说服所有人，先照顾好自己的餐盘就好。',
]

const hashText = (text) => {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 9973
  return hash
}

function buildEncouragement(active, saved, offset) {
  if (!active.length) return ''
  const rawFocus = active[0].label || '这件小事'
  const focus = rawFocus.length > 8 ? `${rawFocus.slice(0, 8)}…` : rawFocus
  const context = {
    focus,
    saved: formatNumber(saved),
    count: active.length,
  }
  const seed = hashText(active.map((item) => item.id).sort().join('|'))
  return ENCOURAGE_LINES[(seed + offset) % ENCOURAGE_LINES.length](context)
}

Page({
  data: {
    safeStyle: '',
    artList,
    cafeteria: '学苑餐厅',
    selected: ['portion'],
    selectedMap: { portion: true },
    noneSelected: false,
    hasFocus: true,
    customList: [],
    // 结果
    saved: '',
    reduction: 0,
    ringStyle: '',
    totalWaste: '',
    totalBins: '',
    afterWaste: '',
    afterBins: '',
    beforeCompare: '',
    afterCompare: '',
    beforeGlyphs: [],
    afterGlyphs: [],
    // 行动卡
    planTitle: '先选择一个行动',
    planStat: '',
    planSub: '',
    planItems: [],
    planHasArt: false,
    planArtSrc: '',
    planArtCaption: '',
    encourage: '',
    signerName: '',
    // 自定义行动
    adding: false,
    draftName: '',
    draftRate: 15,
    exporting: false,
  },

  onShow() {
    const g = getApp().globalData
    if (!g.signerName) {
      try { g.signerName = wx.getStorageSync(SIGNER_KEY) || '' } catch (e) { g.signerName = '' }
    }
    this.setData({ safeStyle: getApp().safeStyle(), signerName: g.signerName || '' })
    this.refresh(g.selectedStrategies || ['portion'], g.customStrategies || [])
  },

  refresh(selected, customStrategies) {
    const g = getApp().globalData
    g.selectedStrategies = selected
    g.customStrategies = customStrategies
    const total = aggregateRecords(data.records)
    const active = [
      ...data.strategies.filter((item) => selected.indexOf(item.id) >= 0 && item.id !== 'none'),
      ...customStrategies,
    ]
    const waste = calculateSimulationReduction(total.wasteKg, active)
    const reduction = total.wasteKg ? (1 - waste / total.wasteKg) * 100 : 0
    const saved = total.wasteKg - waste
    const beforeBins = total.wasteKg / BIN_CAPACITY_KG
    const afterBins = waste / BIN_CAPACITY_KG

    const glyphs = (bins) => {
      const count = Math.max(1, Math.ceil(bins))
      const list = []
      for (let i = 0; i < Math.min(count, 12); i += 1) {
        list.push({ fill: `${Math.min(0.92, Math.max(0, bins - i)) * 100}%` })
      }
      return list
    }

    const focusList = active.filter((item) => STRATEGY_ART.some((art) => art.id === item.id))
    const focus = (focusList.length ? focusList : active).slice().sort((a, b) => b.reductionRate - a.reductionRate)[0]
    const focusArt = focus ? STRATEGY_ART.find((art) => art.id === focus.id) : null

    const selectedMap = {}
    selected.forEach((id) => { selectedMap[id] = true })
    const noneSelected = Boolean(selectedMap.none)
    const hasFocus = selected.length > 0 && !(selected.length === 1 && noneSelected)

    this.setData({
      selected,
      selectedMap,
      noneSelected,
      hasFocus,
      customList: customStrategies.map((item) => ({ id: item.id, label: item.label, rate: `-${Math.round(item.reductionRate * 100)}%` })),
      cafeteria: g.cafeteria,
      saved: formatNumber(saved),
      reduction: Math.round(reduction),
      ringStyle: `background: conic-gradient(#58a87a 0 ${Math.round(reduction)}%, #dbe6f0 ${Math.round(reduction)}% 100%);`,
      totalWaste: formatNumber(total.wasteKg),
      totalBins: formatNumber(beforeBins),
      afterWaste: formatNumber(waste),
      afterBins: formatNumber(afterBins),
      afterBar: `${total.wasteKg ? Math.round((waste / total.wasteKg) * 100) : 0}%`,
      binCapacity: formatNumber(BIN_CAPACITY_KG),
      beforeCompare: `${formatNumber(total.wasteKg)}kg · ${formatNumber(beforeBins)}桶`,
      afterCompare: `${formatNumber(waste)}kg · ${formatNumber(afterBins)}桶`,
      beforeGlyphs: glyphs(beforeBins),
      afterGlyphs: glyphs(afterBins),
      planTitle: active.length ? `从「${active.map((item) => item.label).join('、')}」开始` : '先选择一个行动',
      planStat: active.length ? formatNumber(saved) : '',
      planSub: active.length ? `相当于减少了 ${Math.round(reduction)}% 的损耗（大约 ${formatNumber(afterBins)} 桶厨余垃圾）。` : '',
      planItems: active.map((item) => ({ label: item.label, detail: item.detail })),
      planHasArt: Boolean(focusArt),
      planArtSrc: focusArt ? focusArt.src : '',
      planArtCaption: focusArt ? focusArt.caption : '',
      encourage: buildEncouragement(active, saved, g.encourageOffset || 0),
    })
  },

  refreshEncourage() {
    const g = getApp().globalData
    g.encourageOffset = (g.encourageOffset || 0) + 1
    this.refresh(this.data.selected, g.customStrategies || [])
  },

  onSignerName(event) {
    const signerName = event.detail.value
    this.setData({ signerName })
    getApp().globalData.signerName = signerName
    try { wx.setStorageSync(SIGNER_KEY, signerName) } catch (e) { /* 存储失败不影响输入 */ }
  },

  toggleStrategy(event) {
    const id = event.currentTarget.dataset.id
    const g = getApp().globalData
    const selected = this.data.selected
    if (id === 'none') {
      // 「暂不选择」等于清空整套方案，自定义行动也一并撤下
      const clearing = selected.indexOf('none') < 0
      this.refresh(clearing ? [] : ['none'], clearing ? [] : (g.customStrategies || []))
      return
    }
    const withoutNone = selected.filter((item) => item !== 'none')
    const next = withoutNone.indexOf(id) >= 0 ? withoutNone.filter((item) => item !== id) : withoutNone.concat(id)
    this.refresh(next, g.customStrategies || [])
  },

  startAdding() {
    this.setData({ adding: true, draftName: '', draftRate: 15 })
  },
  cancelAdding() {
    this.setData({ adding: false })
  },
  onDraftName(event) {
    this.setData({ draftName: event.detail.value })
  },
  onDraftRate(event) {
    this.setData({ draftRate: Number(event.detail.value) })
  },
  addCustom() {
    const label = (this.data.draftName || '').trim()
    if (!label) return
    const g = getApp().globalData
    const next = (g.customStrategies || []).concat({
      id: `custom-${Date.now()}`,
      label,
      detail: '自定义行动 · 按你的估计计入减损',
      reductionRate: this.data.draftRate / 100,
      icon: '★',
    })
    const selected = (this.data.selected || []).filter((item) => item !== 'none')
    this.setData({ adding: false })
    this.refresh(selected, next)
  },
  removeCustom(event) {
    const id = event.currentTarget.dataset.id
    const g = getApp().globalData
    this.refresh(this.data.selected, (g.customStrategies || []).filter((item) => item.id !== id))
  },

  /** 把行动卡画进 canvas 并保存为图片（替代 Web 版的 PDF 导出）。 */
  async exportCard() {
    if (!this.data.planItems.length || this.data.exporting) return
    this.setData({ exporting: true })
    try {
      const canvas = await new Promise((resolve, reject) => {
        this.createSelectorQuery()
          .select('#plan-canvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            if (res && res[0] && res[0].node) resolve(res[0].node)
            else reject(new Error('画布不可用'))
          })
      })
      const W = 560
      const H = 380
      const dpr = 2
      canvas.width = W * dpr
      canvas.height = H * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      // 纸底 + 手绘边
      ctx.fillStyle = '#f2fbf6'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#35506b'
      ctx.lineWidth = 2.5
      ctx.strokeRect(8, 8, W - 16, H - 16)
      ctx.fillStyle = '#58a87a'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('我的校园减损计划 · 一餐之后', 24, 34)
      ctx.fillStyle = '#2f4256'
      ctx.font = 'bold 19px sans-serif'
      const title = this.data.planTitle
      ctx.fillText(title.length > 18 ? `${title.slice(0, 18)}…` : title, 24, 66)
      if (this.data.planStat) {
        ctx.fillStyle = '#c26130'
        ctx.font = 'bold 22px sans-serif'
        ctx.fillText(`一周预计减少 ${this.data.planStat} kg 食物浪费`, 24, 100)
        ctx.fillStyle = '#5b7186'
        ctx.font = '12px sans-serif'
        ctx.fillText(this.data.planSub, 24, 122)
      } else {
        ctx.fillStyle = '#5b7186'
        ctx.font = '13px sans-serif'
        ctx.fillText('点左侧插画里的任意一格，这里就会生成属于你的行动计划。', 24, 100)
      }
      // 行动清单
      let y = 152
      ctx.fillStyle = '#2f4256'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText('我愿意尝试：', 24, y)
      y += 22
      ctx.font = '12px sans-serif'
      this.data.planItems.slice(0, 4).forEach((item) => {
        ctx.fillStyle = '#58a87a'
        ctx.fillText('✓', 26, y)
        ctx.fillStyle = '#2f4256'
        ctx.fillText(`${item.label}：${item.detail}`.slice(0, 34), 42, y)
        y += 20
      })
      // 鼓励句：与页面上「我的校园减损计划」显示的是同一句
      ctx.fillStyle = '#58a87a'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('鼓励话语', 24, H - 94)
      ctx.fillStyle = '#2f4256'
      ctx.font = 'bold 15px sans-serif'
      const encourage = this.data.encourage || ''
      const encourageText = `“${encourage.length > 30 ? `${encourage.slice(0, 30)}…` : encourage}”`
      ctx.fillText(encourageText, 24, H - 70)
      // 落款：行动人姓名 与 生成日期
      ctx.strokeStyle = '#9aabbb'
      ctx.lineWidth = 1.5
      ctx.fillStyle = '#7d8f9e'
      ctx.font = '11px sans-serif'
      ctx.beginPath()
      ctx.moveTo(24, H - 28)
      ctx.lineTo(190, H - 28)
      ctx.stroke()
      ctx.fillText('行动人', 24, H - 36)
      const signerName = (this.data.signerName || '').trim()
      if (signerName) {
        ctx.fillStyle = '#2f4256'
        ctx.font = 'bold 13px sans-serif'
        ctx.fillText(signerName.slice(0, 12), 62, H - 36)
      }
      ctx.fillStyle = '#7d8f9e'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`一餐之后 · ${new Date().toLocaleDateString('zh-CN')}`, W - 24, H - 28)
      ctx.textAlign = 'left'

      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          fileType: 'jpg',
          quality: 0.92,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        })
      })
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: resolve,
          fail: reject,
        })
      })
      wx.showToast({ title: '行动卡已保存到相册', icon: 'success' })
    } catch (e) {
      const msg = e && e.errMsg && e.errMsg.indexOf('auth') >= 0 ? '需要相册权限才能保存' : '保存失败，请重试'
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ exporting: false })
    }
  },

  goCheckin() {
    getApp().go('checkin')
  },
  goSources() {
    getApp().go('sources')
  },

  /* 转发与朋友圈分享（真机上右上角菜单可用） */
  onShareAppMessage() {
    return { title: '一餐之后 · 校园餐桌行动实验室', path: '/pages/home/home' }
  },
  onShareTimeline() {
    return { title: '一餐之后 · 校园餐桌行动实验室' }
  },
})
