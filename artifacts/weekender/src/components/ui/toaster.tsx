import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map(function ({ id, title, description }) {
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card border border-primary text-card-foreground shadow-neon-pink p-4 rounded-lg pointer-events-auto"
              onClick={() => dismiss(id)}
            >
              {title && <div className="font-bold uppercase tracking-tight text-white text-sm">{title}</div>}
              {description && <div className="text-sm font-mono text-muted-foreground mt-1">{description}</div>}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
