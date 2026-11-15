import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderResearchPage } from '../functions/_lib/research-page.js'
import {
  parseResearchDocument,
  rebuildResearchSource,
} from '../functions/_lib/research-index.js'
import { planResearchDelete, planResearchSave, slugifyTitle } from '../functions/_lib/research-publish.js'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const nvidia = readFileSync(
  new URL('../public/research/nvidia-business-did-not-resign-2026.html', import.meta.url),
  'utf8',
)
const baseCss = nvidia.slice(nvidia.indexOf('<style>\n') + '<style>\n'.length, nvidia.indexOf('</style>'))

const sample = `## Verdict

The claim does not survive the accounts.

Revenue was $96.2 billion, and the guide was already public.

## What the quarter said

Nvidia's own release is [here](https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition). Data Center was about 92.5% of revenue {derived}.

| Measure | Q2 | Change |
| --- | ---: | ---: |
| Revenue | $96.2 billion | +106% |
| Shares | 14.6B | −44% |
| **Share price** | **—** | **{+}24×** |

^ **Table 1.** Reported figures, except the share that is {derived}.

> **The claim.** The business left with the founder.

> ! The stock move is not, by itself, a result.

- Keep the volume fixed
- Lower only the price

## Notes and sources

**Written with AI assistance.** Calculated figures are marked {derived}.

**This is a learning exercise, not investment advice.** I would rather be corrected than believed.

### Sources

1. [NVIDIA Announces CEO Transition](https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition) — NVIDIA Newsroom, November 12, 2026
`

const page = renderResearchPage({
  title: 'A <script> Title',
  lede: 'Opening with a [source](https://example.com/report) and a figure {derived}.',
  byline: 'Data through Q2 FY2027',
  date: '2026-11-16',
  number: 13,
  body: sample,
})

assert.ok(page.includes(baseCss), 'generated page is missing the shared research stylesheet')
assert.ok(page.includes('Research Note · No. 13'))
assert.ok(page.includes('<h1>A &lt;script&gt; Title</h1>'))
assert.ok(page.includes('<title>A &lt;script&gt; Title</title>'))
assert.ok(page.includes('class="lede"'))
assert.ok(page.includes('href="https://example.com/report"'))
assert.ok(page.includes('<p class="byline">Zhiye\'s Notes · November 16, 2026 · Data through Q2 FY2027</p>'))
assert.ok(page.includes('<div class="verdict">'))
assert.ok(page.includes('<p class="big">The claim does not survive the accounts.</p>'))
assert.ok(page.includes('<div class="tw">'))
assert.ok(page.includes('<td class="n">$96.2 billion</td>'))
assert.ok(page.includes('<td class="n pos">+106%</td>'))
assert.ok(page.includes('<td class="n neg">−44%</td>'))
assert.ok(page.includes('<tr class="total">'))
assert.ok(page.includes('<span class="tag d">derived</span>'))
assert.ok(page.includes('<caption>'))
assert.ok(page.includes('<div class="callout">'))
assert.ok(page.includes('<div class="callout warn">'))
assert.ok(page.includes('<ul class="tight">'))
assert.ok(page.includes('<div class="footer">'))
assert.equal(page.split('Nothing here is investment advice.').length - 1, 1)
assert.ok(page.includes('href="https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition"'))
assert.equal(page.includes('javascript:'), false)

const codePage = renderResearchPage({
  title: 'Code',
  lede: 'Lede',
  byline: '',
  date: '2026-11-16',
  number: 13,
  body: 'Use `{derived}` when you mean the marker itself.\n\n[nope](javascript:alert(1))',
})
assert.ok(codePage.includes('<code>{derived}</code>'))
assert.equal(codePage.includes('javascript:'), false)
assert.ok(codePage.includes('<p class="byline">Zhiye\'s Notes · November 16, 2026</p>'))

assert.equal(slugifyTitle('The Business Did Not Resign', '2026-11-16'), 'the-business-did-not-resign-2026')
assert.equal(slugifyTitle('Is AI Eating Google?', '2026-08-24'), 'is-ai-eating-google-2026')

const doc = parseResearchDocument(appSource)
assert.equal(doc.entries.length, 12)
assert.equal(doc.entries[0].title, 'The Business Did Not Resign')
assert.equal(doc.entries[0].href, '/research/nvidia-business-did-not-resign-2026')
assert.equal(rebuildResearchSource(appSource), appSource)

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const taken = doc.entries.map((entry) => entry.href.replace('/research/', ''))

