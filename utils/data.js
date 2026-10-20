/**
 * 数据层：由 Web 版 src/data/ 的四个文件合并移植。
 * mealData / campusSimulation / campusFood 为演示用示例数据；
 * portionModel 的单份重量统计仍由菜单 portionG 现场推算，保证数字可复算。
 */

const categories = ['主食类', '素菜类', '荤菜类', '汤粥类', '水果/副食']
const cafeterias = ['学苑餐厅', '学海餐厅', '学者餐厅']
const meals = ['早餐', '午餐', '晚餐']

const strategies = [
  { id: 'portion', label: '半份菜', detail: '按需选择分量，减少“吃不完”的起点', reductionRate: 0.18, icon: '◐' },
  { id: 'less', label: '少取一点', detail: '先少取，不够再加，把试错成本留在餐盘之外', reductionRate: 0.14, icon: '◔' },
  { id: 'pack', label: '打包带走', detail: '吃不完就打包，把食物带离餐盘', reductionRate: 0.16, icon: '□' },
  { id: 'check', label: '离席前检查一次', detail: '离席前看一眼餐盘，一次提醒比一句倡议更直接', reductionRate: 0.08, icon: '✓' },
  { id: 'none', label: '暂不选择', detail: '现在不改变，也是真实的选择，可以随时回来', reductionRate: 0, icon: '○' },
]

const records = [
  { id: '1', cafeteria: '学苑餐厅', meal: '早餐', category: '主食类', servings: 112, wasteRate: 0.16, sourceType: '示例值' },
  { id: '2', cafeteria: '学苑餐厅', meal: '午餐', category: '主食类', servings: 268, wasteRate: 0.22, sourceType: '示例值' },
  { id: '3', cafeteria: '学苑餐厅', meal: '晚餐', category: '荤菜类', servings: 214, wasteRate: 0.19, sourceType: '示例值' },
  { id: '4', cafeteria: '学苑餐厅', meal: '午餐', category: '素菜类', servings: 154, wasteRate: 0.14, sourceType: '示例值' },
  { id: '5', cafeteria: '学海餐厅', meal: '早餐', category: '汤粥类', servings: 98, wasteRate: 0.12, sourceType: '示例值' },
  { id: '6', cafeteria: '学海餐厅', meal: '午餐', category: '主食类', servings: 302, wasteRate: 0.25, sourceType: '示例值' },
  { id: '7', cafeteria: '学海餐厅', meal: '晚餐', category: '主食类', servings: 240, wasteRate: 0.18, sourceType: '示例值' },
  { id: '8', cafeteria: '学海餐厅', meal: '晚餐', category: '素菜类', servings: 128, wasteRate: 0.13, sourceType: '示例值' },
  { id: '9', cafeteria: '学者餐厅', meal: '早餐', category: '汤粥类', servings: 130, wasteRate: 0.15, sourceType: '示例值' },
  { id: '10', cafeteria: '学者餐厅', meal: '午餐', category: '荤菜类', servings: 224, wasteRate: 0.21, sourceType: '示例值' },
  { id: '11', cafeteria: '学者餐厅', meal: '午餐', category: '主食类', servings: 286, wasteRate: 0.23, sourceType: '示例值' },
  { id: '12', cafeteria: '学者餐厅', meal: '晚餐', category: '水果/副食', servings: 176, wasteRate: 0.16, sourceType: '示例值' },
]

const impactFactors = { water: 35, carbon: 1.8, money: 4.2 }
const avgPortionKg = 0.32

const PUBLIC_SOURCE = {
  name: '后勤管理处《后勤餐饮服务指南——美食掠影》',
  publishedAt: '2020-09-18',
  accessedAt: '2026-10-02',
  credit: '图片来源：后勤管理处公开页面',
}

