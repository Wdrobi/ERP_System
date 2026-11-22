import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown, LoaderCircle, X } from 'lucide-react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  busy?: boolean
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  busy = false,
  disabled,
  ...props
}: ButtonProps) {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-400',
    secondary:
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300',
  }
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function Field({ label, error, hint, className = '', ...props }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        className={`mt-2 block min-h-11 w-full rounded-lg border bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${error ? 'border-rose-300' : 'border-slate-200'} ${className}`}
        {...props}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm font-normal text-slate-500">{hint}</span>
      ) : null}
    </label>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

export function SelectField({
  label,
  error,
  hint,
  children,
  className = '',
  ...props
}: SelectFieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <span className="relative mt-2 block">
        <select
          className={`block min-h-11 w-full appearance-none rounded-lg border bg-white px-3.5 pr-10 text-[15px] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${error ? 'border-rose-300' : 'border-slate-200'} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
      {error ? (
        <span className="mt-1.5 block text-sm text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm font-normal text-slate-500">{hint}</span>
      ) : null}
    </label>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200/80 bg-white shadow-panel ${className}`}>
      {children}
    </section>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
      <div className="h-2 w-2 rounded-full bg-blue-500 ring-8 ring-blue-50" />
      <p className="mt-6 font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Loading data">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid grid-cols-5 gap-4">
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="col-span-2 h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <h2 id="modal-title" className="text-xl font-bold text-slate-950">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
