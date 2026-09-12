import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { injectResearchHome } from './scripts/inject-research-home.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), injectResearchHome()],
  build: {
    rollupOptions: {
      // 两个页面：主页 index.html，后台工作台 admin.html
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
})
