// 把工作台里写的 Markdown 收成一篇跟 public/research/ 现有笔记一样的 HTML 页。
// 样式用 research-style.js 里那份共用样式；编号、标题、导语、日期行由调用方传入。

import { RESEARCH_CSS, RESEARCH_CSS_EXTRA } from './research-style.js'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DISCLAIMER =
  'This page links to original sources and shares only my own analysis — no full reprints. Nothing here is investment advice.'

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatLongDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

export function formatByline(iso, extra) {
  const main = `Zhiye's Notes · ${formatLongDate(iso)}`
  const tail = (extra || '').trim()
  return tail ? `${main} · ${tail}` : main
}

export function extractNoteNumber(html) {
  const match = String(html).match(/Research Note · No\. (\d+)/)
  return match ? Number(match[1]) : null
}

function safeUrl(url) {
  const trimmed = url.trim()
  if (!trimmed || /[\s<>"']/.test(trimmed)) return null
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed
  if (/^(\/|\.\/|\.\.\/|#)/.test(trimmed)) return trimmed
  return null
}

// 行内：代码、链接、加粗、斜体，以及 {derived}。
function renderInline(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    if (src.startsWith('```', i)) {
      // 行内不吃围栏；交给块级解析。这里按普通字符走。
    }

    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1)
      if (end > i + 1) {
        out += `<code>${escapeHtml(src.slice(i + 1, end))}</code>`
        i = end + 1
        continue
      }
    }

    if (src.startsWith('{derived}', i)) {
      out += '<span class="tag d">derived</span>'
      i += '{derived}'.length
      continue
    }

    if (src.startsWith('***', i)) {
      const end = src.indexOf('***', i + 3)
      if (end > i + 3) {
        out += `<strong><em>${renderInline(src.slice(i + 3, end))}</em></strong>`
        i = end + 3
        continue
      }
    }

    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end > i + 2) {
        out += `<strong>${renderInline(src.slice(i + 2, end))}</strong>`
        i = end + 2
        continue
      }
    }

    if (src[i] === '[') {
      const link = parseLink(src, i)
      if (link) {
        out += link.html
        i = link.end
        continue
      }
    }

    if (src[i] === '*') {
      const end = src.indexOf('*', i + 1)
      if (end > i + 1 && src[end - 1] !== ' ') {
        out += `<em>${renderInline(src.slice(i + 1, end))}</em>`
        i = end + 1
        continue
      }
    }

    out += escapeHtml(src[i])
    i++
  }
  return out
}

function parseLink(src, start) {
  const close = src.indexOf(']', start + 1)
  if (close < 0 || src[close + 1] !== '(') return null
  const urlEnd = src.indexOf(')', close + 2)
  if (urlEnd < 0) return null
  let url = src.slice(close + 2, urlEnd).trim()
  url = url.replace(/\s+["'][^"']*["']$/, '')
  const text = src.slice(start + 1, close)
  const href = safeUrl(url)
  const inner = renderInline(text)
  if (!href) return { html: inner, end: urlEnd + 1 }
  return { html: `<a href="${escapeHtml(href)}">${inner}</a>`, end: urlEnd + 1 }
}

function isSeparator(line) {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
}

function splitRow(line) {
  let raw = line.trim()
  if (raw.startsWith('|')) raw = raw.slice(1)
  if (raw.endsWith('|')) raw = raw.slice(0, -1)
  const cells = []
  let current = ''
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && raw[i + 1] === '|') {
      current += '|'
      i++
      continue
    }
    if (raw[i] === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += raw[i]
  }
  cells.push(current.trim())
  return cells
}

function columnAlign(cell) {
  const text = cell.trim()
  const left = text.startsWith(':')
  const right = text.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return 'left'
}

function unwrapBold(text) {
  if (text.startsWith('**') && text.endsWith('**') && text.length > 4) {
    const inner = text.slice(2, -2)
    if (!inner.includes('**')) return inner
  }
  return null
}

