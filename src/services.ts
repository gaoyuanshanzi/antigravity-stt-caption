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

  // Primary model and fallbacks if API version changes
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash']
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
        } else if (response.status === 404) {
          // Try next model if 404
          lastError = new Error(errorMsg)
          continue
        } else {
          throw new Error(`번역 오류: ${errorMsg}`)
        }
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const translatedText = candidate?.content?.parts?.[0]?.text

      if (!translatedText) {
        throw new Error('번역 결과를 반환받지 못했습니다.')
      }

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
