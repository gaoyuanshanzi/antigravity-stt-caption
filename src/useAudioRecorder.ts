import { useState, useRef, useCallback } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs'

interface AudioRecordResult {
  blob: Blob
  durationSeconds: number
  filename: string
}

interface UseAudioRecorderProps {
  onPhraseRecorded?: (phraseBlob: Blob, mimeType: string) => void
  onSpeechDetected?: (isSpeaking: boolean) => void
}

function floatToInt16(floatArray: Float32Array): Int16Array {
  const int16 = new Int16Array(floatArray.length)
  for (let i = 0; i < floatArray.length; i++) {
    const s = Math.max(-1, Math.min(1, floatArray[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

function getFormattedDateTime(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

export function useAudioRecorder({
  onPhraseRecorded,
  onSpeechDetected,
}: UseAudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)

  // Full recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const selectedMimeTypeRef = useRef<string>('')

  // Phrase STT refs (header chunk + speech window chunks)
  const headerChunkRef = useRef<Blob | null>(null)
  const phraseChunksRef = useRef<Blob[]>([])
  const chunkIndexRef = useRef<number>(0)

  // VAD state refs
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadAudioCtxRef = useRef<AudioContext | null>(null)
  const isSpeakingRef = useRef<boolean>(false)
  const speechStartTimeRef = useRef<number>(0)
  const lastSpeechTimeRef = useRef<number>(0)
  const isRecordingRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Timing refs
  const startTimeRef = useRef<number>(0)
  const accumulatedDurationRef = useRef<number>(0)
  const lastResumeTimeRef = useRef<number>(0)

  const onPhraseRecordedRef = useRef(onPhraseRecorded)
  onPhraseRecordedRef.current = onPhraseRecorded
  const onSpeechDetectedRef = useRef(onSpeechDetected)
  onSpeechDetectedRef.current = onSpeechDetected

  const cleanupVad = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = null
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect() } catch { /* ignore */ }
      analyserRef.current = null
    }
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
      vadAudioCtxRef.current.close().catch(() => {})
      vadAudioCtxRef.current = null
    }
    phraseChunksRef.current = []
    headerChunkRef.current = null
    isSpeakingRef.current = false
    speechStartTimeRef.current = 0
    lastSpeechTimeRef.current = 0
  }, [])

  const emitPhrase = useCallback(() => {
    const header = headerChunkRef.current
    const chunks = phraseChunksRef.current
    phraseChunksRef.current = []

    if (!header || chunks.length === 0) return

    const mimeType = selectedMimeTypeRef.current || 'audio/webm'
    // Always prepend the WebM header chunk to ensure decodability
    const blob = new Blob([header, ...chunks], { type: mimeType })

    if (blob.size < 1000) return // Skip suspiciously small blobs (< 1KB)

    onPhraseRecordedRef.current?.(blob, mimeType)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      // Cleanup previous session
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
      cleanupVad()

      audioChunksRef.current = []
      phraseChunksRef.current = []
      headerChunkRef.current = null
      chunkIndexRef.current = 0
      accumulatedDurationRef.current = 0
      isSpeakingRef.current = false

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      // Select supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        '',
      ]
      let selectedMimeType = ''
      for (const mime of mimeTypes) {
        if (!mime || MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime
          break
        }
      }
      selectedMimeTypeRef.current = selectedMimeType

      // ── VAD using AnalyserNode + setInterval (works reliably on all mobile browsers) ──
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        const vadCtx = new AudioContextClass({ sampleRate: 16000 })

        // Mobile browsers start AudioContext in suspended state
        if (vadCtx.state === 'suspended') {
          await vadCtx.resume()
        }

        vadAudioCtxRef.current = vadCtx
        const source = vadCtx.createMediaStreamSource(stream)
        const analyser = vadCtx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.5
        source.connect(analyser)
        analyserRef.current = analyser

        const freqBuffer = new Uint8Array(analyser.frequencyBinCount)

        vadIntervalRef.current = setInterval(() => {
          if (!isRecordingRef.current || isPausedRef.current) return

          analyser.getByteFrequencyData(freqBuffer)

          // Focus on speech frequency range (300-3400 Hz for voice)
          const sampleRate = vadCtx.sampleRate || 16000
          const binHz = sampleRate / (analyser.fftSize)
          const lowBin = Math.floor(300 / binHz)
          const highBin = Math.ceil(3400 / binHz)

          let sum = 0
          let count = 0
          for (let i = lowBin; i < highBin && i < freqBuffer.length; i++) {
            sum += freqBuffer[i]
            count++
          }
          const avg = count > 0 ? sum / count : 0

          const now = Date.now()
          const isVoice = avg >= 10

          if (isVoice) {
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true
              speechStartTimeRef.current = now
              onSpeechDetectedRef.current?.(true)
            }
            lastSpeechTimeRef.current = now

            // Long utterance guard: slice at 7s
            if (now - speechStartTimeRef.current > 7000) {
              emitPhrase()
              speechStartTimeRef.current = now
            }
          } else {
            if (isSpeakingRef.current) {
              // Require 800ms of silence before emitting phrase
              if (now - lastSpeechTimeRef.current >= 800) {
                const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current
                if (speechDuration >= 400) {
                  emitPhrase()
                } else {
                  // Too short, discard
                  phraseChunksRef.current = []
                }
                isSpeakingRef.current = false
                speechStartTimeRef.current = 0
                onSpeechDetectedRef.current?.(false)
              }
            }
          }
        }, 80)
      } catch (vadErr) {
        console.warn('VAD AnalyserNode initialization failed (non-fatal):', vadErr)
      }

      // ── MediaRecorder for full MP3 + phrase chunk collection ──
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return

        const chunkIdx = chunkIndexRef.current++
        audioChunksRef.current.push(event.data)

        // Store the first chunk as the WebM/codec header
        if (chunkIdx === 0) {
          headerChunkRef.current = event.data
          return // Don't add header to phrase chunks yet
        }

        // Only collect phrase chunks while speaking or within 400ms after speech ends
        const now = Date.now()
        if (
          isSpeakingRef.current ||
          (lastSpeechTimeRef.current > 0 && now - lastSpeechTimeRef.current < 400)
        ) {
          phraseChunksRef.current.push(event.data)
        }
      }

      recorder.start(200) // 200ms timeslice for responsive VAD chunk collection
      mediaRecorderRef.current = recorder
      startTimeRef.current = Date.now()
      lastResumeTimeRef.current = Date.now()
      isRecordingRef.current = true
      isPausedRef.current = false
      setIsRecording(true)
      setIsPaused(false)
    } catch (err) {
      console.error('Failed to start audio recording:', err)
      cleanupVad()
      throw err
    }
  }, [cleanupVad, emitPhrase])

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state === 'running') {
      vadAudioCtxRef.current.suspend().catch(() => {})
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      accumulatedDurationRef.current += Date.now() - lastResumeTimeRef.current
      setIsPaused(true)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state === 'suspended') {
      vadAudioCtxRef.current.resume().catch(() => {})
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      lastResumeTimeRef.current = Date.now()
      setIsPaused(false)
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<AudioRecordResult | null> => {
    isRecordingRef.current = false
    isPausedRef.current = false
    cleanupVad()

    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) {
        setIsRecording(false)
        setIsPaused(false)
        resolve(null)
        return
      }

      if (recorder.state === 'recording') {
        accumulatedDurationRef.current += Date.now() - lastResumeTimeRef.current
      }

      const finalDurationSec = Math.max(
        1,
        Math.round(accumulatedDurationRef.current / 1000)
      )

      recorder.onstop = async () => {
        setIsEncoding(true)
        try {
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop())
            mediaStreamRef.current = null
          }

          if (audioChunksRef.current.length === 0) {
            resolve(null)
            return
          }

          const rawBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          })
          const arrayBuffer = await rawBlob.arrayBuffer()

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          const audioCtx = new AudioContextClass()
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

          const channels = Math.min(audioBuffer.numberOfChannels, 2)
          const sampleRate = audioBuffer.sampleRate
          const kbps = 128

          const encoder = new Mp3Encoder(channels, sampleRate, kbps)
          const mp3Chunks: Uint8Array[] = []
          const sampleBlockSize = 1152

          if (channels === 2) {
            const leftData = floatToInt16(audioBuffer.getChannelData(0))
            const rightData = floatToInt16(audioBuffer.getChannelData(1))
            for (let i = 0; i < leftData.length; i += sampleBlockSize) {
              const leftChunk = leftData.subarray(i, i + sampleBlockSize)
              const rightChunk = rightData.subarray(i, i + sampleBlockSize)
              const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk)
              if (mp3buf.length > 0) mp3Chunks.push(new Uint8Array(mp3buf))
            }
          } else {
            const monoData = floatToInt16(audioBuffer.getChannelData(0))
            for (let i = 0; i < monoData.length; i += sampleBlockSize) {
              const chunk = monoData.subarray(i, i + sampleBlockSize)
              const mp3buf = encoder.encodeBuffer(chunk)
              if (mp3buf.length > 0) mp3Chunks.push(new Uint8Array(mp3buf))
            }
          }

          const flushBuf = encoder.flush()
          if (flushBuf.length > 0) mp3Chunks.push(new Uint8Array(flushBuf))

          const mp3Blob = new Blob(mp3Chunks as BlobPart[], { type: 'audio/mp3' })
          const filename = `stt_audio_${getFormattedDateTime()}.mp3`

          if (audioCtx.state !== 'closed') {
            await audioCtx.close().catch(() => {})
          }

          resolve({ blob: mp3Blob, durationSeconds: finalDurationSec, filename })
        } catch (error) {
          console.error('MP3 encoding error:', error)
          reject(error)
        } finally {
          setIsEncoding(false)
          setIsRecording(false)
          setIsPaused(false)
          audioChunksRef.current = []
          mediaRecorderRef.current = null
        }
      }

      try {
        if (recorder.state !== 'inactive') {
          recorder.stop()
        } else {
          recorder.onstop(new Event('stop'))
        }
      } catch (err) {
        console.error('Error stopping recorder:', err)
        reject(err)
      }
    })
  }, [cleanupVad])

  const discardRecording = useCallback(() => {
    isRecordingRef.current = false
    isPausedRef.current = false
    cleanupVad()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch { /* ignore */ }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    audioChunksRef.current = []
    setIsRecording(false)
    setIsPaused(false)
    setIsEncoding(false)
  }, [cleanupVad])

  return {
    isRecording,
    isPaused,
    isEncoding,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
  }
}
