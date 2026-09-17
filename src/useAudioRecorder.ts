import { useState, useRef, useCallback } from 'react'
import lamejs from 'lamejs'

interface AudioRecordResult {
  blob: Blob
  durationSeconds: number
  filename: string
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

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const accumulatedDurationRef = useRef<number>(0)
  const lastResumeTimeRef = useRef<number>(0)

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Release any previous stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }

      audioChunksRef.current = []
      accumulatedDurationRef.current = 0

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2, // Stereo requested if supported by hardware
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      // Pick supported mime type
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
      setIsRecording(true)
      setIsPaused(false)
    } catch (err) {
      console.error('Failed to start audio recording:', err)
      throw err
    }
  }, [])

  // Pause recording
  const pauseRecording = useCallback(() => {
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

          const Mp3Encoder =
            (lamejs as any).Mp3Encoder ||
            (lamejs as any).default?.Mp3Encoder

          if (!Mp3Encoder) {
            throw new Error('MP3 인코더 모듈을 로드할 수 없습니다.')
          }

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
  }, [])

  const discardRecording = useCallback(() => {
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
  }, [])

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
