import { fail, json, requireLogin } from '../_lib/auth.js'
import { deleteFile, isAllowedPath, readFile } from '../_lib/github.js'

export async function onRequestPost({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  let body = {}
  try {
    body = await request.json()
  } catch {
    return fail('请求格式不对。')
  }

  const { path } = body
  if (!isAllowedPath(path)) return fail('路径不对。')

  try {
    let sha = body.sha
    if (!sha) {
      const existing = await readFile(env, path)
      if (!existing) return fail('找不到这篇笔记。', 404)
      sha = existing.sha
    }
    await deleteFile(env, path, sha, `Delete ${path} (via workbench)`)
    return json({ ok: true })
  } catch (err) {
    return fail(err.message, 500)
  }
}
