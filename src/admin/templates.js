// 新建笔记时预填的模板。{{date}} 会被替换成所选日期。

export const MARKET_TEMPLATE = `# Daily Market Note

**Date:** {{date}}

**Article:** [文章标题](原文链接) — 来源, {{date}}

---

### ✍️ Reflection

（在这里写今天的英文感想，3–5 句话。）

---

*Copyright note: this page links to the original article and shares only my own reflection. No full reprint.*
`

export const DIARY_TEMPLATE = `# Simulated Portfolio Diary

**Date:** {{date}}

> ⚠️ Virtual-money record — not a real trade.

### 📊 Account Review

- **Net asset value:** $
- **Today's P&L:**
- **Cash:** $

### 📦 Current Holdings

| Stock | Shares | Price | Cost | P&L % |
|---|---:|---:|---:|---:|
|  |  |  |  |  |

### 🤔 My Reasoning

（为什么这么操作？）

---

*Disclaimer: a learning simulation only. Not investment advice, and no real money is involved.*
`

// 两个栏目的配置。后台左侧的切换、以及保存到哪个文件夹都看这里。
export const COLLECTIONS = {
  notes: {
    label: '📰 每日市场笔记',
    dir: 'notes',
    template: MARKET_TEMPLATE,
  },
  'portfolio-diary': {
    label: '📈 模拟盘日记',
    dir: 'portfolio-diary',
    template: DIARY_TEMPLATE,
  },
}
