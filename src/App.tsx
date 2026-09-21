import { useState, useRef, useCallback, useEffect } from 'react'
import { LoginModal } from './components/LoginModal'
import { Navbar } from './components/Navbar'
import { ControlBar } from './components/ControlBar'
import { SubtitlePanel } from './components/SubtitlePanel'
import { ToastContainer } from './components/ToastContainer'
import { SaveModal } from './components/SaveModal'
import { FileExplorerSidebar } from './components/FileExplorerSidebar'
import { AudioPlayerModal } from './components/AudioPlayerModal'
import { NotepadModal } from './components/NotepadModal'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useAudioRecorder } from './useAudioRecorder'
import {
  translateWithGemini,
  translateWithDeepL,
  transcribeAudioWithGemini,
} from './services'
import {
  generateHtmlContent,
  generateTxtContent,
  triggerDownload,
  blobToBase64,
  saveRecordToNeon,
  fetchNeonRecords,
  fetchNeonRecordDetail,
  deleteNeonRecord,
  base64ToBlob,
  saveAsWithPicker,
} from './utils'
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
} from './constants'
import type {
  SubtitleItem,
  FontSize,
  ToastMessage,
  TranslationEngine,
  SaveFileType,
  SaveDestination,
  NeonArchiveRecord,
} from './types'

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

  // 7. Save Modal State & Audio Recording
  interface ModalSaveData {
    isOpen: boolean
    fileType: SaveFileType
    filename: string
    detailInfo?: string
    mp3Blob?: Blob
    textContent?: string
  }
  const [modalData, setModalData] = useState<ModalSaveData | null>(null)
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false)

  // 8. Neon DB Explorer & Viewer State
  const [neonRecords, setNeonRecords] = useState<NeonArchiveRecord[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(false)

  const [audioPlayerState, setAudioPlayerState] = useState<{
    isOpen: boolean
    filename: string
    audioUrl: string
    sourceLang?: string
    targetLang?: string
    createdAt?: string
  } | null>(null)

  const [notepadState, setNotepadState] = useState<{
    isOpen: boolean
    filename: string
    content: string
    createdAt?: string
    sentenceCount?: number
    record?: NeonArchiveRecord
  } | null>(null)

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true)
    try {
      const recs = await fetchNeonRecords()
      setNeonRecords(recs)
    } catch (err: any) {
      console.warn('Failed to load neon records:', err)
    } finally {
      setIsLoadingRecords(false)
    }
  }, [])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])


  // 9. Toast Notifications
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
    discardAudioRecording()
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

  // Audio Stream Speech Activity & STT states (Mobile & Desktop fallback)
  const [isAudioSpeaking, setIsAudioSpeaking] = useState<boolean>(false)
  const [isAudioTranscribing, setIsAudioTranscribing] = useState<boolean>(false)
  const recentSentencesRef = useRef<Array<{ text: string; time: number }>>([])

  // Speech Recognition & Audio STT Callback
  const handleFinalSentence = useCallback(
    (sentence: string, _origin: 'web_speech' | 'audio_stream' = 'web_speech') => {
      const trimmedSentence = sentence.trim()
      if (!trimmedSentence) return

      // Sentence deduplication check
      const normalize = (t: string) =>
        t.toLowerCase().replace(/[.,?!;:~"'`…\s]/g, '')
      const norm = normalize(trimmedSentence)
      if (!norm) return

      const nowMs = Date.now()
      // Prune entries older than 8 seconds
      recentSentencesRef.current = recentSentencesRef.current.filter(
        (entry) => nowMs - entry.time < 8000
      )

      const isDuplicate = recentSentencesRef.current.some((entry) => {
        const entryNorm = normalize(entry.text)
        if (entryNorm === norm) return true
        if (nowMs - entry.time < 4500) {
          if (entryNorm.includes(norm) || norm.includes(entryNorm)) {
            return true
          }
        }
        return false
      })

      if (isDuplicate) {
        return
      }

      recentSentencesRef.current.push({ text: trimmedSentence, time: nowMs })

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
        sourceText: trimmedSentence,
        translatedText: '',
        status: curActiveKey.trim() ? 'translating' : 'pending',
      }

      setItems((prev) => [...prev, newItem])

      if (curActiveKey.trim()) {
        processTranslation(
          newItemId,
          trimmedSentence,
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

  // Audio Stream Phrase Transcription (Fallback for mobile mic exclusivity)
  const handlePhraseRecorded = useCallback(
    async (phraseBlob: Blob, blobMimeType?: string) => {
      const currentGeminiKey =
        geminiApiKey.trim() ||
        (engine === 'gemini' ? activeApiKey.trim() : '')

      if (!currentGeminiKey) {
        addToast(
          'Gemini API Key가 없어 모바일 음성 변환 불가. 상단 입력창에 Gemini API Key를 입력해주세요.',
          'warning'
        )
        return
      }

      if (phraseBlob.size < 1000) return // Skip empty blobs

      setIsAudioTranscribing(true)
      try {
        const base64 = await blobToBase64(phraseBlob)
        const actualMime = blobMimeType || phraseBlob.type || 'audio/webm'
        // Use language code for clearer Gemini STT prompt
        const langCode = sourceLang // e.g. 'pt-BR', 'ko-KR'
        const langNative = sourceLangObj.nativeName || sourceLangObj.name
        const langDescriptor = `${langNative} (language code: ${langCode})`
        const text = await transcribeAudioWithGemini({
          audioBase64: base64,
          mimeType: actualMime,
          sourceLangName: langDescriptor,
          apiKey: currentGeminiKey,
        })
        if (text && text.trim()) {
          handleFinalSentence(text.trim(), 'audio_stream')
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err)
        console.warn('Audio stream STT error:', errMsg)
        addToast(`음성 변환 오류: ${errMsg}`, 'error')
      } finally {
        setIsAudioTranscribing(false)
      }
    },
    [geminiApiKey, engine, activeApiKey, sourceLang, sourceLangObj, handleFinalSentence, addToast]
  )

  const handleSpeechDetected = useCallback((isSpeaking: boolean) => {
    setIsAudioSpeaking(isSpeaking)
  }, [])

  const {
    isRecording: isAudioRecording,
    isPaused: isAudioPaused,
    startRecording: startAudioRecording,
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    stopRecording: stopAudioRecording,
    discardRecording: discardAudioRecording,
  } = useAudioRecorder({
    onPhraseRecorded: handlePhraseRecorded,
    onSpeechDetected: handleSpeechDetected,
  })

  // Start Button Handler with API Key validation & MP3 Recording
  const handleStart = async () => {
    if (!activeApiKey.trim()) {
      const engineLabel = engine === 'gemini' ? 'Gemini' : 'DeepL'
      addToast(
        `${engineLabel} API Key를 입력해주세요. 상단 입력창에 키를 입력해야 실시간 번역이 가능합니다.`,
        'warning'
      )
      keyInputRef.current?.focus()
      return
    }

    // Call startListening SYNCHRONOUSLY within the user touch/click gesture!
    // This is critical for mobile browsers where transient user activation expires across await.
    if (isSupported) {
      try {
        startListening()
      } catch (sttErr) {
        console.warn('Sync startListening warning:', sttErr)
      }
    }

    try {
      await startAudioRecording()
      addToast(
        '실시간 음성 인식 및 MP3 음성 녹음을 시작했습니다. (128 kbps)',
        'info'
      )
    } catch (err: any) {
      console.warn('Audio recording failed to start:', err)
      addToast(
        '마이크 녹음 권한이 없거나 오류가 발생했습니다. STT 음성인식만 시도합니다.',
        'warning'
      )
    }
  }

  // Pause STT & Recording
  const handlePause = () => {
    pauseListening()
    pauseAudioRecording()
    addToast('음성 인식 및 음성 녹음이 일시정지되었습니다.', 'info')
  }

  // Resume STT & Recording
  const handleResume = () => {
    resumeListening()
    resumeAudioRecording()
    addToast('음성 인식 및 음성 녹음이 재개되었습니다.', 'info')
  }

  // Stop STT & Recording -> Prompt to save MP3
  const handleStop = async () => {
    stopListening()
    addToast('음성 인식 및 녹음을 종료합니다. 오디오 변환 중...', 'info')
    try {
      const recordResult = await stopAudioRecording()
      if (recordResult && recordResult.blob && recordResult.blob.size > 0) {
        setModalData({
          isOpen: true,
          fileType: 'mp3',
          filename: recordResult.filename,
          detailInfo: `${recordResult.durationSeconds}초 녹음 (${(recordResult.blob.size / 1024).toFixed(1)} KB)`,
          mp3Blob: recordResult.blob,
        })
      }
    } catch (err: any) {
      console.error('Stop recording error:', err)
      addToast(`녹음 파일 처리 중 오류 발생: ${err.message || '오류'}`, 'error')
    }
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

  // Export Handlers with Save Target Modal
  const handleExportHtml = () => {
    if (items.length === 0) {
      addToast('내보낼 자막 기록이 없습니다.', 'warning')
      return
    }
    const { html, filename } = generateHtmlContent(
      items,
      sourceLangObj,
      targetLangObj
    )
    setModalData({
      isOpen: true,
      fileType: 'html',
      filename,
      detailInfo: `총 ${items.length}개 자막 문장`,
      textContent: html,
    })
  }

  const handleExportTxt = () => {
    if (items.length === 0) {
      addToast('저장할 자막 기록이 없습니다.', 'warning')
      return
    }
    const { text, filename } = generateTxtContent(
      items,
      sourceLangObj,
      targetLangObj
    )
    setModalData({
      isOpen: true,
      fileType: 'txt',
      filename,
      detailInfo: `총 ${items.length}개 자막 문장`,
      textContent: text,
    })
  }

  // Confirm Saving from Modal (Local / Neon DB / Both)
  const handleConfirmSave = async (destination: SaveDestination) => {
    if (!modalData) return
    const { fileType, filename, mp3Blob, textContent } = modalData

    setIsSavingRecord(true)
    try {
      let savedLocal = false
      let savedNeon = false

      // 1. Local Download
      if (destination === 'local' || destination === 'both') {
        if (fileType === 'mp3' && mp3Blob) {
          triggerDownload(mp3Blob, filename, 'audio/mp3')
          savedLocal = true
        } else if (fileType === 'html' && textContent) {
          triggerDownload(textContent, filename, 'text/html')
          savedLocal = true
        } else if (fileType === 'txt' && textContent) {
          triggerDownload(textContent, filename, 'text/plain')
          savedLocal = true
        }
      }

      // 2. Neon DB Save
      if (destination === 'neon' || destination === 'both') {
        if (fileType === 'mp3' && mp3Blob) {
          const base64 = await blobToBase64(mp3Blob)
          await saveRecordToNeon({
            record_type: 'audio_mp3',
            filename,
            source_lang: sourceLang,
            target_lang: targetLang,
            sentence_count: items.length,
            audio_base64: base64,
          })
          savedNeon = true
        } else if (fileType === 'html' && textContent) {
          await saveRecordToNeon({
            record_type: 'html',
            filename,
            source_lang: sourceLang,
            target_lang: targetLang,
            sentence_count: items.length,
            content_text: textContent,
          })
          savedNeon = true
        } else if (fileType === 'txt' && textContent) {
          await saveRecordToNeon({
            record_type: 'txt',
            filename,
            source_lang: sourceLang,
            target_lang: targetLang,
            sentence_count: items.length,
            content_text: textContent,
          })
          savedNeon = true
        }
      }

      // Show result message
      if (savedNeon && savedLocal) {
        addToast(
          `Neon.tech DB 및 로컬 다운로드 폴더에 모두 저장되었습니다! (${filename})`,
          'success'
        )
      } else if (savedNeon) {
        addToast(`Neon.tech DB에 안전하게 저장되었습니다. (${filename})`, 'success')
      } else if (savedLocal) {
        addToast(`로컬 다운로드 폴더에 저장되었습니다. (${filename})`, 'success')
      }

      if (savedNeon) {
        loadRecords()
      }

      setModalData(null)
    } catch (err: any) {
      console.error('Save failed:', err)
      addToast(`저장 처리 실패: ${err.message || '오류 발생'}`, 'error')
    } finally {
      setIsSavingRecord(false)
    }
  }

  // Double Click Handler (MP3: audio play, HTML: open in browser, TXT: open notepad viewer)
  const handleDoubleClickRecord = async (record: NeonArchiveRecord) => {
    try {
      addToast(`'${record.filename}' 불러오는 중...`, 'info')
      const detail = await fetchNeonRecordDetail(record.id)

      if (record.record_type === 'audio_mp3') {
        if (!detail.audio_base64) {
          addToast('음성 오디오 데이터가 존재하지 않습니다.', 'warning')
          return
        }
        const blob = base64ToBlob(detail.audio_base64, 'audio/mp3')
        const audioUrl = URL.createObjectURL(blob)
        setAudioPlayerState({
          isOpen: true,
          filename: detail.filename,
          audioUrl,
          sourceLang: detail.source_lang,
          targetLang: detail.target_lang,
          createdAt: detail.created_at,
        })
      } else if (record.record_type === 'html') {
        if (!detail.content_text) {
          addToast('HTML 본문 데이터가 존재하지 않습니다.', 'warning')
          return
        }
        const blob = new Blob([detail.content_text], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        addToast('브라우저 새 탭에서 HTML 자막 문서를 열었습니다.', 'success')
      } else if (record.record_type === 'txt') {
        setNotepadState({
          isOpen: true,
          filename: detail.filename,
          content: detail.content_text || '',
          createdAt: detail.created_at,
          sentenceCount: detail.sentence_count,
          record: detail,
        })
      }
    } catch (err: any) {
      console.error('Failed to open record:', err)
      addToast(`파일 열기 실패: ${err.message || '오류'}`, 'error')
    }
  }

  // Right Click Save As Handler (Using showSaveFilePicker with fallback)
  const handleSaveAsRecord = async (record: NeonArchiveRecord) => {
    try {
      addToast(`'${record.filename}' 다른 이름으로 저장 준비 중...`, 'info')
      const detail = await fetchNeonRecordDetail(record.id)

      let blob: Blob
      let mimeType = 'text/plain'

      if (record.record_type === 'audio_mp3') {
        if (!detail.audio_base64) {
          addToast('저장할 오디오 데이터가 없습니다.', 'warning')
          return
        }
        mimeType = 'audio/mp3'
        blob = base64ToBlob(detail.audio_base64, mimeType)
      } else if (record.record_type === 'html') {
        mimeType = 'text/html'
        blob = new Blob([detail.content_text || ''], { type: 'text/html;charset=utf-8' })
      } else {
        mimeType = 'text/plain'
        blob = new Blob([detail.content_text || ''], { type: 'text/plain;charset=utf-8' })
      }

      await saveAsWithPicker(blob, detail.filename, mimeType)
      addToast(`'${detail.filename}' 다른 이름으로 저장이 완료되었습니다.`, 'success')
    } catch (err: any) {
      console.error('Save As error:', err)
      addToast(`다른 이름으로 저장 실패: ${err.message || '오류'}`, 'error')
    }
  }

  // Delete Record Handler
  const handleDeleteRecord = async (record: NeonArchiveRecord) => {
    if (window.confirm(`'${record.filename}' 파일을 Neon DB에서 완전히 삭제하시겠습니까?`)) {
      try {
        await deleteNeonRecord(record.id)
        addToast(`'${record.filename}' 파일이 삭제되었습니다.`, 'info')
        loadRecords()
      } catch (err: any) {
        addToast(`삭제 실패: ${err.message || '오류'}`, 'error')
      }
    }
  }

  // Clear Items
  const handleClear = () => {
    if (window.confirm('현재 화면의 모든 자막 기록을 초기화하시겠습니까?')) {
      setItems([])
      addToast('자막 기록이 초기화되었습니다.', 'info')
    }
  }

  // Combined active states between Web Speech API and Audio Recorder VAD
  const isActivelyListening = isListening || isAudioRecording
  const isActivelyPaused = isPaused || isAudioPaused
  const activeInterimText =
    interimText ||
    (isAudioSpeaking
      ? '🎤 음성 감지 중... (말씀하시는 중)'
      : isAudioTranscribing
      ? '⏳ 음성 변환 중...'
      : '')

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col antialiased overflow-hidden">
      {/* 1. Admin Login Gate */}
      {!isAuthenticated && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {/* 2. Top Navigation Bar */}
      <Navbar
        isListening={isActivelyListening}
        isPaused={isActivelyPaused}
        totalSentences={items.length}
        engine={engine}
        onLogout={handleLogout}
      />

      {/* 3. Main Workspace Container with Left Sidebar & Center Dashboard */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Directory Explorer (Neon DB Archive) */}
        <FileExplorerSidebar
          records={neonRecords}
          isLoading={isLoadingRecords}
          onRefresh={loadRecords}
          onDoubleClickFile={handleDoubleClickRecord}
          onSaveAsFile={handleSaveAsRecord}
          onDeleteFile={handleDeleteRecord}
        />

        {/* Center Main Dashboard */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-5 max-w-7xl mx-auto w-full">
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
            isListening={isActivelyListening}
            isPaused={isActivelyPaused}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
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
            interimText={activeInterimText}
            sourceLang={sourceLangObj}
            targetLang={targetLangObj}
            fontSize={fontSize}
            autoScroll={autoScroll}
            isListening={isActivelyListening}
            engine={engine}
            onRetryTranslation={handleRetryTranslation}
          />
        </main>
      </div>

      {/* 4. Save Modal (MP3 / HTML / TXT) */}
      {modalData && (
        <SaveModal
          isOpen={modalData.isOpen}
          fileType={modalData.fileType}
          filename={modalData.filename}
          detailInfo={modalData.detailInfo}
          isSaving={isSavingRecord}
          onConfirm={handleConfirmSave}
          onClose={() => setModalData(null)}
        />
      )}

      {/* 5. Audio Player Modal (MP3 Double-Click) */}
      {audioPlayerState && (
        <AudioPlayerModal
          isOpen={audioPlayerState.isOpen}
          filename={audioPlayerState.filename}
          audioUrl={audioPlayerState.audioUrl}
          sourceLang={audioPlayerState.sourceLang}
          targetLang={audioPlayerState.targetLang}
          createdAt={audioPlayerState.createdAt}
          onClose={() => setAudioPlayerState(null)}
        />
      )}

      {/* 6. Notepad Modal (TXT Double-Click) */}
      {notepadState && (
        <NotepadModal
          isOpen={notepadState.isOpen}
          filename={notepadState.filename}
          content={notepadState.content}
          createdAt={notepadState.createdAt}
          sentenceCount={notepadState.sentenceCount}
          onClose={() => setNotepadState(null)}
          onSaveAs={() => {
            if (notepadState.record) {
              handleSaveAsRecord(notepadState.record)
            } else {
              const blob = new Blob([notepadState.content], {
                type: 'text/plain;charset=utf-8',
              })
              saveAsWithPicker(blob, notepadState.filename, 'text/plain')
            }
          }}
        />
      )}

      {/* 7. Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}



