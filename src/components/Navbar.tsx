import React from 'react'
import { Languages, LogOut, Radio, UserCheck } from 'lucide-react'

interface NavbarProps {
  isListening: boolean
  isPaused: boolean
  totalSentences: number
  onLogout: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  isListening,
  isPaused,
  totalSentences,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                AI 실시간 음성인식 & 자막 번역기
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden md:block">
              Web Speech API 실시간 음성인식(STT) 및 인공지능 동시통역 시스템
            </p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-3">
          {/* Real-time Status Badge */}
          {isListening && !isPaused && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">실시간 음성 수신 중</span>
              <span className="sm:hidden">수신중</span>
            </div>
          )}

          {isListening && isPaused && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>일시정지됨</span>
            </div>
          )}

          {!isListening && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-600">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>대기 중</span>
            </div>
          )}

          {/* Sentence Count */}
          <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium">
            <span>자막 기록:</span>
            <strong className="text-slate-900 font-bold">{totalSentences}</strong>
            <span>문장</span>
          </div>

          {/* Admin & Logout Button */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-700 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>admin</span>
            </div>
            <button
              onClick={onLogout}
              title="관리자 로그아웃"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
