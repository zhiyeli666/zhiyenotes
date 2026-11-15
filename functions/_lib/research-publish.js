// 把工作台提交的字段变成“一次提交里要写哪些文件”。
// 不碰 GitHub：调用方读到仓库里的首页和已有编号后，把结果交给这里。

import { renderResearchPage } from './research-page.js'
import {
  parseResearchDocument,
  removeResearchEntry,
  slugFromHref,
  upsertResearchEntry,
} from './research-index.js'

export class PublishError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isSlug(slug) {
  return typeof slug === 'string' && slug.length >= 3 && slug.length <= 80 && SLUG_RE.test(slug)
}

export function slugifyTitle(title, date) {
  const year = String(date || '').slice(0, 4)
  let slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (!slug) slug = 'note'
  if (/^\d{4}$/.test(year) && !slug.endsWith(year)) slug = `${slug}-${year}`
  if (slug.length > 80) slug = slug.slice(0, 80).replace(/-+$/g, '')
  return slug
}

function oneLine(value, label, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) throw new PublishError(`请填写${label}。`)
  if (text.length > max) throw new PublishError(`${label}太长了。`)
  return text
}

function optionalLine(value, label, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length > max) throw new PublishError(`${label}太长了。`)
  return text
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

function cleanTicker(value) {
  const ticker = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!ticker) throw new PublishError('请填写股票代码。')
  if (ticker.length > 40) throw new PublishError('股票代码太长了。')
  if (!/^[\p{L}\p{N} .·&\-/+]+$/u.test(ticker)) {
    throw new PublishError('股票代码里有不认识的符号。')
  }
  return ticker
}

function nextNumber(numbers) {
  const max = (numbers || []).reduce((hi, n) => (Number.isFinite(n) ? Math.max(hi, n) : hi), 0)
  return max + 1
}

const SAFE_PATH = /^(public\/research\/[a-z0-9]+(?:-[a-z0-9]+)*\.html|research-src\/[a-z0-9]+(?:-[a-z0-9]+)*\.json|src\/App\.jsx)$/

function assertPaths(files) {
  for (const file of files) {
    if (!SAFE_PATH.test(file.path)) throw new PublishError('要写的路径不对，已取消保存。')
  }
}

function listingChanged(previous, entry) {
  if (!previous) return true
  return (
    previous.date !== entry.date ||
    previous.ticker !== entry.ticker ||
    previous.title !== entry.title ||
    previous.href !== entry.href ||
    previous.desc !== entry.desc
  )
}

// 返回 { files, message, slug, number, href }。
// files 里 content 为 null 表示在同一次提交里删掉该文件。
export function planResearchSave({
  appSource,
  noteNumbers,
  takenSlugs,
  sourceSlugs,
  existingNumber,
  payload,
}) {
  const originalSlug = String(payload?.originalSlug || '').trim()
  const isNew = !originalSlug
  if (!isNew && !isSlug(originalSlug)) throw new PublishError('原来的链接名不对。')

  const title = oneLine(payload?.title, '标题', 200)
  const ticker = cleanTicker(payload?.ticker)
  const date = String(payload?.date || '').trim()
  if (!isValidDate(date)) throw new PublishError('日期不对。')
  const desc = oneLine(payload?.desc, '首页简介', 1200)

  let slug = String(payload?.slug || '').trim().toLowerCase()
  if (!slug && isNew) slug = slugifyTitle(title, date)
  if (!isSlug(slug)) throw new PublishError('链接名只能用小写字母、数字和连字符。')

  const taken = new Set(takenSlugs || [])
  const sources = new Set(sourceSlugs || [])
  const legacy = !isNew && !sources.has(originalSlug)
  const href = `/research/${slug}`
  const originalHref = isNew ? null : `/research/${originalSlug}`

  const doc = parseResearchDocument(appSource)
  const previous = originalHref ? doc.entries.find((entry) => entry.href === originalHref) : null
  if (!isNew && !previous) throw new PublishError('首页列表里找不到原来的那一篇。')
  if (slug !== originalSlug && taken.has(slug)) {
    throw new PublishError('这个链接名已经有一篇了，换一个。')
  }

  const entry = { date, ticker, title, href, desc }

  if (legacy) {
    if (slug !== originalSlug) throw new PublishError('手工写的页面不能在这里改链接。')
    if (String(payload?.body || '').trim()) {
      throw new PublishError('这篇是手工写的页面，工作台不会重写正文。')
    }
    if (!listingChanged(previous, entry)) {
      throw new PublishError('没有要保存的修改。')
    }
    const files = [{ path: 'src/App.jsx', content: upsertResearchEntry(appSource, entry, originalHref) }]
    assertPaths(files)
    return {
      files,
      message: `Update research listing ${href} (via workbench)`,
      slug,
      number: existingNumber || null,
      href,
      legacy: true,
    }
  }

  const lede = oneLine(payload?.lede, '导语', 1500)
  const byline = optionalLine(payload?.byline, '日期说明', 240)
  const body = String(payload?.body ?? '').replace(/\r\n/g, '\n').trim()
  if (!body) throw new PublishError('正文是空的，写点东西再发布。')
  if (body.length > 100_000) throw new PublishError('正文太长了。')

  const number = isNew ? nextNumber(noteNumbers) : Number(existingNumber)
  if (!isNew && (!Number.isInteger(number) || number < 1)) {
    throw new PublishError('找不到这篇的编号，已取消保存。')
  }

  const html = renderResearchPage({ title, lede, byline, date, number, body })
  if (!html.includes(`Research Note · No. ${number}`) || !html.includes('<h1>')) {
    throw new PublishError('页面没有生成成功，已取消保存。')
  }

  const source = `${JSON.stringify(
    { title, ticker, date, desc, lede, byline, slug, number, body },
    null,
    2,
  )}\n`

  const files = [
    { path: `public/research/${slug}.html`, content: html },
    { path: `research-src/${slug}.json`, content: source },
  ]
  if (!isNew && originalSlug !== slug) {
    files.push({ path: `public/research/${originalSlug}.html`, content: null })
    files.push({ path: `research-src/${originalSlug}.json`, content: null })
  }
  if (isNew || listingChanged(previous, entry)) {
    files.push({
      path: 'src/App.jsx',
      content: upsertResearchEntry(appSource, entry, originalHref),
    })
  }

  let message
  if (isNew) message = `Add research note ${href} (via workbench)`
  else if (originalSlug !== slug) message = `Rename research note /research/${originalSlug} to ${href} (via workbench)`
  else message = `Update research note ${href} (via workbench)`

  assertPaths(files)
  return { files, message, slug, number, href, legacy: false }
}

export function planResearchDelete({ appSource, slug, hasHtml, hasSource }) {
  if (!isSlug(slug)) throw new PublishError('链接名不对。')
  const href = `/research/${slug}`
  const doc = parseResearchDocument(appSource)
  const listed = doc.entries.some((entry) => entry.href === href || slugFromHref(entry.href) === slug)
  if (!listed && !hasHtml && !hasSource) throw new PublishError('找不到这篇研究。', 404)

  const files = []
  if (listed) files.push({ path: 'src/App.jsx', content: removeResearchEntry(appSource, href) })
  if (hasHtml) files.push({ path: `public/research/${slug}.html`, content: null })
  if (hasSource) files.push({ path: `research-src/${slug}.json`, content: null })
  if (files.length === 0) throw new PublishError('找不到这篇研究。', 404)
  assertPaths(files)
  return { files, message: `Delete research note ${href} (via workbench)` }
}
