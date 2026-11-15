import { fail, json, requireLogin } from '../_lib/auth.js'
import { DIRS, listDir } from '../_lib/github.js'
import { listResearch } from '../_lib/research-repo.js'

// 列出笔记文件夹，以及首页上的股票分析（只要列表，不含正文）。
// 研究列表单独容错：它读坏了也不能挡住每日笔记和模拟盘日记。
export async function onRequestGet({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  try {
    const lists = await Promise.all(DIRS.map((dir) => listDir(env, dir)))
    const notes = Object.fromEntries(DIRS.map((dir, i) => [dir, lists[i]]))
    let research = []
    let researchError = null
    try {
      research = await listResearch(env)
    } catch (err) {
      researchError = err.message
    }
    return json({ notes, research, researchError })
  } catch (err) {
    return fail(err.message, 500)
  }
}
