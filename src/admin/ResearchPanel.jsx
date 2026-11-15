import { useEffect, useRef, useState } from 'react'
import { renderResearchPage } from '../../functions/_lib/research-page.js'
import { slugifyTitle } from '../../functions/_lib/research-publish.js'
import { api } from './api.js'
import { RESEARCH_TEMPLATE } from './templates.js'

// 股票分析：填标题、代码、日期、首页简介、导语和 Markdown 正文。
// 一次发布会生成 public/research/*.html，并把它登记进首页列表，同一次提交。

function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function blankForm() {
  const date = today()
  return {
    originalSlug: null,
    legacy: false,
    number: null,
    title: '',
    ticker: '',
    date,
    desc: '',
    lede: '',
    byline: '',
    slug: '',
    body: RESEARCH_TEMPLATE,
  }
}

function snapshot(form) {
  return JSON.stringify({
    title: form.title,
    ticker: form.ticker,
    date: form.date,
    desc: form.desc,
    lede: form.lede,
    byline: form.byline,
    slug: form.slug,
    body: form.body,
  })
}

function previewHtml(form) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? form.date : today()
  return renderResearchPage({
    title: form.title.trim() || 'Untitled',
    lede: form.lede.trim() || '…',
    byline: form.byline,
    date,
    number: form.number,
    body: form.body,
  })
}

