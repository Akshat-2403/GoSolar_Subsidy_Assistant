import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || env.VITE_DEV_API_TARGET || process.env.VITE_BACKEND_URL
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: backendTarget ? {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      } : undefined,
    },
  }
})
