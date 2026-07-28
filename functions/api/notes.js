import { fail, json, requireLogin } from '../_lib/auth.js'
import { DIRS, listDir } from '../_lib/github.js'

// 列出两个文件夹里的所有笔记（只要日期和路径，不含正文）
export async function onRequestGet({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  try {
    const lists = await Promise.all(DIRS.map((dir) => listDir(env, dir)))
    const notes = Object.fromEntries(DIRS.map((dir, i) => [dir, lists[i]]))
    return json({ notes })
  } catch (err) {
    return fail(err.message, 500)
  }
}
