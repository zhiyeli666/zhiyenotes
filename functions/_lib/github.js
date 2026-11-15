// 和 GitHub 仓库打交道：读文件、写文件、删文件。
// 工作台点"保存"，最终就是在这里把 .md 文件提交进仓库；
// 提交后 GitHub Actions 会自动重新部署网站。

// 允许操作的文件夹。写死在这里，是为了万一有人拿到登录权限，
// 也只能改这几个文件夹里的笔记，动不了代码或配置。
export const DIRS = ['notes', 'portfolio-diary', 'portfolio-diary-10k']

// 只允许 notes/2026-07-28.md 这种路径
const PATH_RE = /^(notes|portfolio-diary|portfolio-diary-10k)\/\d{4}-\d{2}-\d{2}\.md$/

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

export async function readFile(env, path, ref) {
  const { branch } = config(env)
  const file = await gh(env, `/contents/${path}?ref=${encodeURIComponent(ref || branch)}`)
  // 目录会返回数组；只有单个文件才有正文。type 偶尔缺，但只要有 content 就能读。
  if (!file || Array.isArray(file)) return null
  if (file.type && file.type !== 'file') return null
  if (typeof file.content !== 'string') return null
  return { content: decodeBase64(file.content), sha: file.sha }
}

// 列出一个目录里的文件。目录还不存在（比如第一次发研究笔记）时返回空数组。
export async function listFiles(env, dir, ref) {
  const { branch } = config(env)
  const items = await gh(env, `/contents/${dir}?ref=${encodeURIComponent(ref || branch)}`)
  if (!Array.isArray(items)) return []
  return items.filter((item) => item.type === 'file')
}

// 当前分支的提交，以及它的树。一次提交多个文件时以此为父提交。
export async function getHead(env) {
  const { branch } = config(env)
  const ref = await gh(env, `/git/ref/heads/${encodeURIComponent(branch)}`)
  if (!ref?.object?.sha) throw new Error('找不到要提交到的分支。')
  const commit = await gh(env, `/git/commits/${ref.object.sha}`)
  if (!commit?.tree?.sha) throw new Error('读不到仓库当前的文件树。')
  return { sha: ref.object.sha, tree: commit.tree.sha, branch }
}

// 多个文件同一次提交。content 为 null 表示删除。
// 用 Git Data API 而不是逐个 Contents API，这样页面和首页列表不会分成两次部署。
export async function commitFiles(env, head, files, message) {
  const { branch } = config(env)
  if (!files?.length) throw new Error('没有要提交的文件。')

  // content 直接放进 tree，GitHub 会顺便建 blob。sha 为 null 表示删除。
  const tree = files.map((file) => {
    if (file.content == null) {
      return { path: file.path, mode: '100644', type: 'blob', sha: null }
    }
    return { path: file.path, mode: '100644', type: 'blob', content: file.content }
  })

  const createdTree = await gh(env, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: head.tree, tree }),
  })
  if (!createdTree?.sha) throw new Error('GitHub 没有生成新的文件树。')

  const commit = await gh(env, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: createdTree.sha,
      parents: [head.sha],
    }),
  })
  if (!commit?.sha) throw new Error('GitHub 没有生成提交。')

  const updated = await gh(env, `/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  })
  if (!updated?.object?.sha) throw new Error('提交没有写上分支，请刷新后再试。')
  return { sha: commit.sha }
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
