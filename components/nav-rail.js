const NAV_ITEMS = [
  { id: 'home', label: '记录一餐', icon: '🍽' },
  { id: 'impact', label: '我的影响', icon: '🌱' },
  { id: 'campus', label: '校园看板', icon: '📊' },
  { id: 'lab', label: '策略实验室', icon: '🧪' },
  { id: 'checkin', label: '每日打卡', icon: '📷' },
]

Component({
  properties: {
    active: { type: String, value: 'home' },
  },
  data: {
    items: NAV_ITEMS,
    // 运行时读取系统安全区（横屏时左右为刘海/灵动岛，竖屏时底部为 Home 指示条），
    // 不依赖 WXSS 的 env()（开发者工具里不一定生效），真机与模拟器都能让开。
    safeLeft: 0,
    safeRight: 0,
    safeBottom: 0,
    // 背景音乐开关状态（由 app.js 统一持有音频实例，跨页面连续播放）
    musicOn: false,
  },
  attached() {
    try {
      const info = wx.getSystemInfoSync()
      const sa = info.safeArea || {}
      const sw = info.screenWidth || 0
      const sh = info.screenHeight || 0
      this.setData({
        safeLeft: Math.max(0, Math.round(sa.left || 0)),
        safeRight: Math.max(0, Math.round(sa.right ? sw - sa.right : 0)),
        safeBottom: Math.max(0, Math.round(sa.bottom ? sh - sa.bottom : 0)),
      })
    } catch (e) {
      // 取不到就保持 0
    }
    this.syncMusic()
  },
  pageLifetimes: {
    show() {
      this.syncMusic()
    },
  },
  methods: {
    syncMusic() {
      try {
        this.setData({ musicOn: !!getApp().musicEnabled })
      } catch (e) { }
    },
    toggleMusic() {
      const app = getApp()
      const on = app.setMusic(!app.musicEnabled)
      this.setData({ musicOn: !!on })
      if (!on) {
        wx.showToast({ title: '背景音乐已关闭', icon: 'none', duration: 1200 })
        return
      }
      // 读实际音频时长：能一眼确认加载到的是整首还是片段
      const audio = app.musicAudio
      let done = false
      const show = () => {
        if (done || !audio) return
        done = true
        const d = audio.duration || 0
        if (d > 1) {
          const mm = Math.floor(d / 60)
          const ss = Math.round(d % 60)
          wx.showToast({ title: '背景音乐已开启 · ' + mm + ':' + String(ss).padStart(2, '0'), icon: 'none', duration: 1600 })
        } else {
          wx.showToast({ title: '背景音乐已开启', icon: 'none', duration: 1200 })
        }
      }
      setTimeout(show, 600)
    },
    go(event) {
      const id = event.currentTarget.dataset.id
      if (id === this.data.active) return
      getApp().go(id === 'sources' ? '/pages/sources/sources' : id)
    },
  },
})
