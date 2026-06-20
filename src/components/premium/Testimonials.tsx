"use client"

import React from "react"
import { motion } from "framer-motion"
import { Quote, CheckCircle2, Star } from "lucide-react"

const testimonials = [
  {
    author: "Joanie Tan",
    text: "The bosses were very patient and friendly during the process and would kindly give the most decent rate. Highly recommend!",
    tag: "USD/IDR",
    rating: 5
  },
  {
    author: "Josh Isaiah",
    text: "Staff were engaging and genuine in providing the most favourable exchange rates and transfer! Location is near banks too which is really good!",
    tag: "TRANSFER",
    rating: 5
  },
  {
    author: "Ratu N Fauziah",
    text: "Puas banget nuker disini, ratenya kompetitif banget dibanding tempat lain di Jakarta. Prosesnya juga cepet.",
    tag: "VALAS",
    rating: 5
  },
]

export function Testimonials() {
  return (
    <section id="testimonials" className="py-60 red-gradient-texture text-white grain overflow-hidden relative border-t border-white/10">
      
      {/* Background Poster Accent Removed */}

      <div className="container px-4 lg:px-16 mb-40 relative z-10">
        <div className="flex flex-col lg:flex-row items-baseline justify-between gap-12 border-b border-white/10 pb-20">
           <div className="space-y-6">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-[2px] bg-white/40" />
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/60">Client Narrative</span>
              </div>
              <h2 className="text-8xl md:text-[10vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-white">
                 Testimonials_
              </h2>
           </div>
        </div>
      </div>

      {/* Extraordinary Scrolling Quotes */}
      <div className="flex overflow-hidden relative z-10">
         <motion.div 
           animate={{ x: [0, -1000] }}
           transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
           className="flex gap-20 px-20"
         >
            {[...testimonials, ...testimonials].map((testi, i) => (
              <div key={i} className="flex-shrink-0 w-[500px] lg:w-[800px] space-y-16">
                 <div className="relative">
                    <Quote className="absolute -top-12 -left-12 w-40 h-40 text-white opacity-[0.05]" />
                    <p className="text-4xl lg:text-6xl font-display font-black italic leading-[0.9] tracking-tighter text-white relative z-10">
                       "{testi.text}"
                    </p>
                 </div>
                 
                 <div className="flex items-center justify-between pt-12 border-t border-white/10">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-white text-primary rounded-[2rem] flex items-center justify-center font-display font-black text-2xl italic shadow-2xl">
                          {testi.author[0]}
                       </div>
                       <div>
                          <h4 className="text-xl font-black uppercase tracking-widest text-white italic flex items-center gap-3">
                             {testi.author} <CheckCircle2 className="w-4 h-4 text-blue-400" />
                          </h4>
                          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">{testi.tag}_Desk</span>
                       </div>
                    </div>
                    <div className="flex gap-1">
                       {[1,2,3,4,5].map(j => <Star key={j} className="w-4 h-4 text-white fill-white" />)}
                    </div>
                 </div>
              </div>
            ))}
         </motion.div>
      </div>

      {/* Extreme Footer Sentiment */}
      <div className="container px-4 lg:px-16 mt-60 text-center relative z-10">
         <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="inline-flex flex-col items-center gap-6"
         >
            <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40">Google_Business_Accreditation</span>
            <div className="text-6xl lg:text-[8vw] font-display font-black italic text-white leading-none">
               4.9 <span className="text-white/40 italic">/</span> 5.0
            </div>
            <p className="text-white/40 font-black uppercase tracking-[0.4em] text-[10px]">Verified Transaction Satisfaction</p>
         </motion.div>
      </div>
    </section>
  )
}
