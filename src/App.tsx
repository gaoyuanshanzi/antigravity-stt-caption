import { useState, useRef, useCallback } from 'react'
import { LoginModal } from './components/LoginModal'
import { Navbar } from './components/Navbar'
import { ControlBar } from './components/ControlBar'
import { SubtitlePanel } from './components/SubtitlePanel'
import { ToastContainer } from './components/ToastContainer'
import { useSpeechRecognition } from './useSpeechRecognition'
import { translateWithGemini, translateWithDeepL } from './services'
import { exportToHtml, exportToTxt } from './utils'
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
} from './constants'
import type { SubtitleItem, FontSize, ToastMessage, TranslationEngine } from './types'

export default function App() {
  // 1. Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true'
  })

  // 2. Translation Engine Selection
  const [engine, setEngine] = useState<TranslationEngine>(() => {
    return (localStorage.getItem('translation_engine') as TranslationEngine) || 'gemini'
  })

  // 3. API Keys (stored in localStorage per engine)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || ''
  })
  const [deeplApiKey, setDeeplApiKey] = useState<string>(() => {
    return localStorage.getItem('deepl_api_key') || ''
  })
  const keyInputRef = useRef<HTMLInputElement | null>(null)

  // 4. Language Selection (Default: Source = pt-BR, Target = ko-KR)
  const [sourceLang, setSourceLang] = useState<string>(DEFAULT_SOURCE_LANG)
  const [targetLang, setTargetLang] = useState<string>(DEFAULT_TARGET_LANG)

  // 5. UI & Display Preferences
  const [fontSize, setFontSize] = useState<FontSize>('md')
  const [autoScroll, setAutoScroll] = useState<boolean>(true)

  // 6. Subtitle Items
  const [items, setItems] = useState<SubtitleItem[]>([])

  // 7. Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback(
    (message: string, type: ToastMessage['type'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4500)
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // --- Engine & Key Handlers ---
  const handleChangeEngine = (newEngine: TranslationEngine) => {
    setEngine(newEngine)
    localStorage.setItem('translation_engine', newEngine)
    addToast(
      newEngine === 'gemini'
        ? 'Google Gemini 번역 엔진으로 전환되었습니다.'
        : 'DeepL 번역 엔진으로 전환되었습니다.',
      'info'
    )
  }

  const handleGeminiApiKeyChange = (newKey: string) => {
    setGeminiApiKey(newKey)
    localStorage.setItem('gemini_api_key', newKey)
  }

  const handleDeeplApiKeyChange = (newKey: string) => {
    setDeeplApiKey(newKey)
    localStorage.setItem('deepl_api_key', newKey)
  }

  // Active key shortcut
  const activeApiKey = engine === 'gemini' ? geminiApiKey : deeplApiKey

  // Handle Login
  const handleLoginSuccess = () => {
    sessionStorage.setItem('admin_authenticated', 'true')
    setIsAuthenticated(true)
    addToast('관리자 인증이 완료되었습니다. 환영합니다!', 'success')
  }

  // Handle Logout
  const handleLogout = () => {
    stopListening()
    sessionStorage.removeItem('admin_authenticated')
    setIsAuthenticated(false)
  }

  // Get current language objects
  const sourceLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang) ||
    SUPPORTED_LANGUAGES[0]
  const targetLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLang) ||
    SUPPORTED_LANGUAGES[1]

  // Translation worker (dispatches to selected engine)
  const processTranslation = useCallback(
    async (
      itemId: string,
      text: string,
      currentEngine: TranslationEngine,
      currentSourceLang: string,
      sourceName: string,
      targetName: string,
      currentTargetLang: string,
      gKey: string,
      dKey: string
    ) => {
      try {
        let translated = ''

        if (currentEngine === 'gemini') {
          translated = await translateWithGemini({
            text,
            sourceLangName: sourceName,
            targetLangName: targetName,
            apiKey: gKey,
          })
        } else {
          translated = await translateWithDeepL({
            text,
            sourceLangCode: currentSourceLang,
            targetLangCode: currentTargetLang,
            apiKey: dKey,
          })
        }

        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  translatedText: translated,
                  status: 'completed',
                  errorMessage: undefined,
                }
              : item
          )
        )
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : '번역 처리 중 오류 발생'
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: errorMsg,
                }
              : item
          )
        )
        addToast(`[번역 실패] ${errorMsg}`, 'error')
      }
    },
    [addToast]
  )

  // Speech Recognition Hook
  const handleFinalSentence = useCallback(
    (sentence: string) => {
      const now = new Date()
      const timestamp = now.toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      const newItemId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

      // Get current key values via functional update to avoid stale closure
      const curGeminiKey = geminiApiKey
      const curDeeplKey = deeplApiKey
      const curEngine = engine
      const curActiveKey = curEngine === 'gemini' ? curGeminiKey : curDeeplKey

      const newItem: SubtitleItem = {
        id: newItemId,
        timestamp,
        sourceText: sentence,
        translatedText: '',
        status: curActiveKey.trim() ? 'translating' : 'pending',
      }

      setItems((prev) => [...prev, newItem])

      if (curActiveKey.trim()) {
        processTranslation(
          newItemId,
          sentence,
          curEngine,
          sourceLang,
          sourceLangObj.name,
          targetLangObj.name,
          targetLang,
          curGeminiKey,
          curDeeplKey
        )
      } else {
        const engineLabel = curEngine === 'gemini' ? 'Gemini' : 'DeepL'
        addToast(
          `${engineLabel} API Key가 등록되지 않아 번역이 지연되었습니다. 상단에 Key를 입력해주세요.`,
          'warning'
        )
      }
    },
    [
      engine,
      geminiApiKey,
      deeplApiKey,
      sourceLang,
      targetLang,
      sourceLangObj.name,
      targetLangObj.name,
      processTranslation,
      addToast,
    ]
  )

  const handleSpeechError = useCallback(
    (errorMessage: string) => {
      addToast(errorMessage, 'error')
    },
    [addToast]
  )

  const {
    isSupported,
    isListening,
    isPaused,
    interimText,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
  } = useSpeechRecognition({
    language: sourceLang,
    onFinalSentence: handleFinalSentence,
    onError: handleSpeechError,
  })

  // Start Button Handler with API Key validation
  const handleStart = () => {
    if (!activeApiKey.trim()) {
      const engineLabel = engine === 'gemini' ? 'Gemini' : 'DeepL'
      addToast(
        `${engineLabel} API Key를 입력해주세요. 상단 입력창에 키를 입력해야 실시간 번역이 가능합니다.`,
        'warning'
      )
      keyInputRef.current?.focus()
      return
    }

    if (!isSupported) {
      addToast('현재 브라우저에서는 Web Speech API를 지원하지 않습니다. Chrome 브라우저를 이용해주세요.', 'error')
      return
    }

    startListening()
    addToast('실시간 음성 인식을 시작했습니다. 마이크로 말씀하세요.', 'info')
  }

  // Swap Languages
  const handleSwapLanguages = () => {
    const temp = sourceLang
    setSourceLang(targetLang)
    setTargetLang(temp)
    addToast('입력 언어와 출력 언어가 전환되었습니다.', 'info')
  }

  // Retry Translation for failed item
  const handleRetryTranslation = (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    if (!activeApiKey.trim()) {
      const engineLabel = engine === 'gemini' ? 'Gemini' : 'DeepL'
      addToast(`${engineLabel} API Key를 먼저 입력해주세요.`, 'warning')
      keyInputRef.current?.focus()
      return
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: 'translating', errorMessage: undefined }
          : i
      )
    )

    processTranslation(
      id,
      item.sourceText,
      engine,
      sourceLang,
      sourceLangObj.name,
      targetLangObj.name,
      targetLang,
      geminiApiKey,
      deeplApiKey
    )
  }

  // Export Handlers
  const handleExportHtml = () => {
    if (items.length === 0) {
      addToast('내보낼 자막 기록이 없습니다.', 'warning')
      return
    }
    exportToHtml(items, sourceLangObj, targetLangObj)
    addToast('HTML 자막 기록 파일이 다운로드 폴더에 저장되었습니다.', 'success')
  }

  const handleExportTxt = () => {
    if (items.length === 0) {
      addToast('저장할 자막 기록이 없습니다.', 'warning')
      return
    }
    exportToTxt(items, sourceLangObj, targetLangObj)
    addToast('TXT 자막 기록 파일이 다운로드 폴더에 저장되었습니다.', 'success')
  }

  // Clear Items
  const handleClear = () => {
    if (window.confirm('현재 화면의 모든 자막 기록을 초기화하시겠습니까?')) {
      setItems([])
      addToast('자막 기록이 초기화되었습니다.', 'info')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* 1. Admin Login Gate */}
      {!isAuthenticated && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {/* 2. Top Navigation Bar */}
      <Navbar
        isListening={isListening}
        isPaused={isPaused}
        totalSentences={items.length}
        engine={engine}
        onLogout={handleLogout}
      />

      {/* 3. Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-5">
        {/* Control Bar */}
        <ControlBar
          engine={engine}
          onChangeEngine={handleChangeEngine}
          geminiApiKey={geminiApiKey}
          onGeminiApiKeyChange={handleGeminiApiKeyChange}
          deeplApiKey={deeplApiKey}
          onDeeplApiKeyChange={handleDeeplApiKeyChange}
          sourceLang={sourceLang}
          onSourceLangChange={setSourceLang}
          targetLang={targetLang}
          onTargetLangChange={setTargetLang}
          onSwapLanguages={handleSwapLanguages}
          isListening={isListening}
          isPaused={isPaused}
          onStart={handleStart}
          onPause={pauseListening}
          onResume={resumeListening}
          onStop={stopListening}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
          fontSize={fontSize}
          onChangeFontSize={setFontSize}
          onExportHtml={handleExportHtml}
          onExportTxt={handleExportTxt}
          onClear={handleClear}
          hasItems={items.length > 0}
          keyInputRef={keyInputRef}
        />

        {/* Subtitle Dual Panels */}
        <SubtitlePanel
          items={items}
          interimText={interimText}
          sourceLang={sourceLangObj}
          targetLang={targetLangObj}
          fontSize={fontSize}
          autoScroll={autoScroll}
          isListening={isListening}
          engine={engine}
          onRetryTranslation={handleRetryTranslation}
        />
      </main>

      {/* 4. Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}


