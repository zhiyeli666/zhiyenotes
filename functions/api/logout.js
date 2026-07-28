import { clearSessionCookie, json } from '../_lib/auth.js'

export function onRequestPost() {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } })
}
