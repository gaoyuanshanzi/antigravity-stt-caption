import type { Language } from './types'

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'pt-BR', name: '브라질 포르투갈어', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'ko-KR', name: '한국어', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'en-US', name: '영어 (미국)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'es-ES', name: '스페인어', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ja-JP', name: '일본어', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', name: '중국어 (간체)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'fr-FR', name: '프랑스어', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: '독일어', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', name: '이탈리아어', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ru-RU', name: '러시아어', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'vi-VN', name: '베트남어', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id-ID', name: '인도네시아어', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ar-SA', name: '아랍어', nativeName: 'العربية', flag: '🇸🇦' },
]

export const DEFAULT_SOURCE_LANG = 'pt-BR'
export const DEFAULT_TARGET_LANG = 'ko-KR'

export const ADMIN_CREDENTIALS = {
  id: 'admin',
  password: '123jesus',
}
