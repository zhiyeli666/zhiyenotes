import { isLoggedIn, json } from '../_lib/auth.js'

// 前端一打开就问一句：我还是登录状态吗？
export async function onRequestGet({ request, env }) {
  return json({ authed: await isLoggedIn(request, env) })
}
