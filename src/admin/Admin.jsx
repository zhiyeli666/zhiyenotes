import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import '../App.css'
import './Admin.css'
import { api } from './api.js'
import { COLLECTIONS } from './templates.js'

// ============================================================
//  工作台（后台）· Zhiye's Market Notes
//
//  给以后看代码的人：
//  - 这是一个只有登录后才能用的编辑页面，网址是 /admin。
//  - 它不直接改这台电脑上的文件，而是通过 /api/* 接口，
//    把笔记提交到 GitHub 仓库；提交后网站会自动重新部署。
//  - 接口的代码在项目根目录的 functions/api/ 文件夹里。
// ============================================================

// 今天的日期，格式 2026-07-28（按本地时区，不用 UTC，免得差一天）
function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 预览时去掉第一行的 "# 大标题"，跟主页显示的效果保持一致
function previewBody(text) {
  return text.replace(/^#[^\n]*\n/, '').trim()
}

function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.login(password)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <h1>🔑 工作台</h1>
        <p className="login-hint">输入密码，进入笔记编辑台</p>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          autoFocus
        />
        {error && <p className="msg error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy || !password}>
          {busy ? '登录中…' : '登录'}
        </button>
        <a className="back-link" href="/">
          ← 回到网站首页
        </a>
      </form>
    </div>
  )
}

