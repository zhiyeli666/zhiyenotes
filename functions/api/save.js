import { fail, json, requireLogin } from '../_lib/auth.js'
import { isAllowedPath, readFile, writeFile } from '../_lib/github.js'

// 保存一篇笔记 = 往 GitHub 仓库提交一次改动
export async function onRequestPost({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  let body = {}
  try {
    body = await request.json()
  } catch {
    return fail('请求格式不对。')
  }

  const { path, content } = body
  if (!isAllowedPath(path)) return fail('路径不对。')
  if (typeof content !== 'string' || !content.trim()) {
    return fail('内容是空的，写点东西再保存吧。')
  }

  try {
    // 新建时前端传不了 sha；如果这天其实已有文件，就取它的 sha 变成"覆盖"，
    // 否则 GitHub 会拒绝。（前端在覆盖前已经问过用户了。）
    let sha = body.sha
    if (!sha) {
      const existing = await readFile(env, path)
      sha = existing?.sha
    }

    const result = await writeFile(
      env,
      path,
      content,
      sha,
      `${sha ? 'Update' : 'Add'} ${path} (via workbench)`,
    )
    return json({ ok: true, sha: result.sha })
  } catch (err) {
    return fail(err.message, 500)
  }
}
