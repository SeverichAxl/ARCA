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
        borderColor: isDragging ? '#8b5cf6' : 'hsl(var(--border))',
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}
      className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center bg-muted/30 transition-colors"
    >
      <motion.div
        animate={{ y: isDragging ? -6 : 0 }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}
        className="p-3 bg-primary/15 rounded-full text-violet-300 mb-3"
      >
        <UploadCloud className="w-8 h-8" />
      </motion.div>
      <p className="text-sm font-semibold text-foreground">
        Arrastra un archivo aquí
      </p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">PDF, PNG o JPEG (máx. 10 MB)</p>
      <Button variant="outline" size="sm">Seleccionar archivo</Button>
    </motion.div>
  )
}
