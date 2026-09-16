export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { text, sourceLang, targetLang, apiKey } = req.body || {}
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ error: 'DeepL API Key를 입력해주세요.' })
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: '번역할 텍스트가 없습니다.' })
    }

    const trimmedKey = apiKey.trim()
    const endpoint = trimmedKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate'

    const bodyPayload = {
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

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const msg = data.message || `DeepL API 오류 (${response.status})`
      if (response.status === 403) {
        return res.status(403).json({ error: '유효하지 않은 DeepL API Key입니다. 키를 다시 확인해주세요.' })
      } else if (response.status === 456) {
        return res.status(456).json({ error: 'DeepL API 번역 할당량(Quota)을 초과했습니다.' })
      } else {
        return res.status(response.status).json({ error: msg })
      }
    }

    const translatedText = data.translations?.[0]?.text || ''
    return res.status(200).json({ translatedText })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'DeepL 번역 프록시 처리 중 오류 발생' })
  }
}
