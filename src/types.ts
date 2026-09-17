export interface Language {
  code: string
  name: string
  nativeName: string
  flag: string
}

export interface SubtitleItem {
  id: string
  timestamp: string // HH:mm:ss
  sourceText: string
  translatedText: string
  status: 'pending' | 'translating' | 'completed' | 'error'
  errorMessage?: string
}

export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ToastMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
}

export type TranslationEngine = 'gemini' | 'deepl'

export type SaveFileType = 'mp3' | 'html' | 'txt'
export type SaveDestination = 'neon' | 'local' | 'both'

export interface SaveRecordPayload {
  record_type: 'html' | 'txt' | 'audio_mp3'
  filename: string
  source_lang?: string
  target_lang?: string
  sentence_count?: number
  content_text?: string | null
  audio_base64?: string | null
}

export interface NeonArchiveRecord {
  id: number
  record_type: 'html' | 'txt' | 'audio_mp3'
  filename: string
  source_lang?: string
  target_lang?: string
  sentence_count: number
  created_at: string
  content_length?: number
  audio_length?: number
  content_text?: string | null
  audio_base64?: string | null
}

