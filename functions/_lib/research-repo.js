// 股票分析的读写都走这里：读首页列表、读一篇的原稿、一次提交里发布或删除。
// 已有的每日笔记接口不经过这个文件。

import { commitFiles, getHead, listFiles, readFile } from './github.js'
import { extractNoteNumber } from './research-page.js'
import { parseResearchDocument, slugFromHref } from './research-index.js'
import { isSlug, planResearchDelete, planResearchSave, PublishError } from './research-publish.js'

function noteNumberFromHtml(html) {
  return html ? extractNoteNumber(html) : null
}

async function readOptional(env, path, ref) {
  return readFile(env, path, ref)
}

export async function listResearch(env) {
  const app = await readFile(env, 'src/App.jsx')
  if (!app) throw new Error('找不到 src/App.jsx。')
  const entries = parseResearchDocument(app.content).entries
  const sources = await listFiles(env, 'research-src')
  const sourceSlugs = new Set(
    sources.filter((file) => file.name.endsWith('.json')).map((file) => file.name.slice(0, -5)),
  )
  return entries.map((entry) => {
    const slug = slugFromHref(entry.href)
    const hasSource = Boolean(slug && sourceSlugs.has(slug))
    return {
      slug,
      date: entry.date,
      ticker: entry.ticker,
      title: entry.title,
      desc: entry.desc,
      href: entry.href,
      hasSource,
      legacy: !hasSource,
    }
  })
}

export async function loadResearch(env, slug) {
  if (!isSlug(slug)) throw new PublishError('链接名不对。')
  const app = await readFile(env, 'src/App.jsx')
  if (!app) throw new Error('找不到 src/App.jsx。')
  const entry = parseResearchDocument(app.content).entries.find((item) => item.href === `/research/${slug}`)
  const source = await readOptional(env, `research-src/${slug}.json`)
  const html = await readOptional(env, `public/research/${slug}.html`)
  if (!entry && !source && !html) return null

  if (source) {
    let data
    try {
      data = JSON.parse(source.content)
    } catch {
      throw new Error('这篇的原稿读不出来，已停止打开。')
    }
    return {
      slug,
      title: entry?.title ?? data.title ?? '',
      ticker: entry?.ticker ?? data.ticker ?? '',
      date: entry?.date ?? data.date ?? '',
      desc: entry?.desc ?? data.desc ?? '',
      lede: data.lede ?? '',
      byline: data.byline ?? '',
      body: data.body ?? '',
      number: data.number || noteNumberFromHtml(html?.content) || null,
      href: `/research/${slug}`,
      legacy: false,
      hasSource: true,
    }
  }

  if (!entry) return null
  return {
    slug,
    title: entry.title,
    ticker: entry.ticker,
    date: entry.date,
    desc: entry.desc,
    lede: '',
    byline: '',
    body: '',
    number: noteNumberFromHtml(html?.content),
    href: entry.href,
    legacy: true,
    hasSource: false,
  }
}

async function collectNoteNumbers(env, ref) {
  const files = await listFiles(env, 'public/research', ref)
  const htmlFiles = files.filter((file) => file.name.endsWith('.html'))
  const numbers = await Promise.all(
    htmlFiles.map(async (file) => {
      const contents = await readFile(env, `public/research/${file.name}`, ref)
      return noteNumberFromHtml(contents?.content)
    }),
  )
  return numbers.filter((n) => Number.isInteger(n))
}

export async function saveResearch(env, payload) {
  const head = await getHead(env)
  const app = await readFile(env, 'src/App.jsx', head.sha)
  if (!app) throw new Error('找不到 src/App.jsx。')

  const [noteNumbers, researchFiles, sourceFiles] = await Promise.all([
    collectNoteNumbers(env, head.sha),
    listFiles(env, 'public/research', head.sha),
    listFiles(env, 'research-src', head.sha),
  ])

  const sourceSlugs = sourceFiles
    .filter((file) => file.name.endsWith('.json'))
    .map((file) => file.name.slice(0, -5))
  const takenSlugs = [
    ...researchFiles.filter((file) => file.name.endsWith('.html')).map((file) => file.name.slice(0, -5)),
    ...parseResearchDocument(app.content).entries.map((entry) => slugFromHref(entry.href)).filter(Boolean),
  ]

  let existingNumber = null
  const originalSlug = String(payload?.originalSlug || '').trim()
  if (originalSlug && isSlug(originalSlug)) {
    const source = await readFile(env, `research-src/${originalSlug}.json`, head.sha)
    if (source) {
      try {
        existingNumber = JSON.parse(source.content).number || null
      } catch {
        existingNumber = null
      }
    }
    if (!existingNumber) {
      const html = await readFile(env, `public/research/${originalSlug}.html`, head.sha)
      existingNumber = noteNumberFromHtml(html?.content)
    }
  }

  const plan = planResearchSave({
    appSource: app.content,
    noteNumbers,
    takenSlugs,
    sourceSlugs,
    existingNumber,
    payload,
  })
  await commitFiles(env, head, plan.files, plan.message)
  return { ok: true, slug: plan.slug, number: plan.number, href: plan.href, legacy: plan.legacy }
}

export async function deleteResearch(env, slug) {
  if (!isSlug(slug)) throw new PublishError('链接名不对。')
  const head = await getHead(env)
  const app = await readFile(env, 'src/App.jsx', head.sha)
  if (!app) throw new Error('找不到 src/App.jsx。')
  const [html, source] = await Promise.all([
    readFile(env, `public/research/${slug}.html`, head.sha),
    readFile(env, `research-src/${slug}.json`, head.sha),
  ])
  const plan = planResearchDelete({
    appSource: app.content,
    slug,
    hasHtml: Boolean(html),
    hasSource: Boolean(source),
  })
  await commitFiles(env, head, plan.files, plan.message)
  return { ok: true }
}

export { PublishError }
