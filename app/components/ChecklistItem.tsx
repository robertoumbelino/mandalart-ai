'use client'

import { CheckCircle2 } from 'lucide-react'

export function ChecklistItem({ checked, text, onToggle }: {
  checked: boolean
  text: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 p-3 text-left rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-indigo-200'
      }`}
    >
      <span aria-hidden="true" className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
      }`}>
        {checked && <CheckCircle2 size={14} className="text-white" />}
      </span>
      <span className={`text-sm ${checked ? 'text-green-800 line-through opacity-70' : 'text-gray-700'}`}>
        {text}
      </span>
    </button>
  )
}
