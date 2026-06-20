"use client"

import React from "react"
import { motion } from "framer-motion"
import { ShieldCheck, Globe, Star, ArrowUpRight } from "lucide-react"

const storyBlocks = [
  {
    index: "01",
    title: "Harga Kompetitif.",
    desc: "Dapatkan nilai tukar yang transparan dan bersaing untuk setiap transaksi Anda.",
    icon: ShieldCheck,
    align: "left"
  },
  {
    index: "02",
    title: "Kurs Terupdate.",
    desc: "Akses nilai tukar terbaru secara real-time untuk memastikan akurasi transaksi.",
    icon: Star,
    align: "right"
  },
  {
    index: "03",
    title: "Online Transfer.",
    desc: "Kemudahan penukaran valuta asing melalui sistem transfer bank yang aman.",
    icon: ArrowUpRight,
    align: "left"
  },
  {
    index: "04",
    title: "Mudah & Praktis.",
    desc: "Proses cepat, aman, dan tanpa ribet. Kami mengutamakan efisiensi waktu Anda.",
    icon: Globe,
    align: "right"
  },
  {
    index: "05",
    title: "Kirim Internasional.",
    desc: "Layanan pengiriman uang ke luar negeri dengan kurs terbaik dan biaya transparan.",
    icon: ShieldCheck,
    align: "left"
  }
]

export function Features() {
  return (
    <section className="py-60 md:py-80 red-gradient-texture text-white grain relative overflow-hidden">
      
      {/* Precision Geometric Overlay */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-0 left-1/4 w-[1px] h-full bg-white/[0.03]" />
         <div className="absolute top-0 left-3/4 w-[1px] h-full bg-white/[0.03]" />
      </div>

      <div className="container px-4 lg:px-16 relative z-10 mx-auto">
        
        <div className="mb-48 space-y-12 max-w-4xl">
           <div className="flex items-center gap-8">
              <div className="w-16 h-[1px] bg-white/40" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white/60">Distinctive Advantages</span>
           </div>
           <h2 className="text-8xl md:text-[10vw] lg:text-[9vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-white">
              Elite <br /> <span className="text-white/40 pr-12">Standards_</span>
           </h2>
        </div>

        <div className="space-y-60 lg:space-y-80">
          {storyBlocks.map((block, i) => (
            <motion.div 
              key={block.index}
              initial={{ opacity: 0, y: 100 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className={`flex flex-col ${block.align === 'right' ? 'lg:items-end' : 'lg:items-start'} relative p-0`}
            >
               {/* Massive Background Index */}
               <div className={`absolute ${block.align === 'right' ? 'left-[-5%] lg:left-[20%]' : 'right-[-5%] lg:right-[20%]'} top-[-50px] text-[20vw] font-display font-black text-white/10 italic pointer-events-none z-0`}>
                  {block.index}
               </div>

               <div className={`w-full lg:w-[60%] bg-black/20 backdrop-blur-xl p-12 lg:p-24 rounded-[5rem] border border-white/10 relative z-10 shadow-2xl hover:border-white/30 transition-all duration-700`}>
                  <div className="flex flex-col lg:flex-row gap-12 lg:items-center justify-between mb-12">
                     <div className="w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center shadow-xl">
                        <block.icon className="w-10 h-10 text-primary" />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40">Section_{block.index}</span>
                  </div>

                  <h3 className="text-5xl lg:text-7xl font-display font-black italic uppercase leading-none mb-8 text-white group">
                    {block.title}
                  </h3>
                  
                  <p className="text-2xl text-white/90 font-medium leading-relaxed max-w-xl mb-12">
                    {block.desc}
                  </p>

                  <button className="group flex items-center gap-4 text-sm font-black uppercase tracking-[0.4em] text-white hover:text-white/60 transition-colors">
                     Discover Narrative <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
               </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
