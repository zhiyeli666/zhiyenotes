import './App.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ============================================================
//  Youth Market Notes · Home page
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

// The two columns of the site. To add one, add another item to this array.
const columns = [
  {
    emoji: '📰',
    title: 'Daily Market Notes',
    desc: 'Every day I read one real English financial article and write my own reflection — practicing English while learning how markets work.',
  },
  {
    emoji: '📈',
    title: 'Simulated Portfolio Diary',
    desc: 'A journal of imaginary trades using virtual money only, starting from $1,000,000 in virtual capital. No real trading — just practicing judgment.',
  },
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

// Turn that object into a tidy array, newest date first. We skip the
// template files and any note that still has the empty starter text.
function loadNotes(raw) {
  return Object.entries(raw)
    .filter(([path]) => !path.endsWith('template.md'))
    .filter(([, text]) => !text.includes('Use [Prompt A]'))
    .map(([path, text]) => ({
      // '../notes/2026-06-28.md' -> '2026-06-28'
      key: path.split('/').pop().replace('.md', ''),
      // Drop the first "# Heading" line — the section title covers it.
      body: text.replace(/^#[^\n]*\n/, '').trim(),
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

const marketNotes = loadNotes(marketRaw)
const diaryNotes = loadNotes(diaryRaw)

// One section = a heading + a stack of note cards.
function NotesSection({ emoji, title, notes }) {
  return (
    <section className="notes-section">
      <h2 className="notes-heading">
        {emoji} {title}
      </h2>
      <div className="notes-list">
        {notes.map((n) => (
          <article className="note" key={n.key}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.body}</ReactMarkdown>
          </article>
        ))}
      </div>
    </section>
  )
}

function App() {
  return (
    <main className="page">
      {/* Top: site title */}
      <header className="hero">
        <h1>Youth Market Notes</h1>
        <p className="subtitle">Reading &amp; Writing About Markets in English</p>
        <p className="tagline">
          A teenager's public log of reading real financial news and thinking
          out loud about markets.
        </p>
      </header>

      {/* Middle: the two column cards */}
      <section className="columns">
        {columns.map((c) => (
          <article className="card" key={c.title}>
            <div className="card-emoji">{c.emoji}</div>
            <h2>{c.title}</h2>
            <p className="card-desc">{c.desc}</p>
          </article>
        ))}
      </section>

      {/* The actual notes, read from the markdown folders */}
      <NotesSection emoji="📰" title="Daily Market Notes" notes={marketNotes} />
      <NotesSection
        emoji="📈"
        title="Simulated Portfolio Diary"
        notes={diaryNotes}
      />

      {/* Bottom: notes + disclaimer */}
      <footer className="footer">
        <p>
          This site links to original articles and shares only my own
          reflections — no full reprints. The portfolio diary is a learning
          simulation using virtual money and is not investment advice.
        </p>
      </footer>
    </main>
  )
}

export default App
