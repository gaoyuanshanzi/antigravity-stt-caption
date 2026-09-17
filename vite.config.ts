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

        // Neon.tech Database Save Middleware
        server.middlewares.use('/api/save-record', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            res.end()
            return
          }

          const NEON_DB_URL =
            process.env.NEON_DATABASE_URL ||
            'postgresql://neondb_owner:npg_g0xtNa5EYyeW@ep-floral-hill-b52g6zf3-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })

          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { neon } = await import('@neondatabase/serverless')
              const sql = neon(NEON_DB_URL)

              // Ensure table exists
              await sql`
                CREATE TABLE IF NOT EXISTS captions_archive (
                  id SERIAL PRIMARY KEY,
                  record_type VARCHAR(20) NOT NULL,
                  filename VARCHAR(255) NOT NULL,
                  source_lang VARCHAR(20),
                  target_lang VARCHAR(20),
                  sentence_count INTEGER DEFAULT 0,
                  content_text TEXT,
                  audio_base64 TEXT,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
              `

              if (req.method === 'GET') {
                const countResult = await sql`SELECT count(*) as total FROM captions_archive`
                res.statusCode = 200
                res.end(
                  JSON.stringify({
                    status: 'connected',
                    totalRecords: parseInt(countResult[0]?.total || '0', 10),
                  })
                )
                return
              }

              if (req.method !== 'POST') {
                res.statusCode = 405
                res.end(JSON.stringify({ error: 'Method Not Allowed' }))
                return
              }

              const {
                record_type,
                filename,
                source_lang = '',
                target_lang = '',
                sentence_count = 0,
                content_text = null,
                audio_base64 = null,
              } = JSON.parse(body || '{}')

              if (!record_type || !filename) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'record_type 및 filename은 필수입니다.' }))
                return
              }

              const insertResult = await sql`
                INSERT INTO captions_archive (
                  record_type,
                  filename,
                  source_lang,
                  target_lang,
                  sentence_count,
                  content_text,
                  audio_base64
                ) VALUES (
                  ${record_type},
                  ${filename},
                  ${source_lang},
                  ${target_lang},
                  ${sentence_count},
                  ${content_text},
                  ${audio_base64}
                )
                RETURNING id, record_type, filename, created_at;
              `

              res.statusCode = 200
              res.end(
                JSON.stringify({
                  success: true,
                  message: 'Neon.tech DB에 성공적으로 저장되었습니다.',
                  record: insertResult[0],
                })
              )
            } catch (err: any) {
              console.error('Neon DB API Error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message || 'Neon DB 처리 오류' }))
            }
          })
        })

        // Neon.tech Database Records List & Retrieve Middleware
        server.middlewares.use('/api/records', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            res.end()
            return
          }

          const NEON_DB_URL =
            process.env.NEON_DATABASE_URL ||
            'postgresql://neondb_owner:npg_g0xtNa5EYyeW@ep-floral-hill-b52g6zf3-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

          res.setHeader('Content-Type', 'application/json')
          try {
            const { neon } = await import('@neondatabase/serverless')
            const sql = neon(NEON_DB_URL)

            const urlObj = new URL(req.url || '', 'http://localhost')
            const idParam = urlObj.searchParams.get('id')

            if (req.method === 'GET') {
              if (idParam) {
                const recordId = parseInt(idParam, 10)
                const rows = await sql`
                  SELECT id, record_type, filename, source_lang, target_lang, sentence_count, content_text, audio_base64, created_at
                  FROM captions_archive
                  WHERE id = ${recordId}
                `
                if (rows.length === 0) {
                  res.statusCode = 404
                  res.end(JSON.stringify({ error: '파일을 찾을 수 없습니다.' }))
                  return
                }
                res.statusCode = 200
                res.end(JSON.stringify({ record: rows[0] }))
                return
              }

              // List records
              const rows = await sql`
                SELECT 
                  id, 
                  record_type, 
                  filename, 
                  source_lang, 
                  target_lang, 
                  sentence_count, 
                  created_at,
                  LENGTH(COALESCE(content_text, '')) as content_length,
                  CASE WHEN audio_base64 IS NOT NULL THEN LENGTH(audio_base64) ELSE 0 END as audio_length
                FROM captions_archive
                ORDER BY created_at DESC
              `
              res.statusCode = 200
              res.end(JSON.stringify({ records: rows }))
              return
            }

            if (req.method === 'DELETE') {
              if (!idParam) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: '삭제할 파일 id가 필요합니다.' }))
                return
              }
              const recordId = parseInt(idParam, 10)
              await sql`DELETE FROM captions_archive WHERE id = ${recordId}`
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, message: '파일이 삭제되었습니다.' }))
              return
            }

            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          } catch (err: any) {
            console.error('Records API error:', err)
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message || 'Neon DB 조회 오류' }))
          }
        })
      },
    },
  ],
})