function decorateCell(raw, align) {
  let text = raw.trim()
  const classes = []
  if (align === 'right') classes.push('n')
  if (align === 'center') classes.push('c')
  if (text.startsWith('{+}')) {
    classes.push('pos')
    text = text.slice(3).trim()
  } else if (text.startsWith('{-}')) {
    classes.push('neg')
    text = text.slice(3).trim()
  } else if (align === 'right' && text.startsWith('+')) {
    classes.push('pos')
  } else if (align === 'right' && (text.startsWith('-') || text.startsWith('−') || text.startsWith('–'))) {
    classes.push('neg')
  }
  const classAttr = classes.length ? ` class="${classes.join(' ')}"` : ''
  return `<td${classAttr}>${renderInline(text)}</td>`
}

function renderTable(lines, caption) {
  const header = splitRow(lines[0])
  const align = splitRow(lines[1]).map(columnAlign)
  const body = lines.slice(2).map(splitRow)
  const headHtml = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('')
  const rows = body
    .map((cells) => {
      const unwrapped = cells.map(unwrapBold)
      const total = unwrapped.every((cell) => cell != null)
      const source = total ? unwrapped : cells
      const tds = source
        .map((cell, index) => decorateCell(cell, align[index] || 'left'))
        .join('')
      return `<tr${total ? ' class="total"' : ''}>${tds}</tr>`
    })
    .join('\n')
  const captionHtml = caption ? `<caption>${renderInline(caption)}</caption>` : ''
  return `<div class="tw">\n<table>\n${captionHtml}<thead><tr>${headHtml}</tr></thead>\n<tbody>\n${rows}\n</tbody>\n</table>\n</div>\n\n`
}

function renderQuote(text) {
  const lines = text.split('\n')
  let warn = false
  if (/^! /.test(lines[0]) || /^\[!(?:WARNING|CAUTION)\]/i.test(lines[0])) {
    warn = true
    lines[0] = lines[0].replace(/^! /, '').replace(/^\[!(?:WARNING|CAUTION)\]\s*/i, '')
  } else if (/^\[!(?:NOTE|TIP)\]/i.test(lines[0])) {
    lines[0] = lines[0].replace(/^\[!(?:NOTE|TIP)\]\s*/i, '')
  }
  const paragraphs = lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  const inner = paragraphs
    .map((part) => `<p>${renderInline(part.replace(/\s*\n\s*/g, ' '))}</p>`)
    .join('\n')
  return `<div class="callout${warn ? ' warn' : ''}">\n${inner}\n</div>\n\n`
}

function renderList(block) {
  const tag = block.type === 'ol' ? 'ol' : 'ul'
  const cls = tag === 'ul' ? ' class="tight"' : ''
  const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join('\n')
  return `<${tag}${cls}>\n${items}\n</${tag}>\n\n`
}

function isListLine(line) {
  return /^\s*(?:[-*+]\s+|\d+\.\s+)\S/.test(line)
}

function isTableStart(lines, index) {
  return Boolean(lines[index]?.includes('|') && lines[index + 1] && isSeparator(lines[index + 1]))
}

function startsBlock(line) {
  return (
    /^(#{1,4})\s+\S/.test(line) ||
    line.trimStart().startsWith('>') ||
    line.trimStart().startsWith('```') ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()) ||
    isListLine(line) ||
    line.startsWith('^ ')
  )
}

function parseBlocks(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++
      continue
    }
    const line = lines[i]

    if (line.trimStart().startsWith('```')) {
      const buf = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'code', text: buf.join('\n') })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      i++
      continue
    }

    if (line.startsWith('^ ')) {
      blocks.push({ type: 'caption', text: line.slice(2).trim() })
      i++
      continue
    }

    if (isTableStart(lines, i)) {
      const tableLines = []
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'table', lines: tableLines })
      continue
    }

    if (line.trimStart().startsWith('>')) {
      const buf = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        // 只写一个 ">" 的行是引用里的空行，用来分段；真正的空行会结束这一段引用。
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', text: buf.join('\n') })
      continue
    }

    if (isListLine(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items = []
      while (i < lines.length && lines[i].trim() && (isListLine(lines[i]) || (items.length && /^\s+\S/.test(lines[i])))) {
        if (isListLine(lines[i])) items.push(lines[i].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))
        else items[items.length - 1] += ` ${lines[i].trim()}`
        i++
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items })
      continue
    }

    const buf = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i]) && !isTableStart(lines, i)) {
      buf.push(lines[i].trim())
      i++
    }
    blocks.push({ type: 'p', text: buf.join(' ') })
  }

  return blocks
}

