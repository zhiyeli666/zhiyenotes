import './App.css'
import { Children, useState } from 'react'
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
const research = [
  {
    date: '2026-09-18',
    ticker: 'TSLA',
    title: 'A Car Company, Priced as Something Else',
    href: '/research/tesla-car-company-2026',
    desc: 'Everyone says Tesla is an AI and robotics company now, not a car maker. Its own accounts disagree: 73% of revenue still comes from selling cars, and Robotaxi sales are not reported at all. The stock is the other way round — outside estimates rest about two thirds of a $1.4 trillion company on Robotaxi and Optimus, and analyst targets run from $24.86 to $505 on the same day.',
  },
  {
    date: '2026-09-12',
    ticker: 'AAPL',
    title: 'What $877 Billion Bought',
    href: '/research/apple-buybacks-cook-2026',
    desc: 'Tim Cook spent $877 billion buying back Apple shares, and people say that is what lifted the stock. Split the 15-year rise into its only three possible causes and buybacks come last: profit growth did 51% of it, investors paying a higher multiple did 31%, and the buybacks did 18%.',
  },
  {
    date: '2026-09-05',
    ticker: 'SPCX',
    title: 'The Price Was Right',
    href: '/research/spacex-ipo-pricing-2026',
    desc: 'SpaceX sold shares at $135 and they closed the first day at $161, so people say the bankers left $16.6 billion on the table. But the average first-day jump across 9,343 US IPOs since 1980 is 19.0%, and SpaceX was 19.2% — and that number was measured on a day when only 5% of the company could be traded.',
  },
  {
    date: '2026-08-29',
    ticker: 'NVDA',
    title: 'Losing Share, Raising Prices',
    href: '/research/nvidia-custom-silicon-2026',
    desc: 'Google, Amazon, Microsoft and Meta are all making their own AI chips, and it is working — custom chips are now about 28% of AI servers sold. In the same week Nvidia reported sales up 106%, a 75% margin, and said it is putting prices up. A company losing a price war does not do that.',
  },
  {
    date: '2026-08-24',
    ticker: 'GOOGL',
    title: 'Is AI Eating Google?',
    href: '/research/google-ai-search-2026',
    desc: 'Everyone spent a year saying AI would eat Google Search. Over that year search revenue growth accelerated from 10% to 19%, paid clicks rose 13%, and the price per click rose 5%. Something did get eaten — 68% of searches now end without a click to anyone else.',
  },
]

