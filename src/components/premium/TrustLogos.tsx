"use client"

import React from "react"
import { motion } from "framer-motion"

const partners = [
  { name: "Bank Indonesia", id: "bi" },
  { name: "OJK", id: "ojk" },
  { name: "PPATK", id: "ppatk" },
  { name: "APVA", id: "apva" },
]

export function TrustLogos() {
  return (
    <div className="red-gradient-texture py-12 border-b border-white/10 relative overflow-hidden grain">
      <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-20" />
      <div className="container px-4 lg:px-16 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 opacity-80 hover:opacity-100 transition-opacity duration-500 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/60 whitespace-nowrap">
            Regulated by
          </div>
          <div className="flex flex-wrap items-center justify-center gap-12 lg:gap-24 grayscale brightness-[5]">
            {partners.map((partner) => (
              <motion.div
                key={partner.id}
                whileHover={{ scale: 1.1, filter: "none" }}
                className="flex items-center gap-3 group px-4 py-2"
              >
                <div className="w-8 h-8 rounded-full border-2 border-black/10 group-hover:border-primary transition-colors flex items-center justify-center font-black text-[8px] bg-white backdrop-blur-md">
                  {partner.id.toUpperCase()}
                </div>
                <span className="text-sm font-black uppercase tracking-widest text-neutral-500 group-hover:text-neutral-900 transition-colors">
                  {partner.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