const cafeteriaInfo = [
  {
    id: 'xueyuan',
    name: '学苑餐厅',
    area: '学生生活区 A 区',
    openHours: '06:30–21:00',
    waitMinutes: { 早餐: 4, 午餐: 9, 晚餐: 7 },
    featured: ['潍坊火烧', '川面坊', '淮南牛肉汤', '麻辣香锅', '锡纸饭'],
    photo: '/images/canteen/xueyuan-01.jpg',
    photoFocus: 'center 72%',
    intro: '公开资料称位于学生生活区 A 区，分一、二两层，合计 37 个经营班组，由传统食堂与特色小吃档口构成。',
    menu: [
      { name: '潍坊火烧', price: 5, portionG: 120 },
      { name: '川面坊小面', price: 11, portionG: 450 },
      { name: '淮南牛肉汤', price: 12, portionG: 500 },
      { name: '麻辣香锅', price: 14, portionG: 550 },
      { name: '锡纸饭', price: 13, portionG: 520 },
      { name: '大锅时蔬', price: 6, portionG: 200 },
      { name: '半份盖饭', price: 8, portionG: 260 },
      { name: '花甲粉', price: 12, portionG: 430 },
      { name: '刀削面', price: 10, portionG: 460 },
      { name: '桂林米粉', price: 11, portionG: 450 },
      { name: '口留香小吃', price: 8, portionG: 240 },
      { name: '酱香鸡腿盖饭', price: 13, portionG: 420 },
    ],
  },
  {
    id: 'xuehai',
    name: '学海餐厅',
    area: '学生生活区 B 区',
    openHours: '06:30–21:30',
    waitMinutes: { 早餐: 5, 午餐: 12, 晚餐: 9 },
    featured: ['清真拉面', '臊子面', '饸饹面', '重庆小面', '五谷鱼粉'],
    photo: '/images/canteen/xuehai-01.jpg',
    intro: '公开资料称位于学生生活区 B 区，一楼主营清真拉面、主食花样、炸酱货、臊子面、水饺与中锅炒菜，二楼为特色小吃。',
    menu: [
      { name: '清真特色拉面', price: 10, portionG: 480 },
      { name: '臊子面', price: 10, portionG: 470 },
      { name: '特色水饺（小份）', price: 9, portionG: 260 },
      { name: '重庆小面', price: 12, portionG: 460 },
      { name: '饸饹面', price: 12, portionG: 480 },
      { name: '五谷鱼粉', price: 12, portionG: 520 },
      { name: '小份中锅菜', price: 7, portionG: 200 },
      { name: '炸酱面', price: 9, portionG: 430 },
      { name: '麻辣香锅', price: 14, portionG: 520 },
      { name: '淮南牛肉汤', price: 12, portionG: 500 },
      { name: '特色水饺（大份）', price: 13, portionG: 380 },
    ],
  },
  {
    id: 'xuezhe',
    name: '学者餐厅',
    area: '学生生活区 C 区',
    openHours: '06:30–21:00',
    waitMinutes: { 早餐: 4, 午餐: 10, 晚餐: 8 },
    featured: ['水煮肉片', '梅菜扣肉', '麻婆豆腐', '特色辣子鸡', '特色面食'],
    photo: '/images/canteen/xuezhe-01.jpg',
    intro: '公开资料称位于学生生活区 C 区，分一、二两层，就餐面积 4000 多平方米，由十个经营班组组成，每餐保证 20 多种菜品可选。',
    menu: [
      { name: '水煮肉片', price: 14, portionG: 400 },
      { name: '梅菜扣肉', price: 14, portionG: 350 },
      { name: '麻婆豆腐', price: 7, portionG: 250 },
      { name: '特色辣子鸡', price: 14, portionG: 380 },
      { name: '家常大锅菜', price: 6, portionG: 220 },
      { name: '特色面食', price: 5, portionG: 130 },
      { name: '半份中锅菜', price: 9, portionG: 200 },
      { name: '半份梅菜扣肉', price: 9, portionG: 210 },
      { name: '半份特色辣子鸡', price: 10, portionG: 220 },
      { name: '小份家常大锅菜', price: 6, portionG: 180 },
      { name: '花样面食', price: 7, portionG: 180 },
      { name: '特色蛋糕', price: 8, portionG: 160 },
    ],
  },
]

const otherDiningUnits = [
  { name: '教工餐厅', area: '学生生活区 B 区（学海餐厅三楼，公开资料）' },
  { name: '风味餐厅小炒店', area: '学生生活区 C 区（学者餐厅三楼，公开资料）' },
  { name: '风味餐厅快餐店', area: '学生生活区 C 区（学者餐厅北侧，公开资料）' },
  { name: '风味餐厅外卖店', area: '学生生活区 B 区（学海餐厅西侧，公开资料）' },
  { name: '风味美食城一楼', area: 'A 区综合商场一楼（公开资料）' },
  { name: '风味美食城二楼', area: 'A 区综合商场二楼（公开资料）' },
  { name: '室外售饭亭', area: '餐厅周边（公开资料）' },
]

const supplyChainFields = [
  { field: '供应商 / 配送单位', howToVerify: '后勤管理处采购公告、中标公示或饮食服务中心公开资料', status: '待核验' },
  { field: '到货频次与验收环节', howToVerify: '现场访谈 + 后勤公开的验收制度文件', status: '待核验' },
  { field: '食材留样与台账', howToVerify: '学校食品安全管理制度公开文件', status: '待核验' },
  { field: '菜品成本与售价构成', howToVerify: '校方公开的餐饮定价说明', status: '待核验' },
  { field: '菜单与价格', howToVerify: '餐厅现场价目表拍照（需授权）', status: '示例值' },
  { field: '等餐时间', howToVerify: '早/午/晚高峰各实测 15 分钟', status: '示例值' },
]

