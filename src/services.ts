export interface TranslationParams {
  text: string
  sourceLangName: string
  targetLangName: string
  apiKey: string
}

export async function translateWithGemini({
  text,
  sourceLangName,
  targetLangName,
  apiKey,
}: TranslationParams): Promise<string> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error('Gemini API Key를 입력해주세요.')
  }

  const systemInstruction = `You are a professional real-time interpreter. Translate the following text from ${sourceLangName} to ${targetLangName} naturally, accurately, and concisely. Output ONLY the translated text without explanations, quotation marks, or meta-commentary.`

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: text,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  }

  // Priority list of Gemini models, with latest gemini-3.6-flash first
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ]

  // If we already know a working model, prioritize it
  const models = cachedModel
    ? [cachedModel, ...candidateModels.filter((m) => m !== cachedModel)]
    : candidateModels

  let lastError: Error | null = null

  for (const model of models) {
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`

        if (response.status === 400 && errorMsg.includes('API_KEY_INVALID')) {
          throw new Error('유효하지 않은 Gemini API Key입니다. 키를 다시 확인해주세요.')
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Gemini API 접근 권한이 없습니다 (401/403). API Key를 확인해주세요.')
        } else if (response.status === 429) {
          throw new Error('Gemini API 요청 한도를 초과했습니다 (429). 잠시 후 다시 시도됩니다.')
        } else if (
          response.status === 404 ||
          errorMsg.includes('no longer available') ||
          errorMsg.includes('not found') ||
          errorMsg.includes('deprecated') ||
          errorMsg.includes('update your code')
        ) {
          // Model unavailable or deprecated, continue to next candidate
          lastError = new Error(errorMsg)
          continue
        } else {
          lastError = new Error(errorMsg)
          continue
        }
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const translatedText = candidate?.content?.parts?.[0]?.text

      if (!translatedText) {
        throw new Error('번역 결과를 반환받지 못했습니다.')
      }

      // Cache successful model
      cachedModel = model

      return translatedText.trim()
    } catch (err: unknown) {
      if (err instanceof Error) {
        // If it's an auth error or quota error, don't keep trying other models
        if (
          err.message.includes('API Key') ||
          err.message.includes('401') ||
          err.message.includes('403') ||
          err.message.includes('한도')
        ) {
          throw err
        }
        lastError = err
      } else {
        lastError = new Error(String(err))
      }
    }
  }

  throw lastError || new Error('Gemini API 호출에 실패했습니다.')
}

let cachedModel: string | null = 'gemini-3.6-flash'

export interface DeepLTranslationParams {
  text: string
  sourceLangCode: string
  targetLangCode: string
  apiKey: string
}

export function toDeepLSourceLang(code: string): string {
  const map: Record<string, string> = {
    'pt-BR': 'PT',
    'ko-KR': 'KO',
    'en-US': 'EN',
    'es-ES': 'ES',
    'ja-JP': 'JA',
    'zh-CN': 'ZH',
    'fr-FR': 'FR',
    'de-DE': 'DE',
    'it-IT': 'IT',
    'ru-RU': 'RU',
    'id-ID': 'ID',
    'ar-SA': 'AR',
  }
  return map[code] || code.split('-')[0].toUpperCase()
}

export function toDeepLTargetLang(code: string): string {
  const map: Record<string, string> = {
    'pt-BR': 'PT-BR',
    'ko-KR': 'KO',
    'en-US': 'EN-US',
    'es-ES': 'ES',
    'ja-JP': 'JA',
    'zh-CN': 'ZH',
    'fr-FR': 'FR',
    'de-DE': 'DE',
    'it-IT': 'IT',
    'ru-RU': 'RU',
    'id-ID': 'ID',
    'ar-SA': 'AR',
  }
  return map[code] || code.toUpperCase()
}

export async function translateWithDeepL({
  text,
  sourceLangCode,
  targetLangCode,
  apiKey,
}: DeepLTranslationParams): Promise<string> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error('DeepL API Key를 입력해주세요.')
  }

  const sourceLang = toDeepLSourceLang(sourceLangCode)
  const targetLang = toDeepLTargetLang(targetLangCode)

  try {
    const response = await fetch('/api/deepl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        sourceLang,
        targetLang,
        apiKey: trimmedKey,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || `DeepL 번역 요청 실패 (${response.status})`)
    }

    if (!data.translatedText) {
      throw new Error('DeepL 번역 결과를 수신하지 못했습니다.')
    }

    return data.translatedText.trim()
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err
    }
    throw new Error('DeepL 번역 처리 중 오류가 발생했습니다.')
  }
}

export interface AudioTranscriptionParams {
  audioBase64: string
  mimeType?: string
  sourceLangName: string
  apiKey: string
}

export async function transcribeAudioWithGemini({
  audioBase64,
  mimeType = 'audio/webm',
  sourceLangName,
  apiKey,
}: AudioTranscriptionParams): Promise<string> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    return ''
  }

  const base64Data = audioBase64.includes(',')
    ? audioBase64.split(',')[1]
    : audioBase64

  const cleanMimeType = mimeType.split(';')[0].trim() || 'audio/webm'

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: cleanMimeType,
              data: base64Data,
            },
          },
          {
            text: `You are an expert real-time speech recognition model. Transcribe the spoken audio verbatim in ${sourceLangName}. Output ONLY the transcribed text in ${sourceLangName}. Do NOT include explanations, quotation marks, or timecodes. If the audio is silence or noise with no clear speech, output nothing.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 300,
    },
  }

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ]

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

      if (!response.ok) {
        continue
      }

      const data = await response.json()
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

      return text.replace(/^["']|["']$/g, '').trim()
    } catch {
      continue
    }
  }

  return ''
}