const created = planResearchSave({
  appSource,
  noteNumbers: numbers,
  takenSlugs: taken,
  sourceSlugs: [],
  existingNumber: null,
  payload: {
    title: 'A Fresh Look',
    ticker: 'NVDA',
    date: '2026-11-16',
    desc: "A new note's summary, with an apostrophe.",
    lede: 'The opening paragraph.',
    byline: 'Data through today',
    slug: 'a-fresh-look-2026',
    body: sample,
  },
})
assert.equal(created.number, 13)
assert.equal(created.href, '/research/a-fresh-look-2026')
assert.ok(created.files.some((file) => file.path === 'public/research/a-fresh-look-2026.html' && file.content.includes('No. 13')))
assert.ok(created.files.some((file) => file.path === 'research-src/a-fresh-look-2026.json'))
const createdApp = created.files.find((file) => file.path === 'src/App.jsx').content
for (const entry of doc.entries) assert.ok(createdApp.includes(entry.raw), entry.href)
assert.ok(createdApp.includes('/research/a-fresh-look-2026'))
assert.equal(parseResearchDocument(createdApp).entries[0].title, 'A Fresh Look')
assert.equal(parseResearchDocument(createdApp).entries[1].href, doc.entries[0].href)

const older = planResearchSave({
  appSource,
  noteNumbers: numbers,
  takenSlugs: taken,
  sourceSlugs: [],
  existingNumber: null,
  payload: {
    title: 'An Older Note',
    ticker: 'AAPL',
    date: '2026-09-01',
    desc: 'Between the September notes.',
    lede: 'Opening.',
    byline: '',
    slug: 'an-older-note-2026',
    body: '## Later\n\nText.\n',
  },
})
const olderEntries = parseResearchDocument(older.files.find((file) => file.path === 'src/App.jsx').content).entries
const olderIndex = olderEntries.findIndex((entry) => entry.href === '/research/an-older-note-2026')
assert.ok(olderIndex > 0)
assert.ok(olderEntries[olderIndex - 1].date >= '2026-09-01')
assert.ok(olderEntries[olderIndex + 1].date < '2026-09-01')

assert.throws(
  () =>
    planResearchSave({
      appSource,
      noteNumbers: numbers,
      takenSlugs: taken,
      sourceSlugs: [],
      existingNumber: null,
      payload: {
        title: 'Clash',
        ticker: 'NVDA',
        date: '2026-11-16',
        desc: 'Nope.',
        lede: 'Nope.',
        slug: 'nvidia-business-did-not-resign-2026',
        body: 'Text',
      },
    }),
  /已经有一篇/,
)

const legacy = planResearchSave({
  appSource,
  noteNumbers: numbers,
  takenSlugs: taken,
  sourceSlugs: [],
  existingNumber: 12,
  payload: {
    originalSlug: 'nvidia-business-did-not-resign-2026',
    slug: 'nvidia-business-did-not-resign-2026',
    title: 'The Business Did Not Resign',
    ticker: 'NVDA',
    date: '2026-11-15',
    desc: 'Updated homepage summary only.',
  },
})
assert.deepEqual(
  legacy.files.map((file) => file.path),
  ['src/App.jsx'],
)
const legacyEntries = parseResearchDocument(legacy.files[0].content).entries
assert.equal(legacyEntries[0].desc, 'Updated homepage summary only.')
assert.equal(legacyEntries[0].href, '/research/nvidia-business-did-not-resign-2026')
for (const entry of doc.entries.slice(1)) assert.ok(legacy.files[0].content.includes(entry.raw))

assert.throws(
  () =>
    planResearchSave({
      appSource,
      noteNumbers: numbers,
      takenSlugs: taken,
      sourceSlugs: [],
      existingNumber: 12,
      payload: {
        originalSlug: 'nvidia-business-did-not-resign-2026',
        slug: 'nvidia-business-did-not-resign-2026',
        title: 'The Business Did Not Resign',
        ticker: 'NVDA',
        date: '2026-11-15',
        desc: doc.entries[0].desc,
        body: 'Trying to rewrite the hand-written page.',
      },
    }),
  /不会重写正文/,
)

const edited = planResearchSave({
  appSource,
  noteNumbers: numbers,
  takenSlugs: taken,
  sourceSlugs: ['nvidia-business-did-not-resign-2026'],
  existingNumber: 13,
  payload: {
    originalSlug: 'nvidia-business-did-not-resign-2026',
    slug: 'nvidia-business-did-not-resign-2026',
    title: doc.entries[0].title,
    ticker: doc.entries[0].ticker,
    date: doc.entries[0].date,
    desc: doc.entries[0].desc,
    lede: 'Same listing, new body.',
    byline: '',
    body: '## Updated\n\nOnly the page.\n',
  },
})
assert.equal(
  edited.files.some((file) => file.path === 'src/App.jsx'),
  false,
)
assert.ok(edited.files.some((file) => file.path === 'public/research/nvidia-business-did-not-resign-2026.html'))

const removed = planResearchDelete({
  appSource,
  slug: 'google-ai-search-2026',
  hasHtml: true,
  hasSource: false,
})
const removedApp = removed.files.find((file) => file.path === 'src/App.jsx').content
assert.equal(removedApp.includes('/research/google-ai-search-2026'), false)
for (const entry of doc.entries.filter((item) => item.href !== '/research/google-ai-search-2026')) {
  assert.ok(removedApp.includes(entry.raw))
}
assert.ok(removed.files.some((file) => file.path === 'public/research/google-ai-search-2026.html' && file.content == null))

console.log('research page tests passed')
