import React, { useState, useEffect, useRef } from 'react'
import {
  Database,
  RefreshCw,
  Search,
  Music,
  FileCode,
  FileText,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Clock,
  HardDrive,
  FolderOpen,
} from 'lucide-react'
import type { NeonArchiveRecord } from '../types'

interface FileExplorerSidebarProps {
  records: NeonArchiveRecord[]
  isLoading: boolean
  onRefresh: () => void
  onDoubleClickFile: (record: NeonArchiveRecord) => void
  onSaveAsFile: (record: NeonArchiveRecord) => void
  onDeleteFile?: (record: NeonArchiveRecord) => void
}

export const FileExplorerSidebar: React.FC<FileExplorerSidebarProps> = ({
  records,
  isLoading,
  onRefresh,
  onDoubleClickFile,
  onSaveAsFile,
  onDeleteFile,
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'audio_mp3' | 'html' | 'txt'>('all')

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    record: NeonArchiveRecord | null
  }>({
    visible: false,
    x: 0,
    y: 0,
    record: null,
  })

  const contextMenuRef = useRef<HTMLDivElement | null>(null)

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu({ visible: false, x: 0, y: 0, record: null })
      }
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  const handleContextMenu = (
    e: React.MouseEvent,
    record: NeonArchiveRecord
  ) => {
    e.preventDefault()
    // Position menu within screen bounds
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 150)
    setContextMenu({
      visible: true,
      x,
      y,
      record,
    })
  }

  // Filter and search records
  const filteredRecords = records.filter((rec) => {
    const matchesType = filterType === 'all' || rec.record_type === filterType
    const matchesSearch =
      rec.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.source_lang && rec.source_lang.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesType && matchesSearch
  })

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'audio_mp3':
        return <Music className="w-4 h-4 text-emerald-600" />
      case 'html':
        return <FileCode className="w-4 h-4 text-indigo-600" />
      case 'txt':
        return <FileText className="w-4 h-4 text-blue-600" />
      default:
        return <HardDrive className="w-4 h-4 text-slate-500" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'audio_mp3':
        return 'MP3'
      case 'html':
        return 'HTML'
      case 'txt':
        return 'TXT'
      default:
        return type.toUpperCase()
    }
  }

  const formatFileSize = (length?: number) => {
    if (!length) return ''
    if (length > 1024 * 1024) {
      return `${(length / (1024 * 1024)).toFixed(1)} MB`
    }
    return `${Math.round(length / 1024)} KB`
  }

  return (
    <>
      {/* Sidebar Container */}
      <aside
        className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-30 shrink-0 select-none ${
          isOpen ? 'w-72 sm:w-80' : 'w-12'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          {isOpen ? (
            <div className="flex items-center gap-2 truncate">
              <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
                <Database className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="font-bold text-xs text-slate-800 tracking-tight flex items-center gap-1.5">
                  Neon DB 저장소
                  <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full font-mono">
                    {records.length}
                  </span>
                </span>
                <p className="text-[10px] text-slate-400 truncate">
                  더블클릭 실행 • 우클릭 다른이름 저장
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto text-indigo-600" title="Neon DB 저장소">
              <Database className="w-5 h-5" />
            </div>
          )}

          <div className="flex items-center gap-1">
            {isOpen && (
              <button
                type="button"
                onClick={onRefresh}
                title="목록 새로고침"
                disabled={isLoading}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              title={isOpen ? '사이드바 접기' : '사이드바 펼치기'}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <>
            {/* Search & Filter Bar */}
            <div className="p-2.5 border-b border-slate-100 space-y-2 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="파일 검색..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-600">
                {(
                  [
                    { id: 'all', label: '전체' },
                    { id: 'audio_mp3', label: 'MP3' },
                    { id: 'html', label: 'HTML' },
                    { id: 'txt', label: 'TXT' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`py-1 rounded-md transition text-center cursor-pointer ${
                      filterType === tab.id
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Records List Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-50">
              {isLoading && records.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                  <span>Neon DB 목록 로딩 중...</span>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <FolderOpen className="w-8 h-8 text-slate-300 stroke-1" />
                  <span>저장된 파일이 없습니다.</span>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    onDoubleClick={() => onDoubleClickFile(record)}
                    onContextMenu={(e) => handleContextMenu(e, record)}
                    title={`[더블클릭]: 열기/재생\n[우클릭]: 다른 이름으로 저장\n${record.filename}`}
                    className="p-2 rounded-xl hover:bg-slate-100/80 active:bg-indigo-50 transition cursor-pointer flex items-start gap-2.5 group relative"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-white transition shrink-0 mt-0.5">
                      {getFileIcon(record.record_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition">
                          {record.filename}
                        </span>
                        <span className="px-1.5 py-0.2 text-[10px] font-mono font-medium rounded-sm bg-slate-100 text-slate-600 shrink-0">
                          {getTypeLabel(record.record_type)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(record.created_at).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </span>
                        {record.sentence_count > 0 && (
                          <span>• {record.sentence_count}문장</span>
                        )}
                        {record.audio_length ? (
                          <span>• {formatFileSize(record.audio_length)}</span>
                        ) : record.content_length ? (
                          <span>• {formatFileSize(record.content_length)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar Footer Hint */}
            <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-center">
              💡 마우스 <b>더블클릭</b>으로 재생/열기, <b>우클릭</b>으로 원하는 폴더에 저장
            </div>
          </>
        )}
      </aside>

      {/* Right Click Context Menu */}
      {contextMenu.visible && contextMenu.record && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 w-48 text-xs font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] text-slate-400 font-mono truncate">
            {contextMenu.record.filename}
          </div>

          {/* Action 1: Open / Play (Double-click equivalent) */}
          <button
            onClick={() => {
              if (contextMenu.record) onDoubleClickFile(contextMenu.record)
              setContextMenu({ visible: false, x: 0, y: 0, record: null })
            }}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-slate-800 transition text-left cursor-pointer"
          >
            {contextMenu.record.record_type === 'audio_mp3' ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span>음성 재생 (더블클릭)</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>열기 (더블클릭)</span>
              </>
            )}
          </button>

          {/* Action 2: Save As (Requested Feature) */}
          <button
            onClick={() => {
              if (contextMenu.record) onSaveAsFile(contextMenu.record)
              setContextMenu({ visible: false, x: 0, y: 0, record: null })
            }}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 font-semibold transition text-left cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>다른 이름으로 저장...</span>
          </button>

          {/* Action 3: Delete (Optional convenience) */}
          {onDeleteFile && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => {
                  if (contextMenu.record && onDeleteFile) {
                    onDeleteFile(contextMenu.record)
                  }
                  setContextMenu({ visible: false, x: 0, y: 0, record: null })
                }}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-rose-50 text-rose-600 transition text-left cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Neon DB에서 삭제</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
