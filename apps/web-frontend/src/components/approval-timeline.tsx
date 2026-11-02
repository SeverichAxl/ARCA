'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface Step {
  id: number
  title: string
  subtitle: string
  status: 'completed' | 'current' | 'pending'
}

export function ApprovalTimeline({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, idx) => (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.15 }}
          className="flex items-start gap-4 relative"
        >
          {/* Indicador Numérico o Icono */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors ${
              step.status === 'completed'
                ? 'bg-emerald-500 text-white'
                : step.status === 'current'
                ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            {step.status === 'completed' ? <Check className="w-4 h-4" /> : step.id}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.title}</p>
            <p className="text-xs text-slate-400">{step.subtitle}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}