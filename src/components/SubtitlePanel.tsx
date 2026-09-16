import React, { useRef, useEffect } from 'react'
import {
  Clock,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  Volume2,
  AlertCircle,
} from 'lucide-react'
import type { SubtitleItem, Language, FontSize } from '../types'

interface SubtitlePanelProps {
  items: SubtitleItem[]
  interimText: string
  sourceLang: Language
  targetLang: Language
  fontSize: FontSize
  autoScroll: boolean
  isListening: boolean
  onRetryTranslation: (id: string) => void
}

export const SubtitlePanel: React.FC<SubtitlePanelProps> = ({
  items,
  interimText,
  sourceLang,
  targetLang,
  fontSize,
  autoScroll,
  isListening,
  onRetryTranslation,
}) => {
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Auto scroll to bottom when items change or interim text changes
  useEffect(() => {
    if (autoScroll) {
      if (leftScrollRef.current) {
        leftScrollRef.current.scrollTop = leftScrollRef.current.scrollHeight
      }
      if (rightScrollRef.current) {
        rightScrollRef.current.scrollTop = rightScrollRef.current.scrollHeight
      }
    }
  }, [items, interimText, autoScroll])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Font size styling mappings
  const fontSizeClasses: Record<FontSize, { final: string; interim: string; meta: string }> = {
    sm: {
      final: 'text-sm leading-relaxed',
      interim: 'text-sm leading-relaxed',
      meta: 'text-xs',
    },
    md: {
      final: 'text-base sm:text-lg leading-relaxed',
      interim: 'text-base sm:text-lg leading-relaxed',
      meta: 'text-xs',
    },
    lg: {
      final: 'text-xl sm:text-2xl font-semibold leading-snug',
      interim: 'text-xl sm:text-2xl leading-snug',
      meta: 'text-sm',
    },
    xl: {
      final: 'text-2xl sm:text-3xl font-semibold leading-snug',
      interim: 'text-2xl sm:text-3xl leading-snug',
      meta: 'text-base',
    },
  }

  const currentFont = fontSizeClasses[fontSize]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 min-h-[500px] h-[calc(100vh-250px)]">
      {/* 1. LEFT PANEL: Source Speech Recognition (STT) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{sourceLang.flag}</span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>발화 원문 (STT)</span>
                <span className="text-xs font-normal text-slate-500">
                  - {sourceLang.name}
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isListening && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                마이크 연결됨
              </span>
            )}
            <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              총 {items.length}문장
            </span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          ref={leftScrollRef}
          className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 scroll-smooth"
        >
          {items.length === 0 && !interimText && (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <Volume2 className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">
                실시간 음성 인식을 기다리는 중입니다
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                상단 [음성인식 시작] 버튼을 누른 후 마이크에 말씀하시면 실시간으로 인식된 문장이 이곳에 기록됩니다.
              </p>
            </div>
          )}

          {/* Confirmed Sentences List */}
          {items.map((item, index) => (
            <div
              key={item.id}
              className="group p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all relative"
            >
              {/* Item Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <span className={`flex items-center gap-1 font-mono text-slate-400 ${currentFont.meta}`}>
                    <Clock className="w-3 h-3" />
                    {item.timestamp}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(item.sourceText, `src-${item.id}`)}
                  title="원문 복사"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                >
                  {copiedId === `src-${item.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Text Body */}
              <p className={`text-slate-900 font-medium ${currentFont.final}`}>
                {item.sourceText}
              </p>
            </div>
          ))}

          {/* Real-time Interim Text (Active speech preview) */}
          {interimText && (
            <div className="p-4 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 transition-all animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                <span className={`text-xs font-semibold text-indigo-700`}>
                  실시간 발화 인식 중...
                </span>
              </div>
              <p className={`text-indigo-900 font-normal italic ${currentFont.interim}`}>
                {interimText}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. RIGHT PANEL: Simultaneous Translation (Gemini AI) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{targetLang.flag}</span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>동시 번역 자막 (Gemini)</span>
                <span className="text-xs font-normal text-slate-500">
                  - {targetLang.name}
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              AI 실시간 통역
            </span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          ref={rightScrollRef}
          className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 scroll-smooth"
        >
          {items.length === 0 && (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-indigo-500" />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">
                번역 자막이 이곳에 실시간으로 표시됩니다
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                좌측에서 완성된 문장이 감지되면 Google Gemini API를 통해 문맥에 맞춘 자연스러운 동시통역 자막이 즉시 생성됩니다.
              </p>
            </div>
          )}

          {/* Translated Sentences List */}
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`group p-4 rounded-xl border transition-all relative ${
                item.status === 'error'
                  ? 'border-red-200 bg-red-50/40'
                  : item.status === 'translating'
                  ? 'border-indigo-200 bg-indigo-50/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Item Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <span className={`flex items-center gap-1 font-mono text-slate-400 ${currentFont.meta}`}>
                    <Clock className="w-3 h-3" />
                    {item.timestamp}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Status Indicator */}
                  {item.status === 'translating' && (
                    <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
                      </span>
                      <span>번역 중</span>
                    </span>
                  )}

                  {item.status === 'error' && (
                    <button
                      onClick={() => onRetryTranslation(item.id)}
                      title="번역 재시도"
                      className="flex items-center gap-1 px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold transition"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>재시도</span>
                    </button>
                  )}

                  {item.status === 'completed' && (
                    <button
                      onClick={() => copyToClipboard(item.translatedText, `tgt-${item.id}`)}
                      title="번역문 복사"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                    >
                      {copiedId === `tgt-${item.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Text Body */}
              {item.status === 'translating' && !item.translatedText && (
                <div className="flex items-center gap-2 py-2 text-slate-400">
                  <div className="flex space-x-1.5">
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" />
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.4s]" />
                  </div>
                  <span className="text-xs italic text-indigo-500 font-medium">
                    자연스러운 문맥 번역을 생성하고 있습니다...
                  </span>
                </div>
              )}

              {item.status === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-600 py-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{item.errorMessage || '번역 중 오류가 발생했습니다.'}</span>
                </div>
              )}

              {item.translatedText && (
                <p className={`text-slate-900 font-medium ${currentFont.final}`}>
                  {item.translatedText}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
