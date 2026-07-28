// 和后台接口说话的小助手。所有请求都带上 cookie（登录凭证）。

async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    // 后端没返回 JSON（比如 500 页面），下面按状态码报错
  }

  if (!res.ok) {
    const err = new Error(data.error || `请求失败（${res.status}）`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  session: () => request('/api/session'),
  login: (password) =>
    request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () => request('/api/logout', { method: 'POST' }),
  list: () => request('/api/notes'),
  get: (path) => request(`/api/note?path=${encodeURIComponent(path)}`),
  save: (path, content, sha) =>
    request('/api/save', {
      method: 'POST',
      body: JSON.stringify({ path, content, sha }),
    }),
  remove: (path, sha) =>
    request('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ path, sha }),
    }),
}
