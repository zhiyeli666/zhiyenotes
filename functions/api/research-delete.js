import { fail, json, requireLogin } from '../_lib/auth.js'
import { deleteResearch, PublishError } from '../_lib/research-repo.js'

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
    return json(await deleteResearch(env, body.slug))
  } catch (err) {
    return fail(err.message, err instanceof PublishError ? err.status : 500)
  }
}
