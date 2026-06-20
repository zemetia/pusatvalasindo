"use client"

import React, { useRef } from "react"
import { motion, useScroll } from "framer-motion"
import { ArrowUpRight, HandCoins, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { RateResult } from "@/lib/rates"
import { useTranslations } from 'next-intl'

interface ExchangeRatesProps {
  rates: RateResult[]
}

const currencyNames: Record<string, string> = {
  USD: "United States Dollar",
  EUR: "European Union Euro",
  SGD: "Singapore Dollar",
  JPY: "Japanese Yen",
  CNY: "Chinese Yuan Renminbi",
  AUD: "Australian Dollar",
  HKD: "Hong Kong Dollar",
  SAR: "Saudi Arabian Riyal",
}

export function ExchangeRates({ rates }: ExchangeRatesProps) {
  const t = useTranslations('ExchangeRates');
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  return (
    <section ref={containerRef} className="py-60 bg-white text-neutral-900 overflow-hidden grain">
      <div className="container px-4 lg:px-16 mb-32">
        <div className="flex flex-col lg:flex-row items-baseline justify-between gap-12 border-b border-black/5 pb-20">
          <div className="space-y-6">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               whileInView={{ opacity: 1, scale: 1 }}
               className="bg-primary px-6 py-2 rounded-full inline-block"
            >
               <span className="text-[10px] font-black uppercase tracking-[0.6em] text-white">Market_Intelligence</span>
            </motion.div>
            <h2 className="text-8xl md:text-[12vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] mb-12">
               Global <br /> <span className="text-primary pr-12">Liquidity_</span>
            </h2>
          </div>
          <p className="text-2xl text-neutral-400 max-w-sm font-medium leading-[1.1] tracking-tight text-right">
             Real-time institutional spreads synchronized with global liquidity providers.
          </p>
        </div>
      </div>

      {/* Extraordinary Scrolling Gallery */}
      <div className="relative flex overflow-hidden">
        <motion.div 
          animate={{ x: [0, -2000] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="flex gap-12 px-12"
        >
          {[...rates, ...rates].map((rate, index) => (
            <motion.div
              key={`${rate.symbol}-${index}`}
              className="group relative flex-shrink-0 w-[450px] aspect-[4/5] bg-neutral-50 rounded-[5rem] p-12 overflow-hidden border border-black/5 hover:border-primary/20 transition-all duration-700"
            >
              {/* Background Poster Symbol */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-[250px] font-display font-black text-black/[0.03] uppercase italic group-hover:text-primary/[0.05] transition-colors duration-700">
                    {rate.symbol}
                 </span>
              </div>

              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Live_Quote</span>
                    <h4 className="text-5xl font-display font-black italic uppercase text-neutral-900">{rate.symbol}</h4>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{currencyNames[rate.symbol]}</p>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                    rate.change >= 0 ? "bg-primary/10 text-primary" : "bg-neutral-200 text-neutral-500"
                  )}>
                    {rate.change >= 0 ? "+" : ""}{rate.changePercent.toFixed(2)}%
                    <ArrowUpRight className={cn("w-3 h-3", rate.change < 0 && "rotate-90")} />
                  </div>
                </div>

                <div className="space-y-8">
                   <div className="space-y-2">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Rate vs IDR</span>
                      <div className="text-7xl font-display font-black tracking-tighter tabular-nums">
                         {rate.price.toLocaleString('id-ID')}
                      </div>
                   </div>
                   
                   <a 
                    href={`https://api.whatsapp.com/send?phone=6281770099920&text=Request%20Elite%20Quote%20${rate.symbol}`}
                    className="block"
                   >
                     <button className="w-full h-20 bg-white border border-black/5 rounded-[2rem] font-black uppercase tracking-[0.4em] text-[10px] hover:bg-primary hover:text-white transition-all shadow-xl group/btn flex items-center justify-center gap-4">
                        Request Quote
                        <Zap className="w-4 h-4 text-primary group-hover/btn:text-white" />
                     </button>
                   </a>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="container px-4 lg:px-16 mt-40">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12">
               <h3 className="text-6xl font-display font-black italic uppercase leading-none text-premium">
                  Institutional <br /> Desk Solutions.
               </h3>
               <p className="text-xl text-neutral-500 max-w-sm font-medium leading-relaxed">
                  Bespoke liquidity for high-net-worth individuals and corporate entities with same-day settlement guarantees.
               </p>
            </div>
            <div className="p-16 bg-neutral-900 text-white rounded-[5rem] space-y-10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-[100px]" />
               <div className="flex items-center gap-6">
                  <HandCoins className="w-12 h-12 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.8em] text-neutral-500">Volume Trading</span>
               </div>
               <h4 className="text-4xl font-display font-black italic leading-tight">Orders {">"} $10,000 USD?</h4>
               <p className="text-neutral-400 font-medium">Connect directly with our senior dealing desk for wholesale margins and priority settlement.</p>
               <button className="w-full h-20 bg-white text-neutral-900 rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[10px] hover:bg-primary hover:text-white transition-all">
                  Initialize Desk Session
               </button>
            </div>
         </div>
      </div>
    </section>
  )
}

