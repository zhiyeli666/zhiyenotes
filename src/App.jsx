import './App.css'
import { Children } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ============================================================
//  Zhiye's Market Notes · Home page
//
//  For whoever reads this code later:
//  - This is a React component named App. Whatever it returns is what
//    shows up on the page.
//  - The <tags> below are written in JSX, which looks a lot like HTML.
//  - To change text, edit the words between the <tags>. For styling,
//    go to App.css.
//  - The daily notes are NOT typed in here. They live as markdown files
//    in the notes/ and portfolio-diary/ folders. This page reads those
//    folders automatically (see "Load notes" below), so to publish a new
//    note you just drop a new .md file in — no code change needed.
// ============================================================

// ---- Deep research notes -----------------------------------------------
// Unlike the two daily columns, each of these is a complete standalone page
// living in public/research/. To publish a new one: drop the .html file into
// public/research/, then add an entry here (newest first). Use the href
// WITHOUT the .html extension — Cloudflare Pages redirects to the clean URL,
// so linking straight to it saves a redirect on every click.
//
// While this list is empty the Stock Analysis card and section hide
// themselves, so the site never shows an empty column.
const research = []

// The columns of the site. To add one, add another item to this array.
const columns = [
  {
    emoji: '📰',
    title: 'Daily Market Notes',
    anchor: '#market-notes',
    desc: 'Every day I read one real English financial article and write my own reflection — practicing English while learning how markets work.',
  },
  {
    emoji: '📈',
    title: 'Virtual Trading Journal',
    anchor: '#trading-journal',
    desc: 'A journal of imaginary trades using virtual money only, starting from $1,000,000 in virtual capital. No real trading — just practicing judgment.',
  },
  ...(research.length
    ? [
        {
          emoji: '🔬',
          title: 'Stock Analysis',
          anchor: '#stock-analysis',
          desc: 'Longer research notes that take one company apart in detail — sourced, with the arithmetic shown. Written with AI assistance.',
        },
      ]
    : []),
]

// ---- Load notes from the markdown files --------------------------------
// import.meta.glob is a Vite feature: it finds every file matching the
// pattern and (with these options) hands us the raw text of each one,
// as an object like { '../notes/2026-06-28.md': '# Daily Market Note...' }.
const marketRaw = import.meta.glob('../notes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const diaryRaw = import.meta.glob('../portfolio-diary/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// One short line describing a note, shown when the card is collapsed.
// Market notes → the article title. Trading journal → the trades.
function summarize(text) {
  const article = text.match(/\*\*Article:\*\*\s*\[([^\]]+)\]/)
  if (article) return article[1]

  const topic = text.match(/\*\*Topic:\*\*\s*([^\n]+)/)
  if (topic) return topic[1]

  const trades = [...text.matchAll(/^-\s+\*\*(Buy|Sell)\s+([^*]+)\*\*/gm)].map(
    (m) => `${m[1]} ${m[2].replace(/\s*\([^)]*\)/g, '').trim()}`,
  )
  if (trades.length) return trades.join(' · ')

  if (/Account Snapshot/i.test(text)) return 'Account snapshot'
  if (/No trades/i.test(text)) return 'No trades'
  return ''
}