const campusCafeterias = [
  {
    id: 'xueyuan', name: '学苑餐厅', livingArea: '学生生活区 A 区',
    currentSimulatedWasteKg: 285, binCapacityKg: 76.5, simulatedBinCount: 5,
    meals: [{ meal: '早餐', simulatedWasteKg: 52 }, { meal: '午餐', simulatedWasteKg: 143 }, { meal: '晚餐', simulatedWasteKg: 90 }],
  },
  {
    id: 'xuehai', name: '学海餐厅', livingArea: '学生生活区 B 区',
    currentSimulatedWasteKg: 311, binCapacityKg: 76.5, simulatedBinCount: 5,
    meals: [{ meal: '早餐', simulatedWasteKg: 57 }, { meal: '午餐', simulatedWasteKg: 158 }, { meal: '晚餐', simulatedWasteKg: 96 }],
  },
  {
    id: 'xuezhe', name: '学者餐厅', livingArea: '学生生活区 C 区',
    currentSimulatedWasteKg: 198, binCapacityKg: 76.5, simulatedBinCount: 4,
    meals: [{ meal: '早餐', simulatedWasteKg: 38 }, { meal: '午餐', simulatedWasteKg: 101 }, { meal: '晚餐', simulatedWasteKg: 59 }],
  },
]

const binAssumptions = { volumeLiters: 120, usableRate: 0.85, densityKgPerLiter: 0.75 }

/* ---------- portionModel：由菜单推算单份重量 ---------- */

const DISH_CATEGORIES = categories

const CATEGORY_OVERRIDES = {
  口留香小吃: '水果/副食',
  特色蛋糕: '水果/副食',
}

function dishCategory(name) {
  if (CATEGORY_OVERRIDES[name]) return CATEGORY_OVERRIDES[name]
  if (/汤|粥|羹/.test(name)) return '汤粥类'
  if (/水果|果盘|酸奶|甜点|蛋挞|副食/.test(name)) return '水果/副食'
  if (/面|粉|饺|馍|饼|火烧|包|饭|玉米/.test(name)) return '主食类'
  if (/肉|鸡|鱼|虾|牛|排骨|香锅/.test(name)) return '荤菜类'
  if (/豆腐|蔬|菜|素|蛋/.test(name)) return '素菜类'
  return '主食类'
}

const portionStats = (() => {
  const buckets = {}
  DISH_CATEGORIES.forEach((category) => { buckets[category] = [] })
  cafeteriaInfo.forEach((info) => {
    info.menu.forEach((item) => { buckets[dishCategory(item.name)].push(item.portionG) })
  })
  return DISH_CATEGORIES.map((category) => {
    const list = buckets[category]
    const sum = list.reduce((a, b) => a + b, 0)
    return {
      category,
      count: list.length,
      avgG: list.length ? sum / list.length : 0,
      minG: list.length ? Math.min.apply(null, list) : 0,
      maxG: list.length ? Math.max.apply(null, list) : 0,
    }
  })
})()

const portionKgByCategory = (() => {
  const totalCount = portionStats.reduce((sum, item) => sum + item.count, 0)
  const globalAvgG = portionStats.reduce((sum, item) => sum + item.avgG * item.count, 0) / Math.max(1, totalCount)
  const result = {}
  portionStats.forEach((item) => { result[item.category] = (item.avgG || globalAvgG) / 1000 })
  return result
})()

const portionNote = (category) => {
  const stat = portionStats.find((item) => item.category === category)
  if (!stat) return ''
  return `一份约 ${Math.round(stat.avgG)}g（${stat.count} 道菜平均，${Math.round(stat.minG)}–${Math.round(stat.maxG)}g）`
}

/** 多选「主要食物」时的代表单份重量：取所选类别的平均；一个都没选时按主食类。 */
const portionKgFor = (selected) => {
  const list = selected.filter((item) => DISH_CATEGORIES.indexOf(item) >= 0)
  const use = list.length ? list : [DISH_CATEGORIES[0]]
  return use.reduce((sum, item) => sum + portionKgByCategory[item], 0) / use.length
}

/** 时段基准：同餐段样本平均剩余比例（由 records 算出，可复算）。 */
const mealBaselineRate = (() => {
  const buckets = { 早餐: [], 午餐: [], 晚餐: [] }
  records.forEach((record) => { buckets[record.meal].push(record.wasteRate) })
  const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)
  return { 早餐: avg(buckets.早餐), 午餐: avg(buckets.午餐), 晚餐: avg(buckets.晚餐) }
})()

const mealSampleSize = (() => {
  const counts = { 早餐: 0, 午餐: 0, 晚餐: 0 }
  records.forEach((record) => { counts[record.meal] += 1 })
  return counts
})()

/** 五类食物的配图与主题色（顺序与 categories 一致）。 */
const foodPhotos = {
  主食类: '/images/food/staple.jpg',
  素菜类: '/images/food/veg.jpg',
  荤菜类: '/images/food/meat.jpg',
  汤粥类: '/images/food/soup.jpg',
  '水果/副食': '/images/food/fruit.jpg',
}

const CATEGORY_TONES = ['#e0763c', '#58a87a', '#b98a63', '#4a86c8', '#d8b45e']

module.exports = {
  categories,
  cafeterias,
  meals,
  strategies,
  records,
  impactFactors,
  avgPortionKg,
  PUBLIC_SOURCE,
  cafeteriaInfo,
  otherDiningUnits,
  supplyChainFields,
  campusCafeterias,
  binAssumptions,
  dishCategory,
  portionStats,
  portionKgByCategory,
  portionNote,
  portionKgFor,
  mealBaselineRate,
  mealSampleSize,
  foodPhotos,
  CATEGORY_TONES,
}
