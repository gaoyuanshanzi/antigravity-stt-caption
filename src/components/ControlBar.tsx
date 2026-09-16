import React, { useState } from 'react'
import {
  Key,
  Eye,
  EyeOff,
  Mic,
  Pause,
  Play,
  Square,
  ArrowLeftRight,
  FileCode,
  FileText,
  Trash2,
  Sliders,
  CheckCircle2,
  Sparkles,
  Globe,
} from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../constants'
import type { FontSize, TranslationEngine } from '../types'

interface ControlBarProps {
  engine: TranslationEngine
  onChangeEngine: (engine: TranslationEngine) => void
  geminiApiKey: string
  onGeminiApiKeyChange: (key: string) => void
  deeplApiKey: string
  onDeeplApiKeyChange: (key: string) => void
  sourceLang: string
  onSourceLangChange: (lang: string) => void
  targetLang: string
  onTargetLangChange: (lang: string) => void
  onSwapLanguages: () => void
  isListening: boolean
  isPaused: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  autoScroll: boolean
  onToggleAutoScroll: () => void
  fontSize: FontSize
  onChangeFontSize: (size: FontSize) => void
  onExportHtml: () => void
  onExportTxt: () => void
  onClear: () => void
  hasItems: boolean
  keyInputRef?: React.RefObject<HTMLInputElement | null>
}

export const ControlBar: React.FC<ControlBarProps> = ({
  engine,
  onChangeEngine,
  geminiApiKey,
  onGeminiApiKeyChange,
  deeplApiKey,
  onDeeplApiKeyChange,
  sourceLang,
  onSourceLangChange,
  targetLang,
  onTargetLangChange,
  onSwapLanguages,
  isListening,
  isPaused,
  onStart,
  onPause,
  onResume,
  onStop,
  autoScroll,
  onToggleAutoScroll,
  fontSize,
  onChangeFontSize,
  onExportHtml,
  onExportTxt,
  onClear,
  hasItems,
  keyInputRef,
}) => {
  const [showApiKey, setShowApiKey] = useState(false)

  const activeApiKey = engine === 'gemini' ? geminiApiKey : deeplApiKey
  const handleActiveApiKeyChange = (val: string) => {
    if (engine === 'gemini') {
      onGeminiApiKeyChange(val)
    } else {
      onDeeplApiKeyChange(val)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
      {/* Row 1: Engine Selector & API Key & Language Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Engine & API Key Box (5 Cols) */}
        <div className="lg:col-span-5 space-y-2">
          {/* Engine Selector Tabs */}
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              번역 엔진 선택
            </label>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => onChangeEngine('gemini')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  engine === 'gemini'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Gemini</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeEngine('deepl')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  engine === 'deepl'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3 h-3 text-blue-600" />
                <span>DeepL</span>
              </button>
            </div>
          </div>

          {/* API Key Box */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Key className="w-3 h-3 text-slate-500" />
                {engine === 'gemini' ? 'Google Gemini API Key' : 'DeepL API Key (Free/Pro)'}
              </span>
              {activeApiKey.trim() ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> 등록됨
                </span>
              ) : (
                <span className="text-[11px] text-amber-600 font-medium">
                  {engine === 'gemini' ? 'Gemini Key 필수' : 'DeepL Key 필수'}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                ref={keyInputRef}
                type={showApiKey ? 'text' : 'password'}
                value={activeApiKey}
                onChange={(e) => handleActiveApiKeyChange(e.target.value)}
                placeholder={
                  engine === 'gemini'
                    ? 'AIzaSy... (Gemini API Key 입력)'
                    : 'DeepL 인증 키 입력 (Free 계정은 ...:fx)'
                }
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'API 키 숨기기' : 'API 키 보기'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>


        {/* Language Selection Box (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-2">
          {/* Source Language */}
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              입력 언어 (Source)
            </label>
            <select
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="self-end pb-0.5">
            <button
              type="button"
              onClick={onSwapLanguages}
              title="언어 전환"
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition shadow-xs"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Target Language */}
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              출력 번역 언어 (Target)
            </label>
            <select
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Row 2: Control Buttons & Sub Features */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Main Action Buttons (Start / Pause / Resume / Stop) */}
        <div className="flex items-center gap-2">
          {!isListening ? (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-indigo-200 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>음성인식 시작</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>재개</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-white" />
                  <span>일시정지</span>
                </button>
              )}

              <button
                onClick={onStop}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>종료</span>
              </button>
            </>
          )}
        </div>

        {/* Settings & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Scroll Toggle */}
          <button
            type="button"
            onClick={onToggleAutoScroll}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              autoScroll
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>자동 스크롤: {autoScroll ? 'ON' : 'OFF'}</span>
          </button>

          {/* Font Size Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
            <span className="text-[11px] font-semibold text-slate-400 px-2">글자크기</span>
            {(['sm', 'md', 'lg', 'xl'] as FontSize[]).map((size) => {
              const labels: Record<FontSize, string> = {
                sm: '소',
                md: '중',
                lg: '대',
                xl: '특대',
              }
              return (
                <button
                  key={size}
                  onClick={() => onChangeFontSize(size)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    fontSize === size
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {labels[size]}
                </button>
              )
            })}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
            {/* HTML Export (Primary) */}
            <button
              onClick={onExportHtml}
              disabled={!hasItems}
              title="화면에 표시된 텍스트를 HTML 파일로 로컬 다운로드"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>HTML 내보내기</span>
            </button>

            {/* TXT Export */}
            <button
              onClick={onExportTxt}
              disabled={!hasItems}
              title="전체 기록을 [시간 / 원문 / 번역문] TXT 파일로 다운로드"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>TXT 저장</span>
            </button>

            {/* Clear Button */}
            {hasItems && (
              <button
                onClick={onClear}
                title="기록 지우기"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
