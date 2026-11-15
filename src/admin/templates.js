// 新建笔记时预填的模板。{{date}} 会被替换成所选日期。

export const MARKET_TEMPLATE = `# Daily Market Note

**Date:** {{date}}

**Article:** [文章标题](原文链接) — 来源, {{date}}

---

### ✍️ Reflection

（在这里写今天的英文感想，3–5 句话。）
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
`

// 股票分析的正文骨架。导语、标题、日期在表单里单独填，不写在这里。
export const RESEARCH_TEMPLATE = `## Verdict

State the conclusion in one sentence.

One or two paragraphs of the evidence behind it.

## The claim

Write the argument here. Link a source like [the company release](https://example.com). After a figure you calculated yourself, write {derived}.

| Measure | Figure |
| --- | ---: |
| Revenue | $0 {derived} |

> **The claim.** State the claim this note is testing.

## Notes and sources

**Written with AI assistance.** I used an AI assistant to gather the reported figures, check the arithmetic and help draft this note. Anything I calculated rather than read off a report is marked {derived}. The argument, and any mistake in it, is mine.

**How the numbers were put together.** Explain each derived figure here.

**This is a learning exercise, not investment advice.** I am a teenager writing publicly about how to read a business. I would rather be corrected than believed.

### Sources

1. [Source title](https://example.com) — Publication, Month D, YYYY
`

// 几个栏目的配置。后台左侧的切换、以及保存到哪个文件夹都看这里。
export const COLLECTIONS = {
  notes: {
    label: '📰 每日市场笔记',
    dir: 'notes',
    template: MARKET_TEMPLATE,
  },
  'portfolio-diary': {
    label: '📈 模拟盘日记（100万，已结束）',
    dir: 'portfolio-diary',
    template: DIARY_TEMPLATE,
  },
  'portfolio-diary-10k': {
    label: '📈 模拟盘日记（1万）',
    dir: 'portfolio-diary-10k',
    template: DIARY_TEMPLATE,
  },
}
