import { neon } from '@neondatabase/serverless'

const NEON_DB_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_g0xtNa5EYyeW@ep-floral-hill-b52g6zf3-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

let tableInitialized = false

async function ensureTable(sql) {
  if (tableInitialized) return
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
  tableInitialized = true
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    // Health check / table status
    try {
      const sql = neon(NEON_DB_URL)
      await ensureTable(sql)
      const countResult = await sql`SELECT count(*) as total FROM captions_archive`
      return res.status(200).json({
        status: 'connected',
        totalRecords: parseInt(countResult[0]?.total || '0', 10),
      })
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Neon DB 조회 실패' })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const {
      record_type,
      filename,
      source_lang = '',
      target_lang = '',
      sentence_count = 0,
      content_text = null,
      audio_base64 = null,
    } = req.body || {}

    if (!record_type || !filename) {
      return res.status(400).json({ error: 'record_type 및 filename은 필수입니다.' })
    }

    const sql = neon(NEON_DB_URL)
    await ensureTable(sql)

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

    return res.status(200).json({
      success: true,
      message: 'Neon.tech DB에 성공적으로 저장되었습니다.',
      record: insertResult[0],
    })
  } catch (err) {
    console.error('Neon DB save error:', err)
    return res.status(500).json({
      error: err.message || 'Neon DB 저장 중 오류가 발생했습니다.',
    })
  }
}
