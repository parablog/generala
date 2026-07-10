import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/generala/', // served from parablog.github.io/generala
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/generala/',
        name: 'Generala Argentina',
        short_name: 'Generala',
        description: 'Anotador de Generala argentina para jugar en la mesa.',
        lang: 'es-AR',
        theme_color: '#5bb8e8',
        background_color: '#f7f4ec',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
