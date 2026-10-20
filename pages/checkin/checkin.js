const { calculateImpact, formatNumber } = require('../../utils/calc')
const { analyzeLeftover, confidenceLabel, suggestFor } = require('../../utils/vision')
const data = require('../../utils/data')
const store = require('../../utils/store')

/** 识别用缩图长边（与 Web 版一致：480px，留得住米粒纹理）。 */
const ANALYZE_SIZE = 480
/** 存档用压缩长边（Web 版 880px）。 */
const SAVE_SIZE = 880

Page({
  data: {
    safeStyle: '',
    today: '',
    todayRecord: null,
    // 预览与识别
    preview: '',
    analyzing: false,
    vision: null,
    visionLabel: '',
    ratio: null,
    ratioPercent: 0,
    isClean: false,
    // 识别折算的影响
    impactCards: [],
    compareLine: '',
    servingsText: '',
    saving: false,
    error: '',
    // 统计
    streak: 0,
    totalCount: 0,
    monthCount: 0,
    strip: [],
    // 相册
    records: [],
    recognizedCount: 0,
    visionTotalLine: '',
  },

  onShow() {
    this.setData({ safeStyle: getApp().safeStyle() })
    this.refreshRecords()
  },

  /* 转发与朋友圈分享（真机上右上角菜单可用） */
  onShareAppMessage() {
    return { title: '一餐之后 · 校园餐桌行动实验室', path: '/pages/home/home' }
  },
  onShareTimeline() {
    return { title: '一餐之后 · 校园餐桌行动实验室' }
  },

  onHide() {
    this.setData({ preview: '', vision: null, ratio: null, error: '' })
  },

  refreshRecords() {
    const stored = store.loadRecords()
    // 照片按日期存文件，展示时拼出路径；pct 预先四舍五入，避免模板里直出 28.999999999999996 这类浮点长尾
    const records = stored.map((record) => ({
      ...record,
      photo: store.photoPathFor(record.date),
      pct: record.wasteRate === undefined || record.wasteRate === null ? null : Math.round(record.wasteRate * 100),
    }))
    const today = store.todayKey()
    const todayRecord = records.find((record) => record.date === today) || null
    const dates = new Set(records.map((record) => record.date))
    const month = today.slice(0, 7)
    const monthCount = records.filter((record) => record.date.slice(0, 7) === month).length

    const strip = []
    const day = 24 * 60 * 60 * 1000
    for (let i = 13; i >= 0; i -= 1) {
      const current = new Date(Date.now() - i * day)
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      strip.push({ key, day: current.getDate(), on: dates.has(key), isToday: key === today })
    }

    // 识别累计
    let totals = { wasteKg: 0, water: 0, carbon: 0, money: 0 }
    records.forEach((record) => {
      const one = calculateImpact(1, record.wasteRate === undefined ? 0 : record.wasteRate, data.avgPortionKg)
      totals = {
        wasteKg: totals.wasteKg + one.wasteKg,
        water: totals.water + one.water,
        carbon: totals.carbon + one.carbon,
        money: totals.money + one.money,
      }
    })
    const recognizedCount = records.filter((record) => record.wasteRate !== undefined).length

    this.setData({
      records,
      today,
      todayRecord,
      streak: store.streakOf(dates),
      totalCount: records.length,
      monthCount,
      strip,
      recognizedCount,
      visionTotalLine: recognizedCount > 0
        ? `识别过的 ${recognizedCount} 天里，约有 ${formatNumber(totals.wasteKg, 2)}kg 食物没有被吃掉 —— 折合 ${formatNumber(totals.water, 0)}L 水 / ${formatNumber(totals.carbon, 2)}kg CO₂e / ￥${formatNumber(totals.money, 2)}。`
        : '',
    })
  },

  /* ---------- 拍照 / 相册 ---------- */
  takePhoto() {
    this.choose('camera')
  },
  pickAlbum() {
    this.choose('album')
  },
  choose(sourceType) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [sourceType],
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        this.setData({ preview: file.tempFilePath, vision: null, ratio: null, error: '' })
        this.analyze(file.tempFilePath)
      },
      fail: (res) => {
        const msg = res && res.errMsg && res.errMsg.indexOf('cancel') >= 0 ? '' : '没有拿到照片，再试一次'
        if (msg) this.setData({ error: msg })
      },
    })
  },

  /** 通用：把图片画进工作画布（重设尺寸 + dpr 缩放），返回 {canvas, ctx, width, height}。 */
  drawToWorkCanvas(src, maxEdge) {
    return new Promise((resolve, reject) => {
      this.createSelectorQuery()
        .select('#work-canvas')
        .fields({ node: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            reject(new Error('这台设备的画布不可用，识别不了'))
            return
          }
          const canvas = res[0].node
          const img = canvas.createImage()
          img.onload = () => {
            const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
            const width = Math.max(1, Math.round(img.width * scale))
            const height = Math.max(1, Math.round(img.height * scale))
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
            resolve({ canvas, ctx, width, height })
          }
          img.onerror = () => reject(new Error('这张照片读不出来'))
          img.src = src
        })
    })
  },

  /** 照片就位后本地识别一次；失败只是不显示结果，不挡住打卡流程。 */
  analyze(src) {
    this.setData({ analyzing: true })
    this.drawToWorkCanvas(src, ANALYZE_SIZE)
      .then(({ ctx, width, height }) => {
        const imageData = ctx.getImageData(0, 0, width, height)
        const vision = analyzeLeftover({ data: imageData.data, width, height })
        const ratio = vision.ratio
        this.setData({
          vision,
          visionLabel: confidenceLabel(vision.confidence),
          ratio,
          ratioPercent: Math.round(ratio * 100),
        })
        this.refreshImpact(ratio)
      })
      .catch(() => {
        this.setData({ vision: null, ratio: null })
      })
      .finally(() => {
        this.setData({ analyzing: false })
      })
  },

  refreshImpact(ratio) {
    const meal = store.mealNow()
    const impact = calculateImpact(1, ratio || 0, data.avgPortionKg)
    const baseline = data.mealBaselineRate[meal]
    const diffPoints = Math.round(((ratio || 0) - baseline) * 100)
    const compareLine = diffPoints === 0
      ? `和${meal}样本平均（${Math.round(baseline * 100)}%）持平`
      : diffPoints < 0
        ? `比${meal}样本平均（${Math.round(baseline * 100)}%）少剩 ${Math.abs(diffPoints)} 个百分点`
        : `比${meal}样本平均（${Math.round(baseline * 100)}%）多剩 ${diffPoints} 个百分点`
    this.setData({
      impactCards: [
        { label: '被浪费的食物', value: formatNumber(impact.wasteKg), unit: 'kg', art: 'scrap', tone: 'green' },
        { label: '隐含用水', value: formatNumber(impact.water, 0), unit: 'L', art: 'water', tone: 'blue' },
        { label: '碳排放', value: formatNumber(impact.carbon, 1), unit: 'kg CO₂e', art: 'carbon', tone: 'orange' },
        { label: '食物成本', value: formatNumber(impact.money, 1), unit: '元', art: 'money', tone: 'ink' },
      ],
      compareLine,
      servingsText: formatNumber(impact.servings, 1),
      isClean: (ratio || 0) <= 0.03,
      ratioPercent: Math.round((ratio || 0) * 100),
      suggestion: suggestFor(ratio || 0, baseline, meal, (this.data.vision && this.data.vision.confidence) || 'medium'),
    })
  },

  resetPreview() {
    this.setData({ preview: '', vision: null, ratio: null, error: '' })
  },

  /* ---------- 保存打卡 ---------- */
  async saveCheckin() {
    if (!this.data.preview || this.data.saving) return
    this.setData({ saving: true })
    const today = store.todayKey()
    try {
      // 1) 压缩照片到长边 ≤880px 的 JPEG
      const { canvas } = await this.drawToWorkCanvas(this.data.preview, SAVE_SIZE)
      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          fileType: 'jpg',
          quality: 0.72,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        })
      })
      // 2) 照片写入用户目录，记录元数据写 storage
      const ok = await store.savePhoto(today, tempFilePath)
      if (!ok) throw new Error('storage')
      const record = {
        date: today,
        time: new Date().toTimeString().slice(0, 5),
        quote: store.quoteForDate(today),
        wasteRate: this.data.vision && this.data.ratio !== null ? this.data.ratio : undefined,
      }
      const next = [record, ...store.loadRecords().filter((item) => item.date !== today)].slice(0, 60)
      if (!store.saveRecords(next)) throw new Error('storage')
      this.setData({ preview: '', vision: null, ratio: null })
      this.refreshRecords()
      wx.showToast({ title: '打卡成功', icon: 'success' })
    } catch (e) {
      this.setData({ error: '本地存不下这张照片了（空间已满），可以先删掉几天最早的打卡记录' })
    } finally {
      this.setData({ saving: false })
    }
  },

  removeRecord(event) {
    const date = event.currentTarget.dataset.date
    wx.showModal({
      title: '删除这条打卡？',
      content: `${date} 的打卡照片与记录会一起删掉。`,
      confirmText: '删除',
      confirmColor: '#e0763c',
      success: (res) => {
        if (!res.confirm) return
        store.removePhoto(date)
        const next = store.loadRecords().filter((record) => record.date !== date)
        store.saveRecords(next)
        this.refreshRecords()
      },
    })
  },

  previewImage(event) {
    const url = event.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ urls: [url] })
  },
})
