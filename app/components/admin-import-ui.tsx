
'use client'

import * as React from 'react'

export type AdminImportMetric = {
  label: string
  value: string | number
}

export type AdminImportInvalidRow = {
  sourceIndex: number
  raw: string
  reason: string
}

export type AdminImportPreviewRow = {
  sourceIndex: number
  sideA: string[]
  sideB: string[]
  rawResult: string
  score: string
  winnerSide: string
  date: string
  matchType: string
  status: 'ready' | 'duplicate_in_file' | 'duplicate_in_db'
  reason: string
  dedupeKey: string
}

export function AdminImportMetricGrid({
  metrics,
}: {
  metrics: AdminImportMetric[]
}) {
  return (
    <div className="metric-grid" style={{ marginTop: 18 }}>
      {metrics.map((metric) => (
        <div key={metric.label} className="metric-card">
          <div className="metric-label">{metric.label}</div>
          <div className="metric-value">{metric.value}</div>
        </div>
      ))}
    </div>
  )
}

export function AdminImportNotice({
  variant,
  children,
  style,
}: {
  variant: 'success' | 'error' | 'info'
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const baseStyle: React.CSSProperties =
    variant === 'success'
      ? {}
      : variant === 'info'
        ? {}
        : {
            background: 'rgba(220,38,38,0.12)',
            color: '#fca5a5',
            border: '1px solid rgba(220,38,38,0.18)',
          }

  const className =
    variant === 'success'
      ? 'badge badge-green'
      : variant === 'info'
        ? 'badge badge-blue'
        : 'badge'

  return (
    <div
      className={className}
      style={{
        marginTop: 16,
        minHeight: 44,
        width: '100%',
        justifyContent: 'flex-start',
        padding: '10px 14px',
        ...baseStyle,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function AdminInvalidRowsTable({
  rows,
  title = 'Invalid Rows',
}: {
  rows: AdminImportInvalidRow[]
  title?: string
}) {
  if (!rows.length) return null

  return (
    <div style={{ marginTop: 22 }}>
      <h3
        style={{
          margin: 0,
          fontSize: '1.08rem',
          fontWeight: 800,
          color: '#F8FBFF',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h3>

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="data-table" style={{ minWidth: 840 }}>
          <thead>
            <tr>
              <th>Row</th>
              <th>Raw</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.sourceIndex}-${row.raw}`}>
                <td>{row.sourceIndex}</td>
                <td>{row.raw}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminImportPreviewTable({
  rows,
  title = 'Row Preview',
  capitalize,
}: {
  rows: AdminImportPreviewRow[]
  title?: string
  capitalize: (value: string) => string
}) {
  if (!rows.length) return null

  return (
    <div style={{ marginTop: 22 }}>
      <h3
        style={{
          margin: 0,
          fontSize: '1.08rem',
          fontWeight: 800,
          color: '#F8FBFF',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h3>

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="data-table" style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              <th>Row</th>
              <th>Side A</th>
              <th>Side B</th>
              <th>Result</th>
              <th>Score</th>
              <th>Winner</th>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.sourceIndex}-${row.dedupeKey}`}>
                <td>{row.sourceIndex}</td>
                <td>{row.sideA.join(' / ')}</td>
                <td>{row.sideB.join(' / ')}</td>
                <td>{row.rawResult}</td>
                <td>{row.score}</td>
                <td>{row.winnerSide}</td>
                <td>{row.date}</td>
                <td>{capitalize(row.matchType)}</td>
                <td>
                  <span
                    className={
                      row.status === 'ready'
                        ? 'badge badge-green'
                        : row.status === 'duplicate_in_file'
                          ? 'badge badge-slate'
                          : 'badge badge-blue'
                    }
                  >
                    {row.reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminRowFailuresTable({
  rows,
}: {
  rows: AdminImportInvalidRow[]
}) {
  return <AdminInvalidRowsTable rows={rows} title="Row Failures" />
}
