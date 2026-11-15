import { fail, json, requireLogin } from '../_lib/auth.js'
import { loadResearch, PublishError, saveResearch } from '../_lib/research-repo.js'

// 打开一篇股票分析，或发布一篇（页面 + 首页列表，同一次提交）。
export async function onRequestGet({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  const slug = new URL(request.url).searchParams.get('slug')
  try {
    const note = await loadResearch(env, slug)
    if (!note) return fail('找不到这篇研究。', 404)
    return json(note)
  } catch (err) {
    return fail(err.message, err instanceof PublishError ? err.status : 500)
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await requireLogin(request, env)
  if (denied) return denied

  let body = {}
  try {
    body = await request.json()
  } catch {
    return fail('请求格式不对。')
  }

  try {
    return json(await saveResearch(env, body))
  } catch (err) {
    return fail(err.message, err instanceof PublishError ? err.status : 500)
  }
}
