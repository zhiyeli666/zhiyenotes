// 构建时给 public/research/ 下的每一篇研究页自动插入左上角的 Home 键。
//
// 为什么放在构建里而不是写进每个 html：研究页是一篇篇手写的独立页面，
// 每加一篇就要记得复制一遍按钮，迟早会漏。这里统一注入，新增页面什么都不用做。
//
// 只改 dist/ 里的产物，public/ 下的源文件保持干净（只管内容）。
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BUTTON = `<a class="home-btn" href="/" title="Back to Zhiye's Notes">
<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="zg-home" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8dfb"/><stop offset="0.55" stop-color="#1d4ed8"/><stop offset="1" stop-color="#4c1fb8"/></linearGradient></defs><rect width="48" height="48" rx="11" fill="url(#zg-home)"/><path fill="#fff" d="M13.4 11.6h21.2v4.05L19.9 32.4h15.1v4.0H12.2v-4.05L26.9 15.6H13.4z"/><path fill="#fff" d="M13.4 11.6h21.2v2.5H13.4zM12.2 33.9h22.8v2.5H12.2z"/></svg>
Home</a>
`

const STYLE = `
/* 返回首页（由 scripts/inject-research-home.js 在构建时插入） */
.home-btn{position:fixed;top:18px;left:18px;z-index:50;display:inline-flex;align-items:center;gap:7px;
padding:9px 15px 9px 12px;font:600 13px/1 system-ui,'Segoe UI',Roboto,sans-serif;letter-spacing:.4px;
color:#8a94a6;background:#fff;border:1px solid #e0e5ee;border-radius:999px;text-decoration:none;
transition:color .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease}
.home-btn svg{width:17px;height:17px;border-radius:4px;flex-shrink:0}
.home-btn:hover{color:#1d4ed8;border-color:rgba(29,78,216,.35);
box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.06);transform:translateY(-1px)}
@media(max-width:720px){.home-btn{top:12px;left:12px;padding:9px;font-size:0;gap:0}
.home-btn svg{width:19px;height:19px}}
`

export function injectResearchHome() {
  return {
    name: 'inject-research-home',
    apply: 'build',
    async closeBundle() {
      const dir = join(import.meta.dirname, '..', 'dist', 'research')
      if (!existsSync(dir)) return

      const files = (await readdir(dir)).filter((f) => f.endsWith('.html'))
      let done = 0
      const skipped = []

      for (const file of files) {
        const path = join(dir, file)
        let html = await readFile(path, 'utf8')

        // 已经有了就不重复插（手写页面里自己加过的情况）
        if (html.includes('class="home-btn"')) {
          skipped.push(`${file} (already has one)`)
          continue
        }
        // 结构不对就跳过并报出来，别默默改坏
        if (!html.includes('</style>') || !html.includes('<body>')) {
          skipped.push(`${file} (no <body> or </style>)`)
          continue
        }

        html = html.replace('</style>', `${STYLE}</style>`)
        html = html.replace('<body>', `<body>\n${BUTTON}`)
        await writeFile(path, html)
        done++
      }

      console.log(`\n  research pages: Home 键已注入 ${done}/${files.length} 篇`)
      for (const s of skipped) console.log(`    skipped: ${s}`)
    },
  }
}
