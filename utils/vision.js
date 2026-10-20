/* 剩饭识别 v2：自适应亮度阈值 + 盘子区域检测 + 盘内食物统计
   与 v1 的区别：
   - v1 只取画面中心一个圆，桌面/盘沿花纹会被算成食物（这次 99% 的根因）
   - v2 先在整幅图里找"盘子"（最亮、最平整的最大连通块），再用盘子圆的内 82% 区域统计食物
   纯函数，输入 { data(RGBA), width, height }，输出比例与置信度。 */

const CONFIDENCE_TEXT = { high: '把握较大', medium: '仅供参考', low: '把握不大' }
const confidenceLabel = (value) => CONFIDENCE_TEXT[value] || '仅供参考'

function buildFeatures(data, width, height) {
  const n = width * height
  const L = new Float32Array(n)
  const S = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    L[i] = (max + min) / 510
    S[i] = max === 0 ? 0 : (max - min) / max
  }
  return { L, S }
}

/** Otsu 阈值（在中央 90% 区域内统计直方图） */
function otsuThreshold(L, width, height) {
  const hist = new Int32Array(64)
  let total = 0
  const x0 = Math.floor(width * 0.05)
  const x1 = Math.ceil(width * 0.95)
  const y0 = Math.floor(height * 0.05)
  const y1 = Math.ceil(height * 0.95)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      hist[Math.min(63, Math.floor(L[y * width + x] * 64))] += 1
      total += 1
    }
  }
  if (!total) return 0.6
  let sum = 0
  for (let i = 0; i < 64; i += 1) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let best = 0
  let bestVar = -1
  for (let i = 0; i < 64; i += 1) {
    wB += hist[i]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > bestVar) { bestVar = between; best = i }
  }
  return (best + 0.5) / 64
}

/** 3×3 邻域亮度差（局部起伏） */
function flatnessAt(L, x, y, width, height) {
  const c = L[y * width + x]
  let sum = 0
  let cnt = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    const ny = y + oy
    if (ny < 0 || ny >= height) continue
    for (let ox = -1; ox <= 1; ox += 1) {
      if (!ox && !oy) continue
      const nx = x + ox
      if (nx < 0 || nx >= width) continue
      sum += Math.abs(L[ny * width + nx] - c)
      cnt += 1
    }
  }
  return cnt ? sum / cnt : 0
}

/** 最大连通块（4 邻域，BFS），返回其像素列表与质心 */
function largestBlob(mask, width, height) {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  let best = null
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let count = 0
    let sx = 0
    let sy = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    while (top > 0) {
      const idx = stack[--top]
      const x = idx % width
      const y = (idx - x) / width
      count += 1
      sx += x
      sy += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && mask[idx - 1] && !seen[idx - 1]) { seen[idx - 1] = 1; stack[top++] = idx - 1 }
      if (x < width - 1 && mask[idx + 1] && !seen[idx + 1]) { seen[idx + 1] = 1; stack[top++] = idx + 1 }
      if (y > 0 && mask[idx - width] && !seen[idx - width]) { seen[idx - width] = 1; stack[top++] = idx - width }
      if (y < height - 1 && mask[idx + width] && !seen[idx + width]) { seen[idx + width] = 1; stack[top++] = idx + width }
    }
    if (!best || count > best.count) best = { count, cx: sx / count, cy: sy / count, minX, maxX, minY, maxY }
  }
  return best
}

/** 区域内的亮度中位数（用于判定"食物比盘面暗"） */
function medianL(L, width, height, mask) {
  const hist = new Int32Array(64)
  let total = 0
  for (let i = 0; i < L.length; i += 1) {
    if (mask && !mask[i]) continue
    hist[Math.min(63, Math.floor(L[i] * 64))] += 1
    total += 1
  }
  if (!total) return 0.7
  let acc = 0
  for (let i = 0; i < 64; i += 1) {
    acc += hist[i]
    if (acc >= total / 2) return (i + 0.5) / 64
  }
  return 0.7
}

