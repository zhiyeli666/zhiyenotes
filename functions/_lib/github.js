// 和 GitHub 仓库打交道：读文件、写文件、删文件。
// 工作台点"保存"，最终就是在这里把 .md 文件提交进仓库；
// 提交后 GitHub Actions 会自动重新部署网站。

// 允许操作的文件夹。写死在这里，是为了万一有人拿到登录权限，
// 也只能改这两个文件夹里的笔记，动不了代码或配置。
export const DIRS = ['notes', 'portfolio-diary']

// 只允许 notes/2026-07-28.md 这种路径
const PATH_RE = /^(notes|portfolio-diary)\/\d{4}-\d{2}-\d{2}\.md$/

export function isAllowedPath(path) {
  return typeof path === 'string' && PATH_RE.test(path)
}

// btoa / atob 只认单字节，中文和 emoji 要先转成 UTF-8 字节
export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function decodeBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function config(env) {
  const [owner, repo] = (env.GITHUB_REPO || '').split('/')
  if (!owner || !repo || !env.GITHUB_TOKEN) {
    throw new Error('后台还没配置好 GitHub 令牌（GITHUB_TOKEN / GITHUB_REPO）。')
  }
  return { owner, repo, branch: env.GITHUB_BRANCH || 'main', token: env.GITHUB_TOKEN }
}

async function gh(env, path, options = {}) {
  const { owner, repo, token } = config(env)
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'zhiyenotes-workbench',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })

  if (res.status === 404) return null

  if (!res.ok) {
    const detail = await res.text()
    if (res.status === 401 || res.status === 403) {
      throw new Error('GitHub 令牌无效或权限不足，请检查 GITHUB_TOKEN。')
    }
    if (res.status === 409 || res.status === 422) {
      throw new Error('这篇笔记在别处被改过了，请刷新页面重新打开再改。')
    }
    throw new Error(`GitHub 出错（${res.status}）：${detail.slice(0, 200)}`)
  }
  return res.json()
}

// 列出一个文件夹里的笔记（不含 template.md）
export async function listDir(env, dir) {
  const { branch } = config(env)
  const items = await gh(env, `/contents/${dir}?ref=${branch}`)
  if (!Array.isArray(items)) return []

  return items
    .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
    .filter((f) => f.name !== 'template.md')
    .map((f) => ({
      collection: dir,
      date: f.name.replace('.md', ''),
      path: f.path,
      sha: f.sha,
    }))
    .sort((a, b) => b.date.localeCompare(a.date)) // 新的在前
}

export async function readFile(env, path) {
  const { branch } = config(env)
  const file = await gh(env, `/contents/${path}?ref=${branch}`)
  if (!file) return null
  return { content: decodeBase64(file.content), sha: file.sha }
}

export async function writeFile(env, path, content, sha, message) {
  const { branch } = config(env)
  const body = {
    message,
    content: encodeBase64(content),
    branch,
    ...(sha ? { sha } : {}),
  }
  const res = await gh(env, `/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return { sha: res.content.sha }
}

export async function deleteFile(env, path, sha, message) {
  const { branch } = config(env)
  await gh(env, `/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  })
}
