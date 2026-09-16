import { useState, useEffect, useRef, useCallback } from 'react'

// Web Speech API TypeScript declarations
interface IWindow extends Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

interface UseSpeechRecognitionProps {
  language: string
  onFinalSentence: (sentence: string) => void
  onError?: (errorMessage: string) => void
}

export function useSpeechRecognition({
  language,
  onFinalSentence,
  onError,
}: UseSpeechRecognitionProps) {
  const [isSupported, setIsSupported] = useState<boolean>(true)
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [interimText, setInterimText] = useState<string>('')

  const recognitionRef = useRef<any>(null)
  const shouldListenRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)
  const restartTimerRef = useRef<any>(null)
  const currentLangRef = useRef<string>(language)
  const lastFinalTimestampRef = useRef<number>(0)

  // Keep callback refs updated to prevent re-creation loops
  const onFinalSentenceRef = useRef(onFinalSentence)
  onFinalSentenceRef.current = onFinalSentence
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  currentLangRef.current = language

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const win = window as unknown as IWindow
    const SpeechRecognitionConstructor =
      win.SpeechRecognition || win.webkitSpeechRecognition

    if (!SpeechRecognitionConstructor) {
      setIsSupported(false)
      onErrorRef.current?.('이 브라우저는 Web Speech API를 지원하지 않습니다. Chrome 브라우저 사용을 권장합니다.')
      return
    }

    setIsSupported(true)
  }, [])

  const startRecognitionInstance = useCallback(() => {
    const win = window as unknown as IWindow
    const SpeechRecognitionConstructor =
      win.SpeechRecognition || win.webkitSpeechRecognition

    if (!SpeechRecognitionConstructor) return

    // Clean up any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognitionConstructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = currentLangRef.current
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          const trimmed = transcript.trim()
          if (trimmed) {
            // Prevent immediate duplicate firing within 300ms
            const now = Date.now()
            if (now - lastFinalTimestampRef.current > 300) {
              lastFinalTimestampRef.current = now
              onFinalSentenceRef.current(trimmed)
            }
          }
        } else {
          interim += transcript
        }
      }
      setInterimText(interim)
    }

    recognition.onerror = (event: any) => {
      // 'no-speech' is triggered when silence occurs - we do not stop listening!
      if (event.error === 'no-speech') {
        return
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false
        setIsListening(false)
        setIsPaused(false)
        onErrorRef.current?.('마이크 사용 권한이 거부되었거나 사용할 수 없습니다. 브라우저 마이크 권한을 허용해주세요.')
        return
      }

      if (event.error === 'audio-capture') {
        shouldListenRef.current = false
        setIsListening(false)
        setIsPaused(false)
        onErrorRef.current?.('마이크 오디오를 캡처할 수 없습니다. 마이크 연결 상태를 확인해주세요.')
        return
      }

      if (event.error === 'network') {
        // Network error can be transient, keep-alive will attempt restart
        console.warn('STT Network issue detected, auto-reconnecting...')
      }
    }

    recognition.onend = () => {
      // Clear interim text on disconnect
      setInterimText('')

      // KEEP-ALIVE LOOP:
      // If user intended to listen and is not explicitly paused, auto restart!
      if (shouldListenRef.current && !isPausedRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !isPausedRef.current) {
            try {
              startRecognitionInstance()
            } catch (err) {
              console.error('Failed to restart STT recognition:', err)
            }
          }
        }, 150)
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (e: any) {
      // If already started or failed to start
      console.warn('SpeechRecognition start warning:', e)
    }
  }, [])

  // Start listening (Fresh or Resume)
  const startListening = useCallback(() => {
    shouldListenRef.current = true
    isPausedRef.current = false
    setIsPaused(false)
    startRecognitionInstance()
  }, [startRecognitionInstance])

  // Pause listening
  const pauseListening = useCallback(() => {
    isPausedRef.current = true
    setIsPaused(true)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // ignore
      }
    }
    setInterimText('')
  }, [])

  // Resume listening
  const resumeListening = useCallback(() => {
    isPausedRef.current = false
    setIsPaused(false)
    shouldListenRef.current = true
    startRecognitionInstance()
  }, [startRecognitionInstance])

  // Stop listening completely
  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    isPausedRef.current = false
    setIsListening(false)
    setIsPaused(false)
    setInterimText('')

    clearTimeout(restartTimerRef.current)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null
    }
  }, [])

  // When language changes, restart if currently active
  useEffect(() => {
    if (shouldListenRef.current && !isPausedRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.stop() // onend will trigger restart with new lang
      } catch (e) {
        // ignore
      }
    }
  }, [language])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false
      clearTimeout(restartTimerRef.current)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (e) {
          // ignore
        }
      }
    }
  }, [])

  return {
    isSupported,
    isListening,
    isPaused,
    interimText,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
  }
}
