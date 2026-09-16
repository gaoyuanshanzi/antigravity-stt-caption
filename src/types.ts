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
