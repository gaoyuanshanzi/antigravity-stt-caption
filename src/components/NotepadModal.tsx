import React, { useState } from 'react'
import {
  FileText,
  X,
  Copy,
  Check,
  Download,
  Calendar,
} from 'lucide-react'

interface NotepadModalProps {
  isOpen: boolean
  filename: string
  content: string
  createdAt?: string
  sentenceCount?: number
  onClose: () => void
  onSaveAs: () => void
}

export const NotepadModal: React.FC<NotepadModalProps> = ({
  isOpen,
  filename,
  content,
  createdAt,
  sentenceCount,
  onClose,
  onSaveAs,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = content.split('\n')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full h-[75vh] border border-slate-200 overflow-hidden flex flex-col">
        {/* Window Title Bar (Notepad style) */}
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-slate-700 font-medium text-xs sm:text-sm truncate max-w-[400px]">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">
              {filename}
            </span>
            <span className="text-slate-400 text-xs hidden sm:inline">- 메모장 뷰어</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              title="텍스트 복사"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onSaveAs}
              title="다른 이름으로 저장"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="닫기"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Text Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 font-mono text-xs sm:text-sm text-slate-800 bg-white leading-relaxed whitespace-pre-wrap select-text">
          {content || '(내용이 없습니다.)'}
        </div>

        {/* Status Bar */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            {createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(createdAt).toLocaleString('ko-KR')}
              </span>
            )}
            {sentenceCount !== undefined && (
              <span>문장 수: {sentenceCount}개</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>줄 수: {lines.length}</span>
            <span>글자 수: {content.length}자</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>
    </div>
  )
}
