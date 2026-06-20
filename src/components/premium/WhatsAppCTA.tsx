"use client"

import React from "react"
import { motion } from "framer-motion"
import { MessageCircle } from "lucide-react"

export function WhatsAppCTA() {
  const whatsappUrl = "https://api.whatsapp.com/send?phone=6281770099920&text=Halo%20Pusat%20Valas%20Indo,%20saya%20ingin%20tanya%20kurs%20hari%20ini."

  return (
    <div className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-3 group">
      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: 20 }}
        whileHover={{ opacity: 1, scale: 1, x: 0 }}
        className="opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-neutral-800 px-4 py-2 rounded-xl shadow-xl border border-primary/20 pointer-events-none"
      >
        <p className="text-xs font-bold text-primary">Chat with us now!</p>
        <p className="text-[10px] text-muted-foreground whitespace-nowrap">Fast response for currency rates.</p>
      </motion.div>

      {/* Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative"
      >
        <span className="absolute inset-0 bg-primary/20 rounded-full animate-ping pointer-events-none" />
        <motion.div
           whileHover={{ scale: 1.1 }}
           whileTap={{ scale: 0.9 }}
           className="relative bg-primary text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <MessageCircle className="w-8 h-8 fill-white/10" />
        </motion.div>
      </a>
    </div>
  )
}
