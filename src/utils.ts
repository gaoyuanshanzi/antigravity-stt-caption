import type { SubtitleItem, Language, SaveRecordPayload } from './types'

export function getFormattedDateTime(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

export function triggerDownload(
  content: string | Blob,
  filename: string,
  mimeType: string = 'text/plain'
) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function saveRecordToNeon(payload: SaveRecordPayload): Promise<{
  success: boolean
  message: string
  record?: any
}> {
  const response = await fetch('/api/save-record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Neon DB 저장 실패 (${response.status})`)
  }
  return data
}

export function generateHtmlContent(
  items: SubtitleItem[],
  sourceLang: Language,
  targetLang: Language
): { html: string; filename: string } {
  const timestampStr = new Date().toLocaleString('ko-KR', {
    dateStyle: 'full',
    timeStyle: 'medium',
  })
  const filename = `stt_transcript_${getFormattedDateTime()}.html`


  const rows = items
    .map(
      (item, idx) => `
      <tr class="item-row">
        <td class="idx-col">${idx + 1}</td>
        <td class="time-col">${item.timestamp}</td>
        <td class="source-col">
          <div class="lang-tag source-tag">${sourceLang.flag} ${sourceLang.name}</div>
          <div class="text-content">${escapeHtml(item.sourceText)}</div>
        </td>
        <td class="target-col">
          <div class="lang-tag target-tag">${targetLang.flag} ${targetLang.name}</div>
          <div class="text-content ${item.status === 'error' ? 'error-text' : ''}">
            ${escapeHtml(item.translatedText || '(번역 대기 중)')}
          </div>
        </td>
      </tr>
    `
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>실시간 음성 인식 & 자막 번역 기록 (${timestampStr})</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #1e293b;
      --muted: #64748b;
      --border: #e2e8f0;
      --primary: #4f46e5;
      --primary-light: #eef2ff;
      --source-bg: #f8fafc;
      --target-bg: #f0fdf4;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 20px;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      padding: 36px 32px;
    }
    .header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .title {
      font-size: 26px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      background: #f1f5f9;
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 14px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-weight: 600;
      color: #1e293b;
      margin-top: 2px;
    }
    .table-wrapper {
      overflow-x: auto;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-size: 13px;
      font-weight: 700;
      padding: 12px 16px;
      border-bottom: 2px solid var(--border);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .item-row:hover {
      background-color: #f8fafc;
    }
    .idx-col {
      width: 45px;
      text-align: center;
      color: var(--muted);
      font-weight: 600;
      font-size: 13px;
    }
    .time-col {
      width: 90px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      white-space: nowrap;
    }
    .source-col {
      width: 44%;
    }
    .target-col {
      width: 44%;
    }
    .lang-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      margin-bottom: 6px;
    }
    .source-tag {
      background: #e2e8f0;
      color: #334155;
    }
    .target-tag {
      background: #dcfce7;
      color: #166534;
    }
    .text-content {
      font-size: 15px;
      color: #0f172a;
      line-height: 1.5;
    }
    .error-text {
      color: #dc2626;
      font-style: italic;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">
        🎙️ 실시간 음성 인식 & 자막 번역 기록
      </div>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">생성 일시</span>
          <span class="meta-value">${timestampStr}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">출발어 (Source)</span>
          <span class="meta-value">${sourceLang.flag} ${sourceLang.name} (${sourceLang.code})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">도착어 (Target)</span>
          <span class="meta-value">${targetLang.flag} ${targetLang.name} (${targetLang.code})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">총 문장 수</span>
          <span class="meta-value">${items.length}개 문장</span>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="idx-col">#</th>
            <th class="time-col">시간</th>
            <th class="source-col">발화 원문 (${sourceLang.name})</th>
            <th class="target-col">번역 자막 (${targetLang.name})</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : `<tr><td colspan="4" style="text-align:center; padding: 32px; color: #94a3b8;">기록된 자막 문장이 없습니다.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="footer">
      AI Real-Time Multilingual Speech-to-Text & Subtitle Translation Archive • Generated with Google Gemini
    </div>
  </div>
</body>
</html>`

  return { html, filename }
}

export function exportToHtml(
  items: SubtitleItem[],
  sourceLang: Language,
  targetLang: Language
) {
  const { html, filename } = generateHtmlContent(items, sourceLang, targetLang)
  triggerDownload(html, filename, 'text/html')
}

export function generateTxtContent(
  items: SubtitleItem[],
  sourceLang: Language,
  targetLang: Language
): { text: string; filename: string } {
  const timestampStr = new Date().toLocaleString('ko-KR')
  const filename = `stt_transcript_${getFormattedDateTime()}.txt`

  let text = `=================================================================\n`
  text += ` 실시간 음성 인식 & 자막 번역 기록\n`
  text += ` 일시: ${timestampStr}\n`
  text += ` 출발어: ${sourceLang.name} (${sourceLang.code})\n`
  text += ` 도착어: ${targetLang.name} (${targetLang.code})\n`
  text += ` 총 문장 수: ${items.length}개\n`
  text += `=================================================================\n\n`

  items.forEach((item, index) => {
    text += `[${item.timestamp}] [${index + 1}] [원문 (${sourceLang.code})]: ${item.sourceText}\n`
    text += `[${item.timestamp}] [${index + 1}] [번역 (${targetLang.code})]: ${item.translatedText || '(번역 대기 중)'}\n\n`
  })

  return { text, filename }
}

export function exportToTxt(
  items: SubtitleItem[],
  sourceLang: Language,
  targetLang: Language
) {
  const { text, filename } = generateTxtContent(items, sourceLang, targetLang)
  triggerDownload(text, filename, 'text/plain')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
