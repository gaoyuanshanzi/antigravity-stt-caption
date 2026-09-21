// Increase Vercel payload limit for audio base64 data
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { audioBase64, mimeType = 'audio/webm', sourceLangName = '한국어', apiKey } = req.body || {}

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ error: 'Gemini API Key를 입력해주세요.' })
    }

    if (!audioBase64) {
      return res.status(400).json({ error: '오디오 데이터가 누락되었습니다.' })
    }

    const trimmedKey = apiKey.trim()
    const base64Data = audioBase64.includes(',')
      ? audioBase64.split(',')[1]
      : audioBase64

    // Normalize MIME type – Gemini supports: audio/webm, audio/mp4, audio/wav, audio/ogg, audio/mpeg
    const rawMime = mimeType.split(';')[0].trim()
    const cleanMimeType = rawMime || 'audio/webm'

    console.log(`[STT] mimeType=${cleanMimeType} base64Len=${base64Data.length} lang=${sourceLangName}`)

    const promptText = `Transcribe all spoken words in the audio verbatim. The primary expected language is ${sourceLangName}, but accurately transcribe whatever language is spoken. Output ONLY the transcribed speech verbatim. Do NOT wrap in quotes. Do NOT add notes, explanations, or labels. If there is silence or no clear speech, output an empty string.`

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: base64Data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 300,
      },
    }

    // Google Generative Language API models - gemini-3.6-flash is recommended by Google
    const candidateModels = [
      'gemini-3.6-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
    ]

    const errors = []

    for (const model of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        )

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          const errMsg = data?.error?.message || `HTTP ${response.status} ${response.statusText}`
          console.warn(`[STT] model ${model} failed: ${errMsg}`)
          errors.push(`${model}: ${errMsg}`)
          continue
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const cleanedText = rawText.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim()

        console.log(`[STT] Success with ${model}: "${cleanedText.slice(0, 50)}"`)

        return res.status(200).json({
          text: cleanedText,
          model,
        })
      } catch (err) {
        console.warn(`[STT] exception with ${model}:`, err)
        errors.push(`${model}: ${err.message}`)
        continue
      }
    }

    return res.status(500).json({
      error: `Gemini 음성인식 실패: ${errors[0] || '모든 모델 응답 없음'}`,
      allErrors: errors,
    })
  } catch (error) {
    console.error('Transcribe handler error:', error)
    return res.status(500).json({ error: error.message || '서버 오류' })
  }
}
