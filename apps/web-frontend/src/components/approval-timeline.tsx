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
                ? 'bg-violet-600 text-white ring-4 ring-violet-500/20'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {step.status === 'completed' ? <Check className="w-4 h-4" /> : step.id}
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="text-xs text-muted-foreground">{step.subtitle}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