function analyzeLeftover(pixels) {
  const { data, width, height } = pixels
  if (!data || width < 16 || height < 16) {
    return { ratio: 0, plateShare: 0, foodShare: 0, meanLight: 0, confidence: 'low', note: '照片太小，识别不了', method: 'v2' }
  }
  const n = width * height
  const { L, S } = buildFeatures(data, width, height)

  // 1) 亮度阈值（自适应）
  const tBright = Math.max(0.55, Math.min(0.92, otsuThreshold(L, width, height)))

  // 2) 盘子候选：够亮、低饱和、表面平整（不再要求"冷色"，解决暖光食堂的误判）
  const plateMask = new Uint8Array(n)
  let plateCandidates = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (L[i] <= tBright) continue
      if (S[i] > 0.42) continue
      if (flatnessAt(L, x, y, width, height) > 0.035) continue
      plateMask[i] = 1
      plateCandidates += 1
    }
  }

  // 3) 最大盘子连通块
  const blob = largestBlob(plateMask, width, height)
  const imageArea = n
  const plateArea = blob ? blob.count : 0
  const plateShare = plateArea / imageArea

  // 找不到盘子：退回中心圆 + 低置信度
  if (!blob || plateArea < imageArea * 0.03) {
    return {
      ratio: 0,
      plateShare: 0,
      foodShare: 0,
      meanLight: 0,
      confidence: 'low',
      note: '画面里没找到明显的盘子，建议把餐盘放满画面再拍一张',
      method: 'v2',
    }
  }

  // 4) 盘子内圈：用亮区包围盒估圆心与半径（食物遮住半边时半径不被低估），再收 7% 避开盘沿花纹
  const bx = (blob.minX + blob.maxX) / 2
  const by = (blob.minY + blob.maxY) / 2
  const boxR = Math.min(blob.maxX - blob.minX, blob.maxY - blob.minY) / 2
  const radius = Math.max(8, boxR * 0.93)
  const r2 = radius * radius
  const inner = new Uint8Array(n)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - bx
      const dy = y - by
      if (dx * dx + dy * dy <= r2) inner[y * width + x] = 1
    }
  }

  // 5) 盘面基准亮度（只看盘子像素），食物 = 比盘面暗 / 高饱和 / 有纹理
  const plateL = medianL(L, width, height, plateMask)
  let plate = 0
  let food = 0
  let lightSum = 0
  let lightCount = 0
  for (let i = 0; i < n; i += 1) {
    if (!inner[i]) continue
    lightSum += L[i]
    lightCount += 1
    const textured = flatnessAt(L, i % width, (i - (i % width)) / width, width, height) > 0.03
    const dark = L[i] < plateL - 0.1
    const colorful = S[i] > 0.45
    if (textured || dark || colorful) food += 1
    else plate += 1
  }
  const total = plate + food || 1
  const foodShare = food / total
  const meanLight = lightSum / (lightCount || 1)
  const ratio = Math.min(1, Math.max(0, foodShare))

  // 6) 置信度：盘子占比、圆度（面积/包围盒）、对比度
  let confidence = 'high'
  let note = '已按盘内区域识别，可对照结果看看是否合理'
  if (meanLight < 0.16) {
    confidence = 'low'
    note = '照片偏暗，识别把握不大，建议在亮一点的地方重拍'
  } else if (plateShare < 0.08) {
    confidence = 'medium'
    note = '盘子只占画面一小部分，建议把餐盘放满画面再拍一张'
  } else if (ratio < 0.04) {
    note = '看起来是干净的光盘'
  } else if (ratio > 0.95) {
    confidence = 'medium'
    note = '盘面几乎被食物占满，识别仅供参考'
  } else if (plateShare < 0.14) {
    confidence = 'medium'
    note = '盘子露出的部分不多，识别仅供参考'
  }

  return { ratio, plateShare, foodShare, meanLight, confidence, note, method: 'v2' }
}

/** 按识别结果 + 时段基准生成建议（规则库，句子随结果变化） */
function suggestFor(ratio, baseline, meal, confidence) {
  const pct = Math.round(ratio * 100)
  const base = Math.round((baseline || 0) * 100)
  if (confidence === 'low') return '这张照片看不太准，换个角度、让餐盘占满画面再拍一张，结果会更可靠。'
  if (ratio <= 0.03) return `光盘！这一餐几乎没有浪费${pct === 0 ? '' : ''}——把这份干净保持下去，下次拍一张给室友看看。`
  if (ratio <= 0.1) return `剩得不多（约 ${pct}%），再少取一口就是光盘；下次可以先点半份。`
  if (ratio <= 0.25) return `剩约 ${pct}%，比${meal}样本平均（${base}%）${pct > base ? '略高' : '略低'}。下次点餐先少取一点，不够再加。`
  if (ratio <= 0.5) return `剩约 ${pct}%${pct > base ? `，比${meal}样本平均（${base}%）高一些` : ''}——这多半是分量偏大，试试半份菜。`
  return `剩了约 ${pct}%，一半以上没吃完。下次可以点半份、或者吃不完就打包，别让它直接进泔水桶。`
}

module.exports = { analyzeLeftover, confidenceLabel, suggestFor, CENTER_RATIO: 0.4 }
