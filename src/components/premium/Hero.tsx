"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { 
  ArrowRightLeft, 
  ChevronRight,
  Zap,
  Globe,
  Landmark,
  Plus
} from "lucide-react"
import { RateResult } from "@/lib/rates"
import { useTranslations } from 'next-intl'

interface HeroProps {
  rates: RateResult[]
}

export function Hero({ rates }: HeroProps) {
  const t = useTranslations('Hero');
  const [amount, setAmount] = useState<string>("1000")
  const [result, setResult] = useState<number>(0)
  const [mode, setMode] = useState<"buy" | "sell">("buy")
  
  const containerRef = useRef(null)
  const { scrollY } = useScroll()
  const y1 = useTransform(scrollY, [0, 500], [0, 200])
  
  const usdRate = rates.find(r => r.symbol === "USD")?.price || 16120

  useEffect(() => {
    const val = parseFloat(amount) || 0
    if (mode === "buy") {
      setResult(val * usdRate)
    } else {
      setResult(val / usdRate)
    }
  }, [amount, mode, usdRate])

  return (
    <section ref={containerRef} className="relative min-h-[140vh] bg-white text-neutral-900 overflow-hidden grain pt-48 lg:pt-60">
      
      {/* Architectural Grid Accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
         <div className="absolute top-0 left-1/4 w-[1px] h-full bg-neutral-200" />
         <div className="absolute top-0 left-2/4 w-[1px] h-full bg-neutral-200" />
         <div className="absolute top-0 left-3/4 w-[1px] h-full bg-neutral-200" />
         <div className="absolute top-1/4 left-0 w-full h-[1px] bg-neutral-200" />
         <div className="absolute top-2/4 left-0 w-full h-[1px] bg-neutral-200" />
      </div>

      <div className="container relative z-10 min-h-screen flex flex-col justify-center px-4 md:px-16 mx-auto">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
           
           {/* Left Info Column (Poster Layout) */}
           <div className="lg:col-span-12 xl:col-span-8 mb-20 xl:mb-0">
              <div className="flex flex-col gap-12 lg:gap-20">
                <motion.div 
                   initial={{ opacity: 0, x: -30 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="flex items-center gap-6"
                >
                   <div className="w-16 h-[1px] bg-primary" />
                   <span className="text-[11px] font-black uppercase tracking-[0.5em] text-primary">{t('institutionNo')}</span>
                </motion.div>
 
                <div className="relative">
                    <motion.h1 
                     initial={{ opacity: 0, y: 50 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="text-[10vw] lg:text-[9vw] xl:text-[8vw] font-display font-black leading-[0.8] tracking-tighter text-neutral-900 uppercase italic"
                    >
                      Pusat <br />
                      Valas <br />
                      <span className="text-primary pr-12">Indo_</span>
                    </motion.h1>
                    
                    {/* Floating Accreditation Tag */}
                    <motion.div 
                     initial={{ scale: 0, rotate: -45 }}
                     animate={{ scale: 1, rotate: 12 }}
                     transition={{ delay: 0.5, type: "spring" }}
                     className="absolute top-[5%] right-[0%] lg:right-[40%] bg-primary text-white p-8 rounded-full shadow-[0_30px_60px_-15px_rgba(239,68,68,0.3)] flex flex-col items-center justify-center text-center w-36 h-36 lg:w-44 lg:h-44 border-[10px] border-white z-20"
                    >
                       <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t('authorized')}</span>
                       <Plus className="w-4 h-4 my-1" />
                       <span className="text-[8px] opacity-70 font-bold uppercase text-center">{t('license')}</span>
                    </motion.div>
                 </div>

                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   transition={{ delay: 0.6 }}
                   className="flex flex-col md:flex-row items-center lg:items-start gap-12 pt-8"
                 >
                    <p className="text-2xl lg:text-3xl text-neutral-500 max-w-sm font-medium leading-[1.2] tracking-tight italic border-l-4 border-primary pl-8">
                       {t('description')}
                    </p>
                    <div className="space-y-6">
                       <div className="flex items-center gap-3">
                          {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 bg-primary/20 rounded-full transition-all hover:bg-primary" />)}
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('reviews')}</span>
                       </div>
                       <button className="flex items-center gap-4 group px-8 py-4 bg-neutral-50 rounded-2xl border border-black/5 hover:bg-white hover:border-primary transition-all">
                          <span className="text-xs font-black uppercase tracking-[0.3em] group-hover:text-primary transition-colors">{t('contactUs')}</span>
                          <ArrowRightLeft className="w-4 h-4 text-primary group-hover:translate-x-2 transition-transform" />
                       </button>
                    </div>
                 </motion.div>
              </div>
           </div>

           {/* Right Asymmetric Calculator Column */}
           <div className="lg:col-span-12 xl:col-span-4 flex justify-end">
              <motion.div 
               style={{ y: y1 }}
               className="w-full max-w-md bg-white border border-black/5 p-12 rounded-[5rem] shadow-[0_100px_120px_-40px_rgba(0,0,0,0.1)] relative z-20 group hover:border-primary/20 transition-all duration-700"
              >
                  <div className="flex items-center justify-between mb-12">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-400">Module_01</h4>
                      <h3 className="text-3xl font-black font-display uppercase italic text-primary">{t('swapEngine')}</h3>
                    </div>
                    <Zap className="w-8 h-8 text-primary animate-pulse" />
                  </div>

                  <div className="space-y-12">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">{t('iGive')}</span>
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">{t('liveRate')}</span>
                       </div>
                       <div className="flex items-center bg-neutral-50 p-8 rounded-[3rem] border border-black/5 group-focus-within:border-primary/40 transition-all">
                          <span className="font-display font-black text-2xl border-r border-black/10 pr-6 mr-6">USD</span>
                          <input 
                            type="number" 
                            className="bg-transparent text-4xl font-display font-black outline-none w-full tracking-tighter" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                       </div>
                    </div>

                    <div className="flex justify-center -my-14 relative z-30">
                       <button 
                        onClick={() => setMode(mode === 'buy' ? 'sell' : 'buy')}
                        className="w-20 h-20 bg-primary text-white rounded-full border-[10px] border-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group-hover:rotate-180 duration-1000"
                       >
                          <ArrowRightLeft className="w-6 h-6" />
                       </button>
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">{t('iReceive')}</span>
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">{t('idrEst')}</span>
                       </div>
                       <div className="flex items-center bg-neutral-50 p-8 rounded-[3rem] border border-black/5">
                          <span className="font-display font-black text-2xl border-r border-black/10 pr-6 mr-6">IDR</span>
                          <div className="text-4xl font-display font-black tracking-tighter truncate">
                             {result.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                          </div>
                       </div>
                    </div>

                    <div className="pt-8">
                       <button className="w-full h-24 bg-neutral-900 text-white rounded-[3rem] font-black uppercase tracking-[0.4em] text-[10px] hover:bg-primary transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-4 group">
                          {t('initializeTransaction')}
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                       </button>
                       <p className="text-center mt-6 text-[8px] font-black uppercase tracking-widest text-neutral-400">
                          {t('secureDesk')}
                       </p>
                    </div>
                  </div>
              </motion.div>
           </div>
        </div>

        {/* Extraordinary Footer Sidebar Accent (Image 3 Inspiration) */}
        <div className="absolute right-12 bottom-24 hidden xl:flex flex-col items-center gap-8 text-neutral-300">
           <div className="rotate-90 origin-right translate-x-12 translate-y-24 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.8em]">
              Jakarta / Indonesia
           </div>
           <div className="w-[1px] h-32 bg-black/[0.05]" />
           <div className="space-y-6">
              <Globe className="w-5 h-5 hover:text-primary transition-colors cursor-pointer" />
              <Landmark className="w-5 h-5 hover:text-primary transition-colors cursor-pointer" />
           </div>
        </div>

      </div>
    </section>
  )
}