function Workbench({ onLogout }) {
  const [collection, setCollection] = useState('notes')
  const [notes, setNotes] = useState({})
  const [editing, setEditing] = useState(null) // 正在编辑的笔记
  const [original, setOriginal] = useState('') // 打开时的原文，用来判断"有没有改动"
  const [msg, setMsg] = useState(null) // { type: 'ok' | 'error', text }
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('write') // 手机上：写 / 预览

  const refresh = useCallback(async () => {
    try {
      const data = await api.list()
      setNotes(data.notes || {})
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const dirty = editing && editing.content !== original

  async function openNote(item) {
    if (dirty && !confirm('当前笔记还没保存，确定要打开另一篇吗？')) return
    setBusy(true)
    setMsg(null)
    try {
      const data = await api.get(item.path)
      setEditing({
        path: item.path,
        collection: item.collection,
        date: item.date,
        content: data.content,
        sha: data.sha,
        isNew: false,
      })
      setOriginal(data.content)
      setTab('write')
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  function newNote() {
    if (dirty && !confirm('当前笔记还没保存，确定要新建吗？')) return
    const date = today()
    const content = COLLECTIONS[collection].template.replaceAll('{{date}}', date)
    setEditing({
      path: `${COLLECTIONS[collection].dir}/${date}.md`,
      collection,
      date,
      content,
      sha: null,
      isNew: true,
    })
    // 原文 = 刚套上的模板：还没动手写之前不算"有未保存的改动"，
    // 这样换栏目、再点新建时才不会被"确定要放弃吗"挡住。
    setOriginal(content)
    setMsg(null)
    setTab('write')
  }

  // 改日期 = 改文件名；正文里写着旧日期的地方也一起改掉，免得忘记
  function changeDate(date) {
    if (!date) return
    setEditing((cur) => ({
      ...cur,
      date,
      path: `${COLLECTIONS[cur.collection].dir}/${date}.md`,
      content: cur.content.replaceAll(cur.date, date),
    }))
  }

  async function save() {
    if (!editing) return
    // 新建时如果这一天已经写过，提醒一下别覆盖掉
    const exists = (notes[editing.collection] || []).some(
      (n) => n.path === editing.path,
    )
    if (editing.isNew && exists) {
      if (!confirm(`${editing.date} 已经有一篇了，要覆盖它吗？`)) return
    }

    setBusy(true)
    setMsg(null)
    try {
      const data = await api.save(editing.path, editing.content, editing.sha)
      setEditing((cur) => ({ ...cur, sha: data.sha, isNew: false }))
      setOriginal(editing.content)
      setMsg({
        type: 'ok',
        text: '✅ 已保存！网站正在自动更新，大约 1–2 分钟后刷新 zhiyenotes.com 就能看到。',
      })
      refresh()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  async function remove() {
    if (!editing || editing.isNew) return
    if (!confirm(`确定删除 ${editing.date} 这篇吗？删了就从网站上消失了。`)) return
    setBusy(true)
    setMsg(null)
    try {
      await api.remove(editing.path, editing.sha)
      setEditing(null)
      setOriginal('')
      setMsg({ type: 'ok', text: '🗑️ 已删除，网站稍后自动更新。' })
      refresh()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  async function logout() {
    if (dirty && !confirm('还有没保存的修改，确定退出吗？')) return
    await api.logout()
    onLogout()
  }

  const list = notes[collection] || []

  return (
    <div className="admin">
      <header className="admin-top">
        <div>
          <h1>🛠️ 工作台</h1>
          <p className="admin-sub">写完点保存，网站自动更新</p>
        </div>
        <div className="top-actions">
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">
            看网站 ↗
          </a>
          <button className="btn ghost" onClick={logout}>
            退出
          </button>
        </div>
      </header>

      {msg && <p className={`msg ${msg.type === 'ok' ? 'ok' : 'error'}`}>{msg.text}</p>}

      <div className="admin-body">
        {/* 左边：栏目切换 + 笔记列表 */}
        <aside className="sidebar">
          <div className="seg">
            {Object.entries(COLLECTIONS).map(([key, c]) => (
              <button
                key={key}
                className={`seg-btn ${collection === key ? 'on' : ''}`}
                onClick={() => setCollection(key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <button className="btn primary block" onClick={newNote}>
            ＋ 写新的一篇
          </button>

          <ul className="note-list">
            {list.map((item) => (
              <li key={item.path}>
                <button
                  className={`note-item ${editing?.path === item.path ? 'on' : ''}`}
                  onClick={() => openNote(item)}
                >
                  {item.date}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="empty">还没有笔记</li>}
          </ul>
        </aside>

        {/* 右边：编辑器 + 实时预览 */}
        <section className="editor-area">
          {!editing && (
            <div className="placeholder">
              <p>👈 左边点一篇打开，或者点「写新的一篇」开始。</p>
            </div>
          )}

          {editing && (
            <>
              <div className="editor-head">
                <label className="date-field">
                  日期
                  <input
                    type="date"
                    className="input"
                    value={editing.date}
                    onChange={(e) => changeDate(e.target.value)}
                  />
                </label>
                <span className="path-hint">{editing.path}</span>
                <div className="editor-actions">
                  {!editing.isNew && (
                    <button className="btn danger" onClick={remove} disabled={busy}>
                      删除
                    </button>
                  )}
                  <button
                    className="btn primary"
                    onClick={save}
                    disabled={busy || (!dirty && !editing.isNew)}
                  >
                    {busy ? '保存中…' : dirty || editing.isNew ? '保存并发布' : '已保存'}
                  </button>
                </div>
              </div>

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
                    value={editing.content}
                    onChange={(e) =>
                      setEditing((cur) => ({ ...cur, content: e.target.value }))
                    }
                    spellCheck="false"
                  />
                </div>
                <div className={`pane ${tab === 'preview' ? '' : 'hide-mobile'}`}>
                  <div className="preview-label">网站上的样子</div>
                  <article className="note preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {previewBody(editing.content)}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(null) // null = 还在确认登录状态

  const check = useCallback(async () => {
    try {
      const data = await api.session()
      setAuthed(!!data.authed)
    } catch {
      setAuthed(false)
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  if (authed === null) return <div className="login-wrap">载入中…</div>
  if (!authed) return <Login onDone={() => setAuthed(true)} />
  return <Workbench onLogout={() => setAuthed(false)} />
}
