const { initialState } = require('./utils/store')

const MUSIC_KEY = 'after-meal-music'
const MUSIC_SRC = '/audio/theme.mp3'

App({
  globalData: initialState(),
  musicEnabled: false,
  musicAudio: null,
  onLaunch() {
    let saved = ''
    try { saved = wx.getStorageSync(MUSIC_KEY) || '' } catch (e) { }
    this.musicEnabled = saved === 'on'
    if (this.musicEnabled) this.playMusic()
  },
  onShow() {
    // 从后台回来时补播（音乐默认关闭，只有用户主动开过才会走到这里）
    if (this.musicEnabled && this.musicAudio && this.musicAudio.paused) this.playMusic()
  },
  ensureMusic() {
    if (this.musicAudio) return this.musicAudio
    const audio = wx.createInnerAudioContext()
    audio.src = MUSIC_SRC
    audio.loop = true
    audio.volume = 0.5
    audio.obeyMuteSwitch = false
    this.musicAudio = audio
    return audio
  },
  playMusic() {
    try { this.ensureMusic().play() } catch (e) { /* 设备不支持时静默 */ }
  },
  stopMusic() {
    try { if (this.musicAudio) this.musicAudio.stop() } catch (e) { }
  },
  /** 开关背景音乐，返回最新状态（播放偏好会记在本机） */
  setMusic(on) {
    this.musicEnabled = !!on
    try { wx.setStorageSync(MUSIC_KEY, on ? 'on' : 'off') } catch (e) { }
    if (on) this.playMusic()
    else this.stopMusic()
    return this.musicEnabled
  },
  // 运行时读取安全区（横屏左右=刘海/灵动岛，竖屏底部=Home 指示条），返回可直接绑定的 CSS 变量串
  safeStyle() {
    try {
      const info = wx.getSystemInfoSync()
      const sa = info.safeArea || {}
      const sw = info.screenWidth || 0
      const sh = info.screenHeight || 0
      const left = Math.max(0, Math.round(sa.left || 0))
      const right = Math.max(0, Math.round(sa.right ? sw - sa.right : 0))
      const bottom = Math.max(0, Math.round(sa.bottom ? sh - sa.bottom : 0))
      return `--safe-left:${left}px;--safe-right:${right}px;--safe-bottom:${bottom}px;`
    } catch (e) {
      return ''
    }
  },
  // 页面间跳转统一走 redirectTo：五个主页面像 tab 一样互切，不堆叠页面栈
  go(path) {
    const map = {
      home: '/pages/home/home',
      impact: '/pages/impact/impact',
      campus: '/pages/campus/campus',
      lab: '/pages/lab/lab',
      checkin: '/pages/checkin/checkin',
      sources: '/pages/sources/sources',
    }
    const url = map[path] || path
    if (!url) return
    wx.redirectTo({ url, fail: () => wx.navigateTo({ url }) })
  },
})