function isVerdict(text) {
  return /^verdict:?$/i.test(text.trim())
}

function isSources(text) {
  return /^sources:?$/i.test(text.trim())
}

function renderLooseBlock(block) {
  switch (block.type) {
    case 'heading': {
      const level = block.level <= 2 ? 2 : 3
      return `<h${level}>${renderInline(block.text)}</h${level}>\n\n`
    }
    case 'p':
      return `<p>${renderInline(block.text)}</p>\n`
    case 'quote':
      return renderQuote(block.text)
    case 'ul':
    case 'ol':
      return renderList(block)
    case 'code':
      return `<pre><code>${escapeHtml(block.text)}</code></pre>\n\n`
    case 'hr':
      return '<hr>\n\n'
    case 'caption':
      return `<p>${renderInline(block.text)}</p>\n`
    case 'table':
      return renderTable(block.lines, null)
    default:
      return ''
  }
}

function renderSequence(blocks, { bigFirst = false } = {}) {
  let html = ''
  let i = 0
  let usedBig = false
  while (i < blocks.length) {
    const block = blocks[i]

    if (block.type === 'heading' && isVerdict(block.text)) {
      const inner = []
      i++
      while (
        i < blocks.length &&
        !(blocks[i].type === 'heading' && blocks[i].level <= block.level)
      ) {
        inner.push(blocks[i])
        i++
      }
      html += `<div class="verdict">\n<h2>${renderInline(block.text)}</h2>\n${renderSequence(inner, { bigFirst: true })}</div>\n\n`
      continue
    }

    if (block.type === 'heading' && isSources(block.text)) {
      html += renderFooter(blocks.slice(i + 1))
      break
    }

    if (block.type === 'table') {
      let caption = null
      if (blocks[i + 1]?.type === 'caption') {
        caption = blocks[i + 1].text
        i += 2
      } else {
        i += 1
      }
      html += renderTable(block.lines, caption)
      continue
    }

    if (bigFirst && !usedBig && block.type === 'p') {
      usedBig = true
      html += `<p class="big">${renderInline(block.text)}</p>\n`
      i++
      continue
    }

    html += renderLooseBlock(block)
    i++
  }
  return html
}

function renderFooter(blocks) {
  const body = renderSequence(blocks)
  const disclaimer = body.includes('Nothing here is investment advice')
    ? ''
    : `<p style="margin-top:18px">${DISCLAIMER}</p>\n`
  return `<div class="footer">\n<p><strong>Sources</strong></p>\n${body}${disclaimer}</div>\n`
}

export function renderResearchBody(markdown) {
  return renderSequence(parseBlocks(markdown || ''))
}

function displayNumber(number) {
  if (typeof number === 'number' && Number.isInteger(number) && number > 0) return String(number)
  if (typeof number === 'string' && /^\d+$/.test(number)) return String(Number(number))
  return '…'
}

export function renderResearchPage({ title, lede, byline, date, number, body }) {
  const noteNo = displayNumber(number)
  const bylineText = formatByline(date, byline)
  let article = renderResearchBody(body).trimEnd()
  if (!article.includes('Nothing here is investment advice')) {
    article += `\n\n<div class="footer">\n<p style="margin-top:18px">${DISCLAIMER}</p>\n</div>`
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${RESEARCH_CSS}${RESEARCH_CSS_EXTRA}</style>
</head>
<body>
<main class="paper">

<p class="eyebrow">Research Note · No. ${noteNo}</p>
<h1>${escapeHtml(title)}</h1>
<p class="lede">${renderInline(lede)}</p>
<p class="byline">${escapeHtml(bylineText)}</p>

${article}

</main>
</body>
</html>
`
}