// Turn that object into a tidy array, newest date first. We skip the
// template files and any note that still has the empty starter text.
function loadNotes(raw) {
  return Object.entries(raw)
    .filter(([path]) => !path.endsWith('template.md'))
    .filter(([, text]) => !text.includes('Use [Prompt A]'))
    .map(([path, text]) => ({
      // '../notes/2026-06-28.md' -> '2026-06-28'
      key: path.split('/').pop().replace('.md', ''),
      title: summarize(text),
      // Account snapshots mark the end of a week — shown in bold.
      weekly: /Account Snapshot/i.test(text),
      body: text
        // Drop the first "# Heading" line — the section title covers it.
        .replace(/^#[^\n]*\n/, '')
        // Drop the "**Date:**" line — the date badge shows it instead.
        .replace(/^\s*\*\*Date:\*\*[^\n]*\n/m, '')
        .trim(),
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

const marketNotes = loadNotes(marketRaw)
const diaryNotes = loadNotes(diaryRaw)

// ---- Small helpers that make the notes easier to read ------------------

// Money amounts that carry a + or - sign get coloured green / red.
const MONEY = /([+-]\$[\d,]+(?:\.\d+)?|[+-][\d,]+\.\d{2}\b|[+-][\d.]+%)/g
const IS_MONEY = /^[+-]/

function withMoney(children) {
  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child
    return child
      .split(MONEY)
      .map((part, i) =>
        IS_MONEY.test(part) ? (
          <span key={i} className={part[0] === '-' ? 'neg' : 'pos'}>
            {part}
          </span>
        ) : (
          part
        ),
      )
  })
}

// "**Buy 700 TSLA**" / "**Sell 300 MSFT**" become coloured tags.
function flatten(children) {
  return Children.toArray(children)
    .map((c) => (typeof c === 'string' ? c : ''))
    .join('')
}

const mdComponents = {
  strong: ({ children }) => {
    const text = flatten(children)
    if (/^Buy\b/.test(text)) return <strong className="tag buy">{children}</strong>
    if (/^Sell\b/.test(text)) return <strong className="tag sell">{children}</strong>
    return <strong>{children}</strong>
  },
  li: ({ children }) => <li>{withMoney(children)}</li>,
  p: ({ children }) => <p>{withMoney(children)}</p>,
  td: ({ children }) => <td>{withMoney(children)}</td>,
}

// One section = a heading + a stack of collapsible note cards.
// The `id` lets the cards above link straight down to this section.
function NotesSection({ emoji, title, notes, id }) {
  return (
    <section className="notes-section" id={id}>
      <h2 className="notes-heading">
        {emoji} {title}
      </h2>
      <p className="notes-hint">
        {notes.length} entries · click any row to open it
      </p>
      <div className="notes-list">
        {notes.map((n, i) => (
          // The newest three are open already; the rest start collapsed.
          <details
            className={n.weekly ? 'note weekly' : 'note'}
            key={n.key}
            open={i < 3}
          >
            <summary>
              <span className="note-date">{n.key}</span>
              <span className="note-title">{n.title}</span>
            </summary>
            <div className="note-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {n.body}
              </ReactMarkdown>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

// The Stock Analysis column: one row per research paper, each linking out to
// its own full page.
function ResearchSection() {
  return (
    <section className="research-section" id="stock-analysis">
      <h2 className="notes-heading">🔬 Stock Analysis</h2>
      <p className="notes-hint">
        {research.length} {research.length === 1 ? 'note' : 'notes'} · click to
        read the full paper
      </p>
      <p className="ai-note">
        <strong>Written with AI assistance.</strong> I use an AI assistant to
        gather the reported figures, check the arithmetic, and help draft these
        longer notes. Every number is linked to its source, and anything
        calculated rather than read off a company report is marked as derived so
        you can check it yourself. The argument, and any mistake in it, is mine.
      </p>
      <div className="research-list">
        {research.map((r) => (
          <a className="research-item" key={r.href} href={r.href}>
            <div className="research-meta">
              <span className="note-date">{r.date}</span>
              <span className="research-tag">{r.ticker}</span>
            </div>
            <h3>{r.title}</h3>
            <p>{r.desc}</p>
            <span className="research-more">Read the full note →</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function App() {
  // How many different days are covered across both daily columns.
  const days = new Set([...marketNotes, ...diaryNotes].map((n) => n.key)).size

  const stats = [
    { value: marketNotes.length, label: 'market notes' },
    { value: diaryNotes.length, label: 'journal days' },
    // Only counts once there is at least one research note to point at.
    ...(research.length
      ? [
          {
            value: research.length,
            label: research.length === 1 ? 'research note' : 'research notes',
          },
        ]
      : []),
    { value: days, label: 'days covered' },
  ]

  return (
    <main className="page">
      {/* Top: site title */}
      <header className="hero">
        <h1>Zhiye's Market Notes</h1>
        <p className="subtitle">Reading &amp; Writing About Markets in English</p>
        <p className="tagline">
          A teenager's public log of reading real financial news and thinking
          out loud about markets.
        </p>

        <div className="stats">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Middle: the two column cards. Each card is a link that jumps
          down to its matching notes section below. */}
      <section className="columns">
        {columns.map((c) => (
          <a className="card" key={c.title} href={c.anchor}>
            <div className="card-emoji">{c.emoji}</div>
            <h2>{c.title}</h2>
            <p className="card-desc">{c.desc}</p>
          </a>
        ))}
      </section>

      {/* The actual notes, read from the markdown folders.
          Side by side on a wide screen, stacked on a narrow one. */}
      <div className="notes-columns">
        <NotesSection
          emoji="📰"
          title="Daily Market Notes"
          notes={marketNotes}
          id="market-notes"
        />
        <NotesSection
          emoji="📈"
          title="Virtual Trading Journal"
          notes={diaryNotes}
          id="trading-journal"
        />
      </div>

      {/* The deep research column. Each entry opens its own full page. */}
      {research.length > 0 && <ResearchSection />}

      {/* Bottom: notes + disclaimer */}
      <footer className="footer">
        <p>
          This site links to original articles and shares only my own
          reflections — no full reprints. The trading journal is a learning
          simulation using virtual money and is not investment advice.
          {research.length > 0 && (
            <>
              {' '}
              The Stock Analysis notes are researched and drafted with AI
              assistance, with every figure sourced and derived numbers marked
              as derived.
            </>
          )}
        </p>
      </footer>
    </main>
  )
}

export default App
