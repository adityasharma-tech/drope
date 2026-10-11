import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        '..',
        'C:/Users/Ahem/.gemini/antigravity/brain/3580275f-8238-4ac2-8fe3-4e3406112d3c'
      ]
    }
  }
})
