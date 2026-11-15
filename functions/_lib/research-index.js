// 只动 src/App.jsx 里的 `const research = [ ... ]`。
// 没被改到的条目按原文字保留，避免发布一篇时把已经上线的 12 篇简介重排一遍。

export function slugFromHref(href) {
  const match = String(href).match(/^\/research\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)
  return match ? match[1] : null
}

function scanObject(source, start) {
  if (source[start] !== '{') throw new Error('研究列表的格式认不出来，已停止修改首页。')
  let depth = 0
  let quote = null
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  throw new Error('研究列表没有正常结束，已停止修改首页。')
}

function parseJsStringAt(source, start) {
  const quote = source[start]
  if (quote !== '"' && quote !== "'") return null
  let value = ''
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i]
    if (ch === '\\') {
      const next = source[i + 1]
      const map = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' }
      value += map[next] ?? next ?? ''
      i++
      continue
    }
    if (ch === quote) return { value, end: i + 1 }
    value += ch
  }
  return null
}

function locateField(raw, key) {
  const re = new RegExp(`(^|\\n)([ \\t]*${key}[ \\t]*:[ \\t]*)`)
  const match = re.exec(raw)
  if (!match) return null
  const valueStart = match.index + match[0].length
  const parsed = parseJsStringAt(raw, valueStart)
  if (!parsed) return null
  return { value: parsed.value, start: valueStart, end: parsed.end }
}

function readField(raw, key) {
  return locateField(raw, key)?.value ?? null
}

function setField(raw, key, value) {
  const found = locateField(raw, key)
  if (!found) throw new Error(`研究列表的条目里缺少 ${key}，已停止修改首页。`)
  if (found.value === value) return raw
  return raw.slice(0, found.start) + JSON.stringify(value) + raw.slice(found.end)
}

export function parseResearchDocument(source) {
  const marker = 'const research = ['
  const at = source.indexOf(marker)
  if (at < 0) throw new Error('找不到首页上的研究列表（const research）。')
  let i = at + marker.length
  const entries = []
  while (i < source.length) {
    while (i < source.length && /[\s,]/.test(source[i])) i++
    if (source[i] === ']') {
      return {
        prefix: source.slice(0, at + marker.length),
        suffix: source.slice(i),
        entries,
      }
    }
    if (source[i] !== '{') {
      throw new Error('研究列表的格式认不出来，已停止修改首页。')
    }
    const end = scanObject(source, i)
    const raw = source.slice(i, end)
    const date = readField(raw, 'date')
    const ticker = readField(raw, 'ticker')
    const title = readField(raw, 'title')
    const href = readField(raw, 'href')
    const desc = readField(raw, 'desc')
    if (!date || !ticker || !title || !href || desc == null) {
      throw new Error('研究列表里有一条缺了日期、代码、标题、链接或简介。')
    }
    entries.push({ raw, date, ticker, title, href, desc })
    i = end
  }
  throw new Error('研究列表没有正常结束，已停止修改首页。')
}

function serializeEntries(entries) {
  if (entries.length === 0) return '\n'
  return `\n${entries.map((entry) => `  ${entry.raw}`).join(',\n')},\n`
}

// 把解析结果按原样拼回去。测试用它确认“没改的条目一个字都不变”。
export function rebuildResearchSource(source) {
  const doc = parseResearchDocument(source)
  return doc.prefix + serializeEntries(doc.entries) + doc.suffix
}

function formatEntry({ date, ticker, title, href, desc }) {
  return `{
    date: ${JSON.stringify(date)},
    ticker: ${JSON.stringify(ticker)},
    title: ${JSON.stringify(title)},
    href: ${JSON.stringify(href)},
    desc: ${JSON.stringify(desc)},
  }`
}

// 同一天再发一篇时，新的排在前面；日期没变就不挪位置。
function insertIndex(entries, date) {
  const index = entries.findIndex((entry) => entry.date <= date)
  return index === -1 ? entries.length : index
}

function writeBack(doc, entries) {
  return doc.prefix + serializeEntries(entries) + doc.suffix
}

export function upsertResearchEntry(source, entry, originalHref) {
  const doc = parseResearchDocument(source)
  const entries = doc.entries.map((item) => ({ ...item }))

  if (originalHref) {
    const index = entries.findIndex((item) => item.href === originalHref)
    if (index < 0) throw new Error('首页列表里找不到原来的那一篇。')
    const previous = entries[index]
    let raw = previous.raw
    raw = setField(raw, 'date', entry.date)
    raw = setField(raw, 'ticker', entry.ticker)
    raw = setField(raw, 'title', entry.title)
    raw = setField(raw, 'href', entry.href)
    raw = setField(raw, 'desc', entry.desc)
    const next = { ...previous, raw, date: entry.date, ticker: entry.ticker, title: entry.title, href: entry.href, desc: entry.desc }
    if (previous.date === entry.date) {
      entries[index] = next
    } else {
      entries.splice(index, 1)
      entries.splice(insertIndex(entries, entry.date), 0, next)
    }
  } else {
    if (entries.some((item) => item.href === entry.href)) {
      throw new Error('这个链接已经在首页列表里了。')
    }
    const created = {
      raw: formatEntry(entry),
      date: entry.date,
      ticker: entry.ticker,
      title: entry.title,
      href: entry.href,
      desc: entry.desc,
    }
    entries.splice(insertIndex(entries, entry.date), 0, created)
  }

  const nextSource = writeBack(doc, entries)
  const check = parseResearchDocument(nextSource)
  if (!check.entries.some((item) => item.href === entry.href)) {
    throw new Error('首页列表写坏了，已取消保存。')
  }
  return nextSource
}

export function removeResearchEntry(source, href) {
  const doc = parseResearchDocument(source)
  const entries = doc.entries.filter((item) => item.href !== href)
  if (entries.length === doc.entries.length) throw new Error('首页列表里找不到这篇。')
  const nextSource = writeBack(doc, entries)
  const check = parseResearchDocument(nextSource)
  if (check.entries.some((item) => item.href === href)) {
    throw new Error('首页列表写坏了，已取消保存。')
  }
  return nextSource
}
