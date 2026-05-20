import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 20,
            },
            {
              name: 'chart-vendor',
              test: /node_modules[\\/](@klinecharts|klinecharts)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
