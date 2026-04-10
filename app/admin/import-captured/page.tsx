'use client'

import { useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import { runImport, summarizeImportResponse, collectImportMessages } from '@/lib/ingestion/runImport'
import { supabase } from '@/lib/supabase'

export default function ImportCapturedPage() {


  const [jsonInput, setJsonInput] = useState('')
  const [importType, setImportType] = useState<'schedule' | 'scorecard'>('schedule')
  const [mode, setMode] = useState<'preview' | 'commit'>('preview')

  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<string[]>([])

  async function handleRunImport() {
    setMessages([])

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonInput)
    } catch {
      setMessages(['❌ Invalid JSON'])
      return
    }

    setLoading(true)

    const response = await runImport(supabase, {
      kind: importType,
      payload: parsed,
      mode,
      engineOptions: {
        hasNormalizedPlayerNameColumn: true,
        matchPlayersDeleteBeforeInsert: true,
        scorecardLinesTable: null,
      },
    })

    const summary = summarizeImportResponse(response)
    const lines = collectImportMessages(response)

    setMessages([
      `=== IMPORT SUMMARY ===`,
      `Type: ${summary.kind}`,
      `Mode: ${summary.mode}`,
      `Rows: ${summary.normalizedRowCount}`,
      `Imported: ${summary.successCount}`,
      `Updated: ${summary.updatedCount}`,
      `Failed: ${summary.failedCount}`,
      ...(summary.kind === 'scorecard'
        ? [
            `Players Created: ${summary.createdPlayersCount}`,
            `Players Linked: ${summary.linkedPlayersCount}`,
          ]
        : []),
      '',
      ...lines,
    ])

    setLoading(false)
  }

  return (
    <SiteShell active="/admin">
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '20px',
        }}
      >
        <h1 className="page-title">Captured JSON Import</h1>
        <p className="page-subtitle">
          Paste schedule or scorecard JSON from your capture tool and import into TenAceIQ.
        </p>

        {/* Controls */}
        <div
          className="surface-card"
          style={{ padding: 16, marginTop: 20 }}
        >
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as any)}
            >
              <option value="schedule">Schedule</option>
              <option value="scorecard">Scorecard</option>
            </select>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="preview">Preview</option>
              <option value="commit">Commit</option>
            </select>

            <button
              onClick={handleRunImport}
              disabled={loading}
              className="button-primary"
            >
              {loading ? 'Running...' : 'Run Import'}
            </button>
          </div>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste captured JSON here..."
            style={{
              width: '100%',
              minHeight: 240,
              marginTop: 14,
              padding: 12,
              background: '#0B1628',
              color: '#E6EEF8',
              border: '1px solid rgba(116,190,255,0.2)',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          />
        </div>

        {/* Output */}
        {messages.length > 0 && (
          <div
            className="surface-card"
            style={{
              marginTop: 20,
              padding: 16,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {messages.join('\n')}
          </div>
        )}
      </section>
    </SiteShell>
  )
}