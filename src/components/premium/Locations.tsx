"use client"

import React from "react"
import { motion } from "framer-motion"
import { MapPin, Phone, Clock, ExternalLink, MessageCircle, ArrowRight } from "lucide-react"

const branches = [
  {
    name: "Jakarta Barat.",
    region: "HQ - Cengkareng",
    tag: "CENTRAL",
    address: "Mutiara Taman Palem A5-27, Cengkareng, Jakarta Barat 11730",
    hours: "Mon-Fri: 08.00-16.30 | Sat: 08.00-14.00",
    phone: "0817-7009-9920",
    maps: "https://maps.app.goo.gl/P37npFa6zb3nYR8Y6",
  },
  {
    name: "Tangerang.",
    region: "Regional Branch",
    tag: "DISTRICT",
    address: "Jl. Green Lake City Boulevard rukan wallstreet a No.16, Tangerang 15147",
    hours: "Mon-Fri: 08.00-16.30 | Sat: 08.00-14.00",
    phone: "0823-3380-0080",
    maps: "https://maps.app.goo.gl/1SGvqb2UvqXpotfN9",
  },
]

export function Locations() {
  return (
    <section id="locations" className="py-60 md:py-80 bg-white text-neutral-900 overflow-hidden grain relative">
      <div className="absolute left-[5%] top-0 text-[20vw] font-display font-black text-black/[0.01] uppercase italic pointer-events-none">Reach_</div>

      <div className="container px-4 lg:px-16 mx-auto">
        
        <div className="flex flex-col lg:flex-row items-baseline justify-between gap-12 border-b border-black/5 pb-24 mb-48">
           <div className="space-y-8">
              <div className="flex items-center gap-8">
                 <div className="w-16 h-[1px] bg-primary" />
                 <span className="text-[11px] font-black uppercase tracking-[0.5em] text-primary">Regional Operations</span>
              </div>
              <h2 className="text-8xl md:text-[10vw] lg:text-[9vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-neutral-900">
                 Presence_
              </h2>
           </div>
        </div>

        <div className="space-y-60 lg:space-y-40">
          {branches.map((branch, index) => (
            <motion.div
              key={branch.name}
              initial={{ opacity: 0, x: index % 2 === 0 ? -100 : 100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={`flex flex-col lg:flex-row gap-12 lg:gap-32 items-center ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
            >
              {/* Massive Typographic Region */}
              <div className="flex-1 text-center lg:text-left">
                 <span className="text-[10px] font-black uppercase tracking-[0.8em] text-primary mb-8 block">{branch.tag}_0{index + 1}</span>
                 <h3 className="text-7xl lg:text-9xl font-display font-black italic uppercase leading-none text-neutral-900 group">
                    {branch.name}
                 </h3>
                 <p className="text-xl font-bold uppercase tracking-[0.4em] text-neutral-300 mt-4">{branch.region}</p>
              </div>

              {/* Extraordinary Location Card */}
              <div className="flex-1 w-full max-w-2xl">
                 <div className="bg-neutral-50 border border-black/5 p-12 lg:p-16 rounded-[4rem] shadow-2xl shadow-black/5 space-y-12 hover:border-primary/20 transition-all duration-700">
                    <div className="flex justify-between items-center pb-12 border-b border-black/5">
                       <MapPin className="w-12 h-12 text-primary" />
                       <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Status</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center gap-2 justify-end">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Open Now
                          </span>
                       </div>
                    </div>

                    <p className="text-2xl text-neutral-500 font-medium leading-relaxed italic">
                       "{branch.address}"
                    </p>

                    <div className="grid grid-cols-2 gap-12">
                       <div className="space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-400">Trading_Time</span>
                          <p className="text-sm font-black uppercase text-neutral-900">{branch.hours}</p>
                       </div>
                       <div className="space-y-2 text-right lg:text-left">
                          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-400">Hotline</span>
                          <p className="text-sm font-black uppercase text-neutral-900">{branch.phone}</p>
                       </div>
                    </div>

                    <div className="pt-12 flex flex-col sm:flex-row gap-6">
                       <a href={branch.maps} target="_blank" className="flex-1 h-20 bg-neutral-900 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-4 hover:bg-primary transition-all shadow-xl">
                          Nav to Branch <ArrowRight className="w-4 h-4" />
                       </a>
                       <a href={`https://wa.me/${branch.phone.replace("-", "")}`} target="_blank" className="flex-1 h-20 bg-white border border-black/5 rounded-3xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-4 hover:bg-neutral-100 transition-all shadow-sm">
                          Direct WA <MessageCircle className="w-4 h-4 text-green-500" />
                       </a>
                    </div>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
