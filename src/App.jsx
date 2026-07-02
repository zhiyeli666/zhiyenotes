import './App.css'

// ============================================================
//  Youth Market Notes · Home page (simple Step 1 skeleton)
//
//  For whoever reads this code later:
//  - This is a React component named App. Whatever it returns is what
//    shows up on the page.
//  - The <tags> below are written in JSX, which looks a lot like HTML.
//  - To change text, edit the words between the <tags>. For styling,
//    go to App.css.
//  - In Step 2 (around week 5) you'll extend this into a real workbench
//    yourself.
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
    desc: 'A journal of imaginary trades using virtual money only. No real trading — just practicing judgment.',
  },
]

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
