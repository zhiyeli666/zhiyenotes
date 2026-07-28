import { fail, json, requireLogin } from '../_lib/auth.js'
import { isAllowedPath, readFile } from '../_lib/github.js'

// 读一篇笔记的正文，用来在工作台里打开编辑
export async function onRequestGet({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  const path = new URL(request.url).searchParams.get('path')
  if (!isAllowedPath(path)) return fail('路径不对。')

  try {
    const file = await readFile(env, path)
    if (!file) return fail('找不到这篇笔记。', 404)
    return json(file)
  } catch (err) {
    return fail(err.message, 500)
  }
}
