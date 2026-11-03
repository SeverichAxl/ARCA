'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FileUploadDropzone() {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <motion.div
      animate={{
        scale: isDragging ? 1.02 : 1,
        borderColor: isDragging ? '#2563eb' : '#e2e8f0',
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}
      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 transition-colors"
    >
      <motion.div
        animate={{ y: isDragging ? -6 : 0 }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}
        className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-full text-blue-600 dark:text-blue-400 mb-3"
      >
        <UploadCloud className="w-8 h-8" />
      </motion.div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        Arrastra un archivo aquí
      </p>
      <p className="text-xs text-slate-400 mt-1 mb-4">PDF, PNG o JPEG (máx. 10 MB)</p>
      <Button variant="outline" size="sm">Seleccionar archivo</Button>
    </motion.div>
  )
}