// The columns of the site. To add one, add another item to this array.
// `id` matches the id on the matching section below — it drives both the
// jump-links on the cards and the narrow-screen tab switcher. `tab` is the
// short label used on that switcher, where there is no room for the full name.
const columns = [
  {
    id: 'market-notes',
    title: 'Daily Market Notes',
    photo: '/photos/notes.jpg',
    tab: 'Notes',
    desc: 'Every day I read one real English financial article and write my own reflection — practicing English while learning how markets work.',
  },
  {
    id: 'trading-journal',
    title: 'Virtual Trading Journal',
    photo: '/photos/journal.jpg',
    tab: 'Journal',
    desc: 'A journal of imaginary trades using virtual money only, starting from $1,000,000 in virtual capital. No real trading — just practicing judgment.',
  },
  ...(research.length
    ? [
        {
          id: 'stock-analysis',
          title: 'Stock Analysis',
          photo: '/photos/research.jpg',
          tab: 'Research',
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

  if (/Account Review/i.test(text)) return 'Account review'
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
      // Account reviews mark the end of a week — shown in bold.
      weekly: /Account Review/i.test(text),
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
// 站点 logo：Z 字母标。同时用在 Home 键和 favicon.svg 上。
function ZMark({ size = 18 }) {
  return (
    <svg className="zmark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="zmark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8dfb" />
          <stop offset="0.55" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#4c1fb8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill="url(#zmark-g)" />
      <path fill="#fff" d="M13.4 11.6h21.2v4.05L19.9 32.4h15.1v4.0H12.2v-4.05L26.9 15.6H13.4z" />
      <path fill="#fff" d="M13.4 11.6h21.2v2.5H13.4zM12.2 33.9h22.8v2.5H12.2z" />
    </svg>
  )
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// 把按日期倒序排好的笔记按月份分成一组一组。
// 依赖输入已经是有序的，所以只要相邻同月就往同一组里放。
function groupByMonth(notes) {
  const groups = []
  for (const n of notes) {
    const ym = String(n.key || n.date).slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.ym === ym) last.notes.push(n)
    else groups.push({ ym, notes: [n] })
  }
  return groups
}

function monthLabel(ym) {
  const [y, m] = ym.split('-')
  const name = MONTH_NAMES[Number(m) - 1]
  return name ? name + ' ' + y : ym
}

function NotesSection({ title, notes, id }) {
  return (
    <section className="notes-section" id={id}>
      <h2 className="notes-heading">
        {title}
      </h2>
      <p className="notes-hint">
        {notes.length} entries · click any row to open it
      </p>
      <div className="notes-list">
        {groupByMonth(notes).map((g, gi) => (
          // Only the newest month is expanded; older months start collapsed.
          <details className="month" key={g.ym} open={gi === 0}>
            <summary>
              <span className="month-name">{monthLabel(g.ym)}</span>
              <span className="month-count">
                {g.notes.length} {g.notes.length === 1 ? 'entry' : 'entries'}
              </span>
            </summary>
            <div className="month-notes">
              {g.notes.map((n, i) => (
                // Inside that newest month, only the newest entry is open.
                <details
                  className={n.weekly ? 'note weekly' : 'note'}
                  key={n.key}
                  open={gi === 0 && i === 0}
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
      <h2 className="notes-heading">Stock Analysis</h2>
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
        {groupByMonth(research).map((g, gi) => (
          // Same month blocks as the other two columns: newest month open only.
          <details className="month" key={g.ym} open={gi === 0}>
            <summary>
              <span className="month-name">{monthLabel(g.ym)}</span>
              <span className="month-count">
                {g.notes.length} {g.notes.length === 1 ? 'note' : 'notes'}
              </span>
            </summary>
            <div className="month-notes">
              {g.notes.map((r) => (
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
          </details>
        ))}
      </div>
    </section>
  )
}

function App() {
  // Which column is showing. Only matters on a narrow screen: below the
  // breakpoint in App.css the three columns collapse into a tab switcher and
  // just this one is displayed, full width. On a wide screen the CSS shows all
  // three side by side and ignores this entirely.
  const [openColumn, setOpenColumn] = useState(columns[0].id)
  // Home 键：直接重新加载，这就是定义上的「最初的局面」。
  // 试过在 SPA 内部手动复位（重挂载 + 滚回顶部），但要同时对付 React 的渲染时机、
  // 浏览器的滚动锚定、以及动画帧节流，三样都可能让回顶失败。重载没有这些坑。
  function goHome() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.location.reload()
  }

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
      {/* 左上角固定的 Home 键：回到顶部并把展开状态全部复位 */}
      <button type="button" className="home-btn" onClick={goHome} title="Back to the top">
        <ZMark />
        Home
      </button>

      {/* Top: site title */}
      <header className="hero">
        <h1>Zhiye's Notes</h1>
        <blockquote className="epigraph">
          <p>
            &ldquo;Be fearful when others are greedy, and greedy when others
            are fearful.&rdquo;
            <cite>Warren Buffett</cite>
          </p>
        </blockquote>

        <div className="stats">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Middle: the column cards. Each card jumps down to its matching
          section, and also opens it — otherwise on a narrow screen the jump
          would land on a column the tab switcher is currently hiding. */}
      <section className="columns">
        {columns.map((c) => (
          <a
            className="card"
            key={c.id}
            href={`#${c.id}`}
            onClick={() => setOpenColumn(c.id)}
          >
            <img className="card-photo" src={c.photo} alt="" />
            <h2>{c.title}</h2>
            <p className="card-desc">{c.desc}</p>
          </a>
        ))}
      </section>

      {/* Narrow screens only (hidden by CSS on wide ones): pick one column to
          fill the width, instead of scrolling through all three stacked. */}
      <div className="column-tabs" role="tablist" aria-label="Choose a column">
        {columns.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={openColumn === c.id}
            aria-controls={c.id}
            className={openColumn === c.id ? 'column-tab open' : 'column-tab'}
            onClick={() => setOpenColumn(c.id)}
          >
            {c.tab}
          </button>
        ))}
      </div>

      {/* The columns, side by side on a wide screen. On a narrow one the CSS
          shows only the column named by data-open. The first two are read from
          the markdown folders; the Stock Analysis column links out to
          standalone research pages and only appears once there is a note. */}
      <div className="notes-columns" data-open={openColumn}>
        <NotesSection
          title="Daily Market Notes"
          notes={marketNotes}
          id="market-notes"
        />
        <NotesSection
          title="Virtual Trading Journal"
          notes={diaryNotes}
          id="trading-journal"
        />
        {research.length > 0 && <ResearchSection />}
      </div>

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
