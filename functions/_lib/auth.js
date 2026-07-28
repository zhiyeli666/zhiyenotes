// 登录凭证的签发与校验。
//
// 原理：登录成功后，服务器发一张"签名的门票"存进浏览器 cookie。
// 门票内容只有一个过期时间，后面跟一段用密钥算出的签名。
// 别人伪造不出签名，所以改不了过期时间、也造不出假门票。
// 以 _ 开头的文件夹不会被当成网址路由，只是给其他接口调用的工具。

const COOKIE_NAME = 'zn_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 天

const enc = new TextEncoder()

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(value)))
}

// 逐字符比较，且不因为提前 return 而泄露"对了几位"
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function createSessionCookie(env) {
  const exp = String(Date.now() + MAX_AGE * 1000)
  const token = `${exp}.${await sign(exp, env.SESSION_SECRET)}`
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}

export async function isLoggedIn(request, env) {
  if (!env.SESSION_SECRET) return false

  const raw = request.headers.get('Cookie') || ''
  const hit = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!hit) return false

  const [exp, signature] = hit.slice(COOKIE_NAME.length + 1).split('.')
  if (!exp || !signature) return false
  if (Number(exp) < Date.now()) return false // 过期了

  return safeEqual(signature, await sign(exp, env.SESSION_SECRET))
}

export function checkPassword(input, env) {
  return !!env.ADMIN_PASSWORD && safeEqual(input || '', env.ADMIN_PASSWORD)
}

// ---- 统一的返回格式 ----

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })
}

export function fail(message, status = 400) {
  return json({ error: message }, { status })
}

// 需要登录的接口，开头都调用它
export async function requireLogin(request, env) {
  if (!(await isLoggedIn(request, env))) {
    return fail('登录已过期，请重新登录。', 401)
  }
  return null
}
