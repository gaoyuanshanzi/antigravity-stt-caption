import { neon } from '@neondatabase/serverless'

const NEON_DB_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_g0xtNa5EYyeW@ep-floral-hill-b52g6zf3-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const sql = neon(NEON_DB_URL)

  try {
    if (req.method === 'GET') {
      const { id } = req.query || {}

      // If id is provided, return the full record (with content_text or audio_base64)
      if (id) {
        const recordId = parseInt(id, 10)
        if (isNaN(recordId)) {
          return res.status(400).json({ error: '유효한 id가 아닙니다.' })
        }

        const rows = await sql`
          SELECT id, record_type, filename, source_lang, target_lang, sentence_count, content_text, audio_base64, created_at
          FROM captions_archive
          WHERE id = ${recordId}
        `

        if (rows.length === 0) {
          return res.status(404).json({ error: '파일을 찾을 수 없습니다.' })
        }

        return res.status(200).json({ record: rows[0] })
      }

      // If no id, return list of records (lightweight: without huge audio_base64 or text)
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

      return res.status(200).json({ records: rows })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {}
      if (!id) {
        return res.status(400).json({ error: '삭제할 파일 id가 필요합니다.' })
      }

      const recordId = parseInt(id, 10)
      await sql`DELETE FROM captions_archive WHERE id = ${recordId}`
      return res.status(200).json({ success: true, message: '파일이 삭제되었습니다.' })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('Records API error:', err)
    return res.status(500).json({ error: err.message || 'Neon DB 조회 오류' })
  }
}
