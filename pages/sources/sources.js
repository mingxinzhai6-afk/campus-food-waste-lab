const data = require('../../utils/data')

Page({
  data: {
    safeStyle: '',
    blocks: [
      { key: '作品简介', text: '《一餐之后：校园餐桌行动实验室》不是普通环保宣传页，而是把个人就餐记录、三个学生餐厅、泔水桶可视化和学生行动策略连接起来的校园行动原型。' },
      { key: '公开资料', text: `后勤餐饮服务指南及其中的学苑餐厅、学海餐厅、学者餐厅、教工餐厅和其他餐饮服务单位名称，来自${data.PUBLIC_SOURCE.name}（${data.PUBLIC_SOURCE.publishedAt}，访问于 ${data.PUBLIC_SOURCE.accessedAt}）。` },
      { key: '公开资料和示例数据分开', text: '公开资料只用于餐厅名称、公开介绍和页面照片归属；泔水重量、桶容量、装满桶数、清运过程、三餐厅对比、策略效果和演示时间与按时段推算的泔水量全部是演示用示例值。' },
    ],
    formulas: [
      '浪费重量 = 就餐份数 × 单份重量 × 剩余比例（记录表单中份数固定为 1 份）',
      '当前泔水量 = 已结束时段产量 + 进行中时段产量 × 时间进度（看板按演示时间推算）',
      '策略后浪费 = 原始浪费 ×（1 − 策略减损率）；策略叠加上限 80%',
      '桶填充率 = 重量 ÷（120L × 85% × 0.75kg/L）',
    ],
    supply: data.supplyChainFields,
    otherUnits: data.otherDiningUnits,
  },

  onLoad() {
    this.setData({ safeStyle: getApp().safeStyle() })
  },

  goHome() {
    getApp().go('home')
  },

  /* 转发与朋友圈分享（真机上右上角菜单可用） */
  onShareAppMessage() {
    return { title: '一餐之后 · 校园餐桌行动实验室', path: '/pages/home/home' }
  },
  onShareTimeline() {
    return { title: '一餐之后 · 校园餐桌行动实验室' }
  },
})
