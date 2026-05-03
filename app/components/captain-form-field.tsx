'use client'

import type { CSSProperties, ReactNode } from 'react'

type CaptainFormFieldProps = {
  label: string
  htmlFor?: string
  hint?: string
  hintStyle?: CSSProperties
  labelStyle: CSSProperties
  children: ReactNode
}

export default function CaptainFormField({
  label,
  htmlFor,
  hint,
  hintStyle,
  labelStyle,
  children,
}: CaptainFormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
      {hint ? <p style={hintStyle}>{hint}</p> : null}
      {children}
    </div>
  )
}
