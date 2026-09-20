import { useState, useRef, useCallback } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs'

interface AudioRecordResult {
  blob: Blob
  durationSeconds: number
  filename: string
}

interface UseAudioRecorderProps {
  onPhraseRecorded?: (phraseBlob: Blob) => void
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

// Encode raw 16kHz mono Float32 audio samples into standard RIFF 16-bit PCM WAV
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')

  // fmt subchunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true) // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * 2, true) // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true) // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true) // BitsPerSample (16-bit)

  // data subchunk
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

// Downsample audio buffer to 16,000 Hz for optimal Gemini STT performance
function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number = 16000
): Float32Array {
  if (outputSampleRate >= inputSampleRate) return buffer
  const ratio = inputSampleRate / outputSampleRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

export function useAudioRecorder({
  onPhraseRecorded,
  onSpeechDetected,
}: UseAudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const isRecordingRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Web Audio VAD and PCM streaming refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const phrasePcmBuffersRef = useRef<Float32Array[]>([])
  const preRollPcmBuffersRef = useRef<Float32Array[]>([])

  const isSpeakingRef = useRef<boolean>(false)
  const speechStartTimeRef = useRef<number>(0)
  const lastSpeechTimeRef = useRef<number>(0)

  const startTimeRef = useRef<number>(0)
  const accumulatedDurationRef = useRef<number>(0)
  const lastResumeTimeRef = useRef<number>(0)

  const onPhraseRecordedRef = useRef(onPhraseRecorded)
  onPhraseRecordedRef.current = onPhraseRecorded
  const onSpeechDetectedRef = useRef(onSpeechDetected)
  onSpeechDetectedRef.current = onSpeechDetected

  const cleanupVad = useCallback(() => {
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect()
      } catch {
        // ignore
      }
      scriptProcessorRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    phrasePcmBuffersRef.current = []
    preRollPcmBuffersRef.current = []
    isSpeakingRef.current = false
    speechStartTimeRef.current = 0
    lastSpeechTimeRef.current = 0
  }, [])

  const emitCurrentPhrase = useCallback(() => {
    if (phrasePcmBuffersRef.current.length === 0) return
    let totalLen = 0
    for (const b of phrasePcmBuffersRef.current) {
      totalLen += b.length
    }
    if (totalLen === 0) return

    const merged = new Float32Array(totalLen)
    let offset = 0
    for (const b of phrasePcmBuffersRef.current) {
      merged.set(b, offset)
      offset += b.length
    }
    phrasePcmBuffersRef.current = []

    const wavBlob = encodeWav(merged, 16000)
    onPhraseRecordedRef.current?.(wavBlob)
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Release any previous stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
      cleanupVad()

      audioChunksRef.current = []
      phrasePcmBuffersRef.current = []
      preRollPcmBuffersRef.current = []
      accumulatedDurationRef.current = 0
      isSpeakingRef.current = false
      speechStartTimeRef.current = 0
      lastSpeechTimeRef.current = 0

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2, // Stereo requested if supported by hardware
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      // Pick supported mime type for MediaRecorder MP3 workflow
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]
      let selectedMimeType = ''
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime
          break
        }
      }

      // Initialize Web Audio PCM processor for VAD & Real-time phrase STT
      try {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext
        const audioCtx = new AudioContextClass()
        audioCtxRef.current = audioCtx

        const source = audioCtx.createMediaStreamSource(stream)
        // 4096 sample buffer (~85ms chunks at 48kHz)
        const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1)
        const silentGain = audioCtx.createGain()
        silentGain.gain.value = 0

        source.connect(scriptNode)
        scriptNode.connect(silentGain)
        silentGain.connect(audioCtx.destination)
        scriptProcessorRef.current = scriptNode

        scriptNode.onaudioprocess = (event) => {
          if (!isRecordingRef.current || isPausedRef.current) return

          const inputData = event.inputBuffer.getChannelData(0)
          const downsampled = downsampleBuffer(
            inputData,
            audioCtx.sampleRate,
            16000
          )

          // RMS Energy Calculation
          let sumSquare = 0
          for (let i = 0; i < downsampled.length; i++) {
            sumSquare += downsampled[i] * downsampled[i]
          }
          const rms = Math.sqrt(sumSquare / downsampled.length)
          const now = Date.now()
          const isVoice = rms >= 0.012

          if (isVoice) {
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true
              speechStartTimeRef.current = now
              onSpeechDetectedRef.current?.(true)

              // Prepend pre-roll buffer to retain initial syllable
              for (const prev of preRollPcmBuffersRef.current) {
                phrasePcmBuffersRef.current.push(prev)
              }
              preRollPcmBuffersRef.current = []
            }
            lastSpeechTimeRef.current = now
            phrasePcmBuffersRef.current.push(new Float32Array(downsampled))

            // Long utterance guard (continuous speech > 6.5s)
            if (now - speechStartTimeRef.current > 6500) {
              emitCurrentPhrase()
              speechStartTimeRef.current = now
            }
          } else {
            // Silence
            if (isSpeakingRef.current) {
              phrasePcmBuffersRef.current.push(new Float32Array(downsampled))
              // If silence pause has lasted for >= 750ms
              if (now - lastSpeechTimeRef.current >= 750) {
                const speechDuration =
                  lastSpeechTimeRef.current - speechStartTimeRef.current
                if (speechDuration >= 350) {
                  emitCurrentPhrase()
                } else {
                  phrasePcmBuffersRef.current = []
                }
                isSpeakingRef.current = false
                speechStartTimeRef.current = 0
                onSpeechDetectedRef.current?.(false)
              }
            } else {
              // Maintain rolling pre-roll buffer (~300ms)
              preRollPcmBuffersRef.current.push(new Float32Array(downsampled))
              if (preRollPcmBuffersRef.current.length > 3) {
                preRollPcmBuffersRef.current.shift()
              }
            }
          }
        }
      } catch (vadErr) {
        console.warn('Web Audio VAD initialization skipped:', vadErr)
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start(500) // Collect chunks every 500ms
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
  }, [cleanupVad, emitCurrentPhrase])

  // Pause recording
  const pauseRecording = useCallback(() => {
    isPausedRef.current = true
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.pause()
      accumulatedDurationRef.current += Date.now() - lastResumeTimeRef.current
      setIsPaused(true)
    }
  }, [])

  // Resume recording
  const resumeRecording = useCallback(() => {
    isPausedRef.current = false
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'paused'
    ) {
      mediaRecorderRef.current.resume()
      lastResumeTimeRef.current = Date.now()
      setIsPaused(false)
    }
  }, [])

  // Stop recording and encode to MP3 (128 kbps stereo/mono)
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
          // Stop all stream tracks to turn off mic indicator
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

          // Decode raw audio into AudioBuffer using Web Audio API
          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext
          const audioCtx = new AudioContextClass()
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

          const channels = Math.min(audioBuffer.numberOfChannels, 2)
          const sampleRate = audioBuffer.sampleRate
          const kbps = 128 // 128 kbps requested by user

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
              if (mp3buf.length > 0) {
                mp3Chunks.push(new Uint8Array(mp3buf))
              }
            }
          } else {
            const monoData = floatToInt16(audioBuffer.getChannelData(0))
            for (let i = 0; i < monoData.length; i += sampleBlockSize) {
              const chunk = monoData.subarray(i, i + sampleBlockSize)
              const mp3buf = encoder.encodeBuffer(chunk)
              if (mp3buf.length > 0) {
                mp3Chunks.push(new Uint8Array(mp3buf))
              }
            }
          }

          const flushBuf = encoder.flush()
          if (flushBuf.length > 0) {
            mp3Chunks.push(new Uint8Array(flushBuf))
          }

          const mp3Blob = new Blob(mp3Chunks as BlobPart[], { type: 'audio/mp3' })
          const filename = `stt_audio_${getFormattedDateTime()}.mp3`

          // Close audio context
          if (audioCtx.state !== 'closed') {
            await audioCtx.close().catch(() => {})
          }

          resolve({
            blob: mp3Blob,
            durationSeconds: finalDurationSec,
            filename,
          })
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
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {
        // ignore
      }
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
