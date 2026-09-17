import React, { useState } from 'react'
import {
  FileText,
  FileCode,
  Music,
  Database,
  Download,
  Layers,
  X,
  Loader2,
  Check,
} from 'lucide-react'
import type { SaveFileType, SaveDestination } from '../types'

interface SaveModalProps {
  isOpen: boolean
  fileType: SaveFileType
  filename: string
  detailInfo?: string
  isSaving?: boolean
  onConfirm: (destination: SaveDestination) => void
  onClose: () => void
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  fileType,
  filename,
  detailInfo,
  isSaving = false,
  onConfirm,
  onClose,
}) => {
  const [selectedDest, setSelectedDest] = useState<SaveDestination>('both')

  if (!isOpen) return null

  const getModalMeta = () => {
    switch (fileType) {
      case 'mp3':
        return {
          title: '녹음된 음성(MP3) 저장',
          subTitle:
            '음성인식이 종료되었습니다. 녹음된 MP3 음성 파일을 저장하시겠습니까?',
          icon: <Music className="w-6 h-6 text-emerald-600" />,
          bgColor: 'bg-emerald-50 text-emerald-700',
          badgeText: 'MP3 오디오 (128 kbps)',
        }
      case 'html':
        return {
          title: 'HTML 자막 기록 내보내기',
          subTitle: '실시간 전사 및 번역 자막을 HTML 형식으로 저장합니다.',
          icon: <FileCode className="w-6 h-6 text-indigo-600" />,
          bgColor: 'bg-indigo-50 text-indigo-700',
          badgeText: '웹 브라우저 뷰어 HTML',
        }
      case 'txt':
        return {
          title: 'TXT 자막 기록 저장',
          subTitle: '타임스탬프와 원문/번역문이 포함된 텍스트 파일로 저장합니다.',
          icon: <FileText className="w-6 h-6 text-blue-600" />,
          bgColor: 'bg-blue-50 text-blue-700',
          badgeText: '일반 텍스트 문서 TXT',
        }
    }
  }

  const meta = getModalMeta()

  const handleExecuteSave = (destination: SaveDestination) => {
    onConfirm(destination)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${meta.bgColor}`}>
              {meta.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {meta.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                저장할 위치를 선택해 주세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* File Meta Pill */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">파일명</span>
              <span className="font-mono text-slate-700 truncate max-w-[220px]">
                {filename}
              </span>
            </div>
            {detailInfo && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">정보</span>
                <span className="text-slate-600 font-medium">
                  {detailInfo} • {meta.badgeText}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            저장 방식 선택
          </p>

          {/* Options Selection */}
          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. Both Option (Recommended) */}
            <button
              type="button"
              onClick={() => setSelectedDest('both')}
              disabled={isSaving}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition cursor-pointer ${
                selectedDest === 'both'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  selectedDest === 'both'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">
                    둘 다 동시 저장 (추천)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full">
                    Neon DB + 로컬
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Neon 클라우드 DB에 백업함과 동시에 내 PC 다운로드 폴더에 저장합니다.
                </p>
              </div>
            </button>

            {/* 2. Neon DB Only */}
            <button
              type="button"
              onClick={() => setSelectedDest('neon')}
              disabled={isSaving}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition cursor-pointer ${
                selectedDest === 'neon'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  selectedDest === 'neon'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Database className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">
                    Neon.tech DB에만 저장
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">
                    클라우드 DB
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Neon PostgreSQL 데이터베이스의 <code className="text-indigo-600 font-mono">captions_archive</code> 테이블에 저장합니다.
                </p>
              </div>
            </button>

            {/* 3. Local Download Only */}
            <button
              type="button"
              onClick={() => setSelectedDest('local')}
              disabled={isSaving}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition cursor-pointer ${
                selectedDest === 'local'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  selectedDest === 'local'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Download className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">
                    로컬 다운로드만 저장
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">
                    PC 다운로드
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  브라우저의 기본 다운로드 폴더로 파일({fileType.toUpperCase()})을 직접 내려받습니다.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            {fileType === 'mp3' ? '저장 안 함 (취소)' : '취소'}
          </button>

          <button
            type="button"
            onClick={() => handleExecuteSave(selectedDest)}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold rounded-xl text-xs shadow-sm hover:shadow-indigo-100 transition cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>선택한 방식으로 저장하기</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
