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

// Generates a 100% valid standard 16-bit Mono PCM RIFF WAV Blob
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')

  // fmt sub-chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true) // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * 2, true) // ByteRate (SampleRate * 1 * 2)
  view.setUint16(32, 2, true) // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true) // BitsPerSample (16-bit)

  // data sub-chunk
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // Write 16-bit linear PCM samples
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    const val = s < 0 ? s * 0x8000 : s * 0x7fff
    view.setInt16(offset, val, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export function useAudioRecorder({
  onPhraseRecorded,
  onSpeechDetected,
}: UseAudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)

  // Full recording refs (for MP3 file saving)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Web Audio VAD + PCM streaming refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const muteGainRef = useRef<GainNode | null>(null)

  // VAD & Phrase accumulation state
  const isSpeakingRef = useRef<boolean>(false)
  const speechStartTimeRef = useRef<number>(0)
  const lastSpeechTimeRef = useRef<number>(0)
  const phrasePcmChunksRef = useRef<Float32Array[]>([])
  const preRollRingBufferRef = useRef<Float32Array[]>([]) // Keeps last ~0.75s to avoid clipping first syllable
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

  const cleanupWebAudio = useCallback(() => {
    if (scriptNodeRef.current) {
      try { scriptNodeRef.current.disconnect() } catch { /* ignore */ }
      scriptNodeRef.current.onaudioprocess = null
      scriptNodeRef.current = null
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect() } catch { /* ignore */ }
      sourceNodeRef.current = null
    }
    if (muteGainRef.current) {
      try { muteGainRef.current.disconnect() } catch { /* ignore */ }
      muteGainRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    phrasePcmChunksRef.current = []
    preRollRingBufferRef.current = []
    isSpeakingRef.current = false
    speechStartTimeRef.current = 0
    lastSpeechTimeRef.current = 0
  }, [])

  const emitCurrentPhrase = useCallback(() => {
    const chunks = phrasePcmChunksRef.current
    phrasePcmChunksRef.current = []

    if (chunks.length === 0) return

    let totalLength = 0
    for (const c of chunks) totalLength += c.length
    if (totalLength < 16000 * 0.35) return // Ignore under 350ms of audio

    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.length
    }

    // Always 16kHz mono WAV for Google Gemini API
    const sampleRate = audioCtxRef.current?.sampleRate || 16000
    const wavBlob = encodeWav(merged, sampleRate)

    onPhraseRecordedRef.current?.(wavBlob, 'audio/wav')
  }, [])

  const startRecording = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
      cleanupWebAudio()

      audioChunksRef.current = []
      phrasePcmChunksRef.current = []
      preRollRingBufferRef.current = []
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

      // ── 1. Setup Web Audio API with 16kHz PCM VAD ──
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        // Aim for 16kHz context directly, or fallback to default sampleRate
        let ctx: AudioContext
        try {
          ctx = new AudioContextClass({ sampleRate: 16000 })
        } catch {
          ctx = new AudioContextClass()
        }

        if (ctx.state === 'suspended') {
          await ctx.resume()
        }

        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        sourceNodeRef.current = source

        // Buffer size 4096 gives ~256ms per slice at 16kHz, ~92ms at 44.1kHz
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        scriptNodeRef.current = processor

        // Mute gain node connected to destination prevents garbage collection
        const muteGain = ctx.createGain()
        muteGain.gain.value = 0
        muteGainRef.current = muteGain

        source.connect(processor)
        processor.connect(muteGain)
        muteGain.connect(ctx.destination)

        processor.onaudioprocess = (e) => {
          if (!isRecordingRef.current || isPausedRef.current) return

          const inputData = e.inputBuffer.getChannelData(0)
          const pcmChunk = new Float32Array(inputData)

          // Calculate RMS (energy)
          let sumSquares = 0
          let peak = 0
          for (let i = 0; i < pcmChunk.length; i++) {
            const val = Math.abs(pcmChunk[i])
            if (val > peak) peak = val
            sumSquares += pcmChunk[i] * pcmChunk[i]
          }
          const rms = Math.sqrt(sumSquares / pcmChunk.length)

          // Voice detection criteria: RMS >= 0.010 OR peak >= 0.045
          const isVoice = rms >= 0.010 || peak >= 0.045
          const now = Date.now()

          // Maintain pre-roll buffer (last 3 chunks, ~0.75s)
          const preRoll = preRollRingBufferRef.current
          preRoll.push(pcmChunk)
          if (preRoll.length > 3) preRoll.shift()

          if (isVoice) {
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true
              speechStartTimeRef.current = now
              onSpeechDetectedRef.current?.(true)

              // Prepend pre-roll buffers to preserve the starting consonant/syllable
              for (const pr of preRoll) {
                phrasePcmChunksRef.current.push(pr)
              }
            }
            lastSpeechTimeRef.current = now
            phrasePcmChunksRef.current.push(pcmChunk)

            // Split long continuous speech at 6.5s
            if (now - speechStartTimeRef.current > 6500) {
              emitCurrentPhrase()
              speechStartTimeRef.current = now
            }
          } else {
            if (isSpeakingRef.current) {
              // Still in speech pause window: collect chunk
              phrasePcmChunksRef.current.push(pcmChunk)

              // Silence threshold: 750ms of silence marks phrase end
              if (now - lastSpeechTimeRef.current >= 750) {
                const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current
                if (speechDuration >= 350) {
                  emitCurrentPhrase()
                } else {
                  phrasePcmChunksRef.current = []
                }
                isSpeakingRef.current = false
                speechStartTimeRef.current = 0
                onSpeechDetectedRef.current?.(false)
              }
            }
          }
        }
      } catch (audioErr) {
        console.warn('Web Audio VAD initialization warning:', audioErr)
      }

      // ── 2. Setup MediaRecorder for Full MP3 Saving ──
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

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      startTimeRef.current = Date.now()
      lastResumeTimeRef.current = Date.now()
      isRecordingRef.current = true
      isPausedRef.current = false
      setIsRecording(true)
      setIsPaused(false)
    } catch (err) {
      console.error('Failed to start audio recording:', err)
      cleanupWebAudio()
      throw err
    }
  }, [cleanupWebAudio, emitCurrentPhrase])

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend().catch(() => {})
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      accumulatedDurationRef.current += Date.now() - lastResumeTimeRef.current
      setIsPaused(true)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
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

    // Flush any pending phrase before stopping
    if (isSpeakingRef.current && phrasePcmChunksRef.current.length > 0) {
      emitCurrentPhrase()
    }
    cleanupWebAudio()

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
  }, [cleanupWebAudio, emitCurrentPhrase])

  const discardRecording = useCallback(() => {
    isRecordingRef.current = false
    isPausedRef.current = false
    cleanupWebAudio()
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
  }, [cleanupWebAudio])

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
