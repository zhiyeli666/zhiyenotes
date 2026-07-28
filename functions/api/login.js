import { checkPassword, createSessionCookie, fail, json } from '../_lib/auth.js'

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return fail('后台还没设置密码（ADMIN_PASSWORD / SESSION_SECRET）。', 500)
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return fail('请求格式不对。')
  }

  if (!checkPassword(body.password, env)) {
    // 猜密码的人慢一点：错了就等 1 秒再回复
    await new Promise((r) => setTimeout(r, 1000))
    return fail('密码不对，再试一次。', 401)
  }

  return json(
    { ok: true },
    { headers: { 'Set-Cookie': await createSessionCookie(env) } },
  )
}