export default function ResearchWorkbench({ items, error, onRefresh, onDirty, switcher }) {
  const [editing, setEditing] = useState(null)
  const [saved, setSaved] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('write')
  const [preview, setPreview] = useState('')
  const frameRef = useRef(null)
  const scrollRef = useRef(0)

  const dirty = editing ? snapshot(editing) !== saved : false

  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  useEffect(() => {
    if (!editing || editing.legacy) {
      setPreview('')
      return undefined
    }
    const timer = setTimeout(() => {
      // 空 sandbox 的 iframe 读 contentWindow 会抛错，不能因此把预览丢掉。
      try {
        scrollRef.current = frameRef.current?.contentWindow?.scrollY || 0
      } catch {
        scrollRef.current = 0
      }
      setPreview(previewHtml(editing))
    }, 200)
    return () => clearTimeout(timer)
  }, [editing])

  function update(field, value) {
    setEditing((cur) => {
      if (!cur) return cur
      const next = { ...cur, [field]: value }
      if (!cur.originalSlug && !slugTouched && (field === 'title' || field === 'date')) {
        const title = field === 'title' ? value : cur.title
        const date = field === 'date' ? value : cur.date
        if (title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          next.slug = slugifyTitle(title, date)
        }
      }
      return next
    })
  }

  async function openItem(item) {
    if (!item.slug) return
    if (dirty && !confirm('当前这篇还没保存，确定要打开另一篇吗？')) return
    setBusy(true)
    setMsg(null)
    try {
      const data = await api.research(item.slug)
      const form = {
        originalSlug: data.slug,
        legacy: !!data.legacy,
        number: data.number ?? null,
        title: data.title || '',
        ticker: data.ticker || '',
        date: data.date || today(),
        desc: data.desc || '',
        lede: data.lede || '',
        byline: data.byline || '',
        slug: data.slug,
        body: data.body || '',
      }
      setEditing(form)
      setSaved(snapshot(form))
      setSlugTouched(true)
      setTab('write')
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  function newNote() {
    if (dirty && !confirm('当前这篇还没保存，确定要新建吗？')) return
    const form = blankForm()
    setEditing(form)
    setSaved(snapshot(form))
    setSlugTouched(false)
    setMsg(null)
    setTab('write')
  }

  async function save() {
    if (!editing) return
    setBusy(true)
    setMsg(null)
    try {
      const data = await api.saveResearch({
        originalSlug: editing.originalSlug,
        slug: editing.slug,
        title: editing.title,
        ticker: editing.ticker,
        date: editing.date,
        desc: editing.desc,
        lede: editing.lede,
        byline: editing.byline,
        body: editing.legacy ? '' : editing.body,
      })
      const form = {
        ...editing,
        originalSlug: data.slug,
        slug: data.slug,
        number: data.number ?? editing.number,
        legacy: !!data.legacy,
      }
      setEditing(form)
      setSaved(snapshot(form))
      setSlugTouched(true)
      const numberText = data.number ? `Research Note No. ${data.number}。` : ''
      setMsg({
        type: 'ok',
        text: `✅ 已发布！${numberText}网站正在自动更新，大约 1–2 分钟后刷新 zhiyenotes.com 就能看到。`,
      })
      onRefresh()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  async function remove() {
    if (!editing?.originalSlug) return
    const warning = editing.legacy
      ? `这篇是手工写的文章。删除会从网站上拿掉整页和首页入口。确定删除「${editing.title || editing.slug}」吗？`
      : `确定删除「${editing.title || editing.slug}」吗？页面和首页入口都会消失。`
    if (!confirm(warning)) return
    setBusy(true)
    setMsg(null)
    try {
      await api.removeResearch(editing.originalSlug)
      setEditing(null)
      setSaved('')
      setMsg({ type: 'ok', text: '🗑️ 已删除，网站稍后自动更新。' })
      onRefresh()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  const pathHint = editing?.slug ? `public/research/${editing.slug}.html` : ''
  const canSave = dirty || !editing?.originalSlug

  return (
    <>
      <aside className="sidebar">
        {switcher}
        <button className="btn primary block" onClick={newNote}>
          ＋ 写新的一篇
        </button>
        {error && <p className="msg error">{error}</p>}
        <ul className="note-list">
          {items.map((item) => (
            <li key={item.href || item.slug}>
              <button
                className={`note-item research-link ${editing?.originalSlug === item.slug ? 'on' : ''}`}
                onClick={() => openItem(item)}
              >
                <span className="research-link-top">
                  <span>{item.date}</span>
                  <span className="ticker">{item.ticker}</span>
                  {item.legacy && <span className="legacy-mark">手工</span>}
                </span>
                <span className="item-title">{item.title}</span>
              </button>
            </li>
          ))}
          {items.length === 0 && !error && <li className="empty">还没有研究笔记</li>}
        </ul>
      </aside>

      <section className="editor-area">
        {msg && <p className={`msg ${msg.type === 'ok' ? 'ok' : 'error'}`}>{msg.text}</p>}

        {!editing && (
          <div className="placeholder">
            <p>👈 左边点一篇打开，或者点「写新的一篇」开始写股票分析。</p>
          </div>
        )}

        {editing && (
          <>
            <div className="research-fields">
              <label>
                标题
                <input
                  className="input"
                  value={editing.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="The Business Did Not Resign"
                  autoComplete="off"
                />
              </label>
              <label>
                股票代码
                <input
                  className="input"
                  value={editing.ticker}
                  onChange={(e) => update('ticker', e.target.value)}
                  placeholder="NVDA"
                  autoComplete="off"
                />
              </label>
              <label>
                日期
                <input
                  type="date"
                  className="input"
                  value={editing.date}
                  onChange={(e) => update('date', e.target.value)}
                />
              </label>
              <label className="span-all">
                首页简介
                <textarea
                  className="input area"
                  rows={3}
                  value={editing.desc}
                  onChange={(e) => update('desc', e.target.value)}
                  placeholder="显示在首页 Stock Analysis 列表里的那一段，可以和导语不同。"
                />
              </label>
              {!editing.legacy && (
                <>
                  <label className="span-all">
                    导语
                    <textarea
                      className="input area"
                      rows={3}
                      value={editing.lede}
                      onChange={(e) => update('lede', e.target.value)}
                      placeholder="页面标题下面的第一段。"
                    />
                  </label>
                  <label className="span-2">
                    日期后面的说明
                    <input
                      className="input"
                      value={editing.byline}
                      onChange={(e) => update('byline', e.target.value)}
                      placeholder="Data through Q3 2026"
                    />
                  </label>
                  <label>
                    链接名
                    <input
                      className="input"
                      value={editing.slug}
                      onChange={(e) => {
                        setSlugTouched(true)
                        update('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))
                      }}
                      spellCheck="false"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="editor-head">
              <span className="path-hint">
                {editing.number ? `No. ${editing.number} · ` : '编号发布时自动取下一号 · '}
                {pathHint}
                {editing.slug ? ` · /research/${editing.slug}` : ''}
              </span>
              <div className="editor-actions">
                {editing.originalSlug && (
                  <a
                    className="btn ghost"
                    href={`/research/${editing.originalSlug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    看网页 ↗
                  </a>
                )}
                {editing.originalSlug && (
                  <button className="btn danger" onClick={remove} disabled={busy}>
                    删除
                  </button>
                )}
                <button className="btn primary" onClick={save} disabled={busy || !canSave}>
                  {busy ? '保存中…' : canSave ? '保存并发布' : '已保存'}
                </button>
              </div>
            </div>

            {editing.legacy && (
              <p className="msg info">
                这篇是以前手工写的页面。这里保存只会改首页列表上的日期、代码、标题和简介，不会改文章正文。
              </p>
            )}

            {!editing.legacy && (
              <>
                <p className="field-help">
                  正文用 Markdown。表格和链接会按现有研究页排版。自己算的数字后面写{' '}
                  <code>{'{derived}'}</code>，页面上会标成 derived。<code>## Verdict</code> 是结论框，
                  <code>&gt;</code> 是提示框（<code>&gt; !</code> 是提醒），<code>### Sources</code>{' '}
                  是文末来源。右对齐的列用等宽数字，以 + 或 − 开头会标成涨跌颜色（不以符号开头时在格子开头写{' '}
                  <code>{'{+}'}</code> 或 <code>{'{-}'}</code>）；一整行都加粗会变成合计行。表格下一行以{' '}
                  <code>^ </code> 开头会变成表注。左上角的 Home 键在网站构建时自动加上。
                </p>

                <div className="seg mobile-only">
                  <button
                    className={`seg-btn ${tab === 'write' ? 'on' : ''}`}
                    onClick={() => setTab('write')}
                  >
                    ✍️ 写
                  </button>
                  <button
                    className={`seg-btn ${tab === 'preview' ? 'on' : ''}`}
                    onClick={() => setTab('preview')}
                  >
                    👀 预览
                  </button>
                </div>

                <div className="split">
                  <div className={`pane ${tab === 'write' ? '' : 'hide-mobile'}`}>
                    <textarea
                      className="editor"
                      value={editing.body}
                      onChange={(e) => update('body', e.target.value)}
                      spellCheck="false"
                    />
                  </div>
                  <div className={`pane ${tab === 'preview' ? '' : 'hide-mobile'}`}>
                    <div className="preview-label">网站上的样子</div>
                    <iframe
                      ref={frameRef}
                      className="research-preview"
                      title="研究页预览"
                      sandbox="allow-same-origin"
                      srcDoc={preview}
                      onLoad={() => {
                        try {
                          frameRef.current?.contentWindow?.scrollTo(0, scrollRef.current)
                        } catch {
                          /* 预览框读不到滚动位置时忽略 */
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  )
}
