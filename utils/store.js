/**
 * 全局共享状态 + 每日打卡的本地存储。
 * 五个主页面像 tab 一样通过 redirectTo 互切，共享状态放在 app.globalData（utils/store.js 的形状）。
 * 打卡照片存成用户目录下的文件（wx.env.USER_DATA_PATH），storage 里只存记录元数据，
 * 避免 storage 单 key 1MB 的上限。
 */

const initialState = () => ({
  // 记录一餐（home/impact 共享）
  cafeteria: '学苑餐厅',
  meal: '午餐',
  foodCategories: ['主食类'],
  wasteRate: 1 / 3,
  reason: '分量偏大',
  dayMinutes: 11 * 60 + 40,
  // 策略实验室
  selectedStrategies: ['portion'],
  customStrategies: [],
})

/* ---------- 每日打卡的本地存储 ---------- */

const STORAGE_KEY = 'after-meal-checkins'
const MAX_RECORDS = 60

/** 打卡鼓励语：按日期轮换，同一天不变，隔天换一句。 */
const QUOTES = [
  '今天的光盘，是给地球的一个温柔拥抱。',
  '一粥一饭，当思来处不易；光盘一顿，就是一次担当。',
  '你少倒的每一口饭，都会让食堂的泔水桶更轻一点。',
  '光盘不是小气，是对劳动最好的尊重。',
  '谁知盘中餐，粒粒皆辛苦——今天你也做到了。',
  '每一次按需取餐，都是给未来的自己存下一份资源。',
  '省下一粒米，滋养一方田；今天打卡的你，在发光。',
  '少盛一点、光盘一次，你就是校园减损的同行者。',
  '餐盘干净的样子，是校园最美的风景。',
  '粒米不弃，是刻在饭桌上的教养。',
  '你的每一次光盘，都在替食堂少倒一桶泔水。',
  '节约粮食不是口号，是你今天饭桌上的一个小决定。',
  '把饭吃干净的人，运气都不会太差。',
  '一餐一饭，皆有来路；心存感恩，才能行稳致远。',
  '今天的你和食堂叔叔阿姨一起节约了粮食，谢谢你！',
  '光盘行动，从这一餐开始，由你接力。',
  '惜食如金，惜福如春；打卡成功，明天继续！',
  '每一份被吃干净的饭，都是对土地和阳光最好的报答。',
]

const pad2 = (n) => String(n).padStart(2, '0')

const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

const quoteForDate = (date) => {
  let hash = 11
  for (let i = 0; i < date.length; i += 1) hash = (hash * 31 + date.charCodeAt(i)) % 9973
  return QUOTES[hash % QUOTES.length]
}

/** 现在属于哪一餐：与首页太阳滑杆、看板时段划分同一套边界。 */
const mealNow = () => {
  const hour = new Date().getHours()
  return hour < 10 ? '早餐' : hour < 15 ? '午餐' : '晚餐'
}

const photoDir = () => `${wx.env.USER_DATA_PATH}/checkins`

const ensurePhotoDir = () => {
  try {
    wx.getFileSystemManager().mkdirSync(photoDir(), true)
  } catch (e) {
    // 目录已存在等情况静默
  }
}

const photoPathFor = (date) => `${photoDir()}/${date}.jpg`

const loadRecords = () => {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

const saveRecords = (list) => {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    return false
  }
}

/** 把压缩后的照片写入用户目录；失败返回 false（空间不足等）。 */
const savePhoto = (date, tempFilePath) => new Promise((resolve) => {
  ensurePhotoDir()
  wx.getFileSystemManager().saveFile({
    tempFilePath,
    filePath: photoPathFor(date),
    success: () => resolve(true),
    fail: () => resolve(false),
  })
})

const removePhoto = (date) => {
  try {
    wx.getFileSystemManager().unlinkSync(photoPathFor(date))
  } catch (e) {
    // 文件可能不存在
  }
}

/** 从今天（或昨天）往前数连续打卡天数：断一天就停。 */
const streakOf = (dates) => {
  const day = 24 * 60 * 60 * 1000
  const start = dates.has(todayKey()) ? new Date() : new Date(Date.now() - day)
  let streak = 0
  for (let offset = 0; offset < 3650; offset += 1) {
    const current = new Date(start.getTime() - offset * day)
    const key = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`
    if (!dates.has(key)) break
    streak += 1
  }
  return streak
}

module.exports = {
  initialState,
  QUOTES,
  todayKey,
  quoteForDate,
  mealNow,
  loadRecords,
  saveRecords,
  savePhoto,
  removePhoto,
  photoPathFor,
  streakOf,
}
