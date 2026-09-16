import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'deepl-dev-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/deepl', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Method Not Allowed' }))
            return
          }

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })

          req.on('end', async () => {
            try {
              const { text, sourceLang, targetLang, apiKey } = JSON.parse(body || '{}')
              if (!apiKey || !apiKey.trim()) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'DeepL API Key를 입력해주세요.' }))
                return
              }

              const trimmedKey = apiKey.trim()
              const endpoint = trimmedKey.endsWith(':fx')
                ? 'https://api-free.deepl.com/v2/translate'
                : 'https://api.deepl.com/v2/translate'

              const bodyPayload: any = {
                text: [text],
                target_lang: targetLang,
              }
              if (sourceLang) {
                bodyPayload.source_lang = sourceLang
              }

              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Authorization': `DeepL-Auth-Key ${trimmedKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyPayload),
              })

              const data: any = await response.json().catch(() => ({}))
              res.statusCode = response.status
              res.setHeader('Content-Type', 'application/json')
              if (!response.ok) {
                res.end(JSON.stringify({ error: data.message || `DeepL API 오류 (${response.status})` }))
              } else {
                res.end(JSON.stringify({ translatedText: data.translations?.[0]?.text || '' }))
              }
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message || '서버 오류' }))
            }
          })
        })
      },
    },
  ],
})


