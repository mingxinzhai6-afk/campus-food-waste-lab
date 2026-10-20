const { calculateImpact, formatNumber } = require('../../utils/calc')
const data = require('../../utils/data')

/** 根据剩余原因生成解释，不做道德评判（与记录页同一套文案）。 */
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
    servingsText: '',
    meta: '',
    cards: [],
    sources: [],
    totalMoney: '',
    wastePercent: 0,
    explain: '',
  },

  onShow() {
    this.setData({ safeStyle: getApp().safeStyle() })
    const g = getApp().globalData
    const portionKg = data.portionKgFor(g.foodCategories)
    const impact = calculateImpact(1, g.wasteRate, portionKg)
    const wastePercent = Math.round(g.wasteRate * 100)
    const total = Math.max(0, impact.money)
    this.setData({
      servingsText: formatNumber(impact.servings, 1),
      meta: `${g.cafeteria} · ${g.meal} · ${g.foodCategories.join('、')} · 剩余约 ${wastePercent}%`,
      cards: [
        { label: '被浪费的食物', value: formatNumber(impact.wasteKg), unit: 'kg', art: 'scrap', tone: 'green' },
        { label: '隐含用水', value: formatNumber(impact.water, 0), unit: 'L', art: 'water', tone: 'blue' },
        { label: '碳排放', value: formatNumber(impact.carbon, 1), unit: 'kg CO₂e', art: 'carbon', tone: 'orange' },
        { label: '食物成本', value: formatNumber(impact.money, 1), unit: '元', art: 'money', tone: 'ink' },
      ],
      sources: [
        { label: '学生本次餐费支付', note: '不是学费；本次就餐直接支付', value: `￥${formatNumber(total * 0.7, 2)}`, percent: '70%', tone: 'student' },
        { label: '学校后勤运营支持', note: '学校运营支持比例', value: `￥${formatNumber(total * 0.2, 2)}`, percent: '20%', tone: 'school' },
        { label: '公共财政 / 专项支持', note: '公共支持比例', value: `￥${formatNumber(total * 0.1, 2)}`, percent: '10%', tone: 'public' },
      ],
      totalMoney: formatNumber(total, 2),
      wastePercent,
      explain: explainLeftover(g.reason),
    })
  },

  goCampus() {
    getApp().go('campus')
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
