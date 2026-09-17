import React, { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Music,
  RotateCcw,
  Calendar,
  Languages,
} from 'lucide-react'

interface AudioPlayerModalProps {
  isOpen: boolean
  filename: string
  audioUrl: string
  sourceLang?: string
  targetLang?: string
  createdAt?: string
  onClose: () => void
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  isOpen,
  filename,
  audioUrl,
  sourceLang,
  targetLang,
  createdAt,
  onClose,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    if (isOpen && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [isOpen, audioUrl])

  if (!isOpen) return null

  const handlePlayPause = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) {
      audioRef.current.volume = val
      setIsMuted(val === 0)
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    if (isMuted) {
      audioRef.current.muted = false
      setIsMuted(false)
    } else {
      audioRef.current.muted = true
      setIsMuted(true)
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00'
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col">
        {/* Hidden HTML5 audio element */}
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Music className="w-5 h-5" />
            </div>
            <div className="truncate max-w-[280px]">
              <h3 className="text-base font-bold text-slate-800 truncate">
                {filename}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                {createdAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(createdAt).toLocaleDateString('ko-KR')}
                  </span>
                )}
                {sourceLang && (
                  <span className="flex items-center gap-1">
                    <Languages className="w-3 h-3" />
                    {sourceLang} {targetLang ? `→ ${targetLang}` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.pause()
              onClose()
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Controls Body */}
        <div className="p-6 space-y-5">
          {/* Waveform Visualization Placeholder / Graphic */}
          <div className="h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center gap-1 px-4">
            {[40, 60, 25, 80, 50, 90, 70, 30, 85, 45, 65, 35, 95, 75, 40, 55, 85, 60, 30, 70, 50].map(
              (height, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    isPlaying
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-300'
                  }`}
                  style={{
                    height: `${isPlaying ? height : Math.max(20, height * 0.4)}%`,
                    animationDelay: `${idx * 50}ms`,
                  }}
                />
              )
            )}
          </div>

          {/* Seeker Slider */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls Row */}
          <div className="flex items-center justify-between">
            {/* Rewind to start */}
            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = 0
              }}
              title="처음으로"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play/Pause Main Button */}
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-full flex items-center justify-center shadow-md shadow-emerald-200 transition cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.pause()
              onClose()
            }}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
