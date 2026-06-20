"use client"

import React from "react"
import { Header } from "@/components/premium/Header"
import { Footer } from "@/components/premium/Footer"
import { motion } from "framer-motion"
import { Globe, Smartphone, Landmark, Send, Zap, ShieldCheck, ArrowRight } from "lucide-react"

export default function ServicesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20 selection:text-primary grain">
      <Header />

      <main className="pt-60">
        
        {/* Extraordinary Services Hero */}
        <section className="pb-32 bg-white">
          <div className="container px-4 lg:px-16">
            <div className="flex flex-col gap-12 max-w-5xl">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-[2px] bg-primary" />
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Service Intelligence</span>
              </div>
              <h1 className="text-[12vw] xl:text-[10vw] font-display font-black leading-[0.8] tracking-tighter text-neutral-900 uppercase italic">
                Strategic <br />
                <span className="text-primary pr-12">Capability_</span>
              </h1>
              <p className="text-3xl text-neutral-500 font-medium leading-tight max-w-2xl italic">
                From high-speed digital quotations to institutional physical settlements—we provide the bridge for your global capital.
              </p>
            </div>
          </div>
        </section>

        {/* Distributed Capability Grid */}
        <section className="py-60 red-gradient-texture text-white grain relative overflow-hidden">
           <div className="container px-4 lg:px-16 relative z-10">
              <div className="space-y-60">
                 
                 {/* Capability 01 - Online */}
                 <div className="flex flex-col lg:flex-row gap-24 items-center">
                    <div className="flex-1 space-y-12">
                       <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40">Capability_01</span>
                       <h2 className="text-7xl lg:text-9xl font-display font-black italic uppercase leading-none">Online <br /> Velocity.</h2>
                       <p className="text-2xl opacity-80 font-medium leading-relaxed italic max-w-lg">
                          Kunjungi halaman media sosial kami untuk mendapatkan tarif terbaru, aktivitas, dan informasi lain secara real-time.
                       </p>
                       <div className="flex items-center gap-6">
                          <Smartphone className="w-12 h-12 text-white" />
                          <p className="text-sm font-black uppercase tracking-[0.2em]">Full Digital Support <br /> WhatsApp Desk Integration</p>
                       </div>
                    </div>
                    <div className="flex-1 w-full p-12 lg:p-24 bg-gradient-to-br from-red-900/30 to-black/40 backdrop-blur-3xl rounded-[5rem] border border-white/10 shadow-2xl relative">
                       <Zap className="absolute top-12 right-12 w-12 h-12 text-primary" />
                       <ul className="space-y-12">
                          {["Live Rate Tickers", "Instant Quote Requests", "Social Intelligence Updates"].map(item => (
                             <li key={item} className="flex items-center gap-6 border-b border-white/5 pb-8">
                                <span className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-black">✓</span>
                                <span className="text-2xl font-display font-black italic uppercase">{item}</span>
                             </li>
                          ))}
                       </ul>
                    </div>
                 </div>

                 {/* Capability 02 - On the spot */}
                 <div className="flex flex-col lg:flex-row-reverse gap-24 items-center">
                    <div className="flex-1 space-y-12 text-right lg:text-left lg:pl-24">
                       <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40">Capability_02</span>
                       <h2 className="text-7xl lg:text-9xl font-display font-black italic uppercase leading-none">Instant <br /> Presence.</h2>
                       <p className="text-2xl opacity-80 font-medium leading-relaxed italic max-w-lg lg:ml-0 ml-auto">
                          Kantor kami terbuka untuk semua orang yang ingin melakukan transaksi manual secara instan dengan keamanan penuh.
                       </p>
                       <div className="flex items-center gap-6 justify-end lg:justify-start">
                          <p className="text-sm font-black uppercase tracking-[0.2em] text-right lg:text-left">Premium Lounges <br /> Secure Personal Service</p>
                          <Landmark className="w-12 h-12 text-white" />
                       </div>
                    </div>
                    <div className="flex-1 w-full p-12 lg:p-24 bg-gradient-to-br from-red-900/20 to-black/30 backdrop-blur-3xl rounded-[5rem] border border-white/10 shadow-2xl space-y-12">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Physical_Settlement</h4>
                       <p className="text-3xl font-display font-black italic">"Staf kami dengan senang hati akan membantu anda secara langsung di pusat treasury kami."</p>
                       <button className="w-full h-20 bg-white text-primary rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all">
                          Locate Physical Desk
                       </button>
                    </div>
                 </div>

                 {/* Capability 03 - Remittance */}
                 <div className="flex flex-col lg:flex-row gap-24 items-center">
                    <div className="flex-1 space-y-12">
                       <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40">Capability_03</span>
                       <h2 className="text-7xl lg:text-9xl font-display font-black italic uppercase leading-none">Global <br /> Remit.</h2>
                       <p className="text-2xl opacity-80 font-medium leading-relaxed italic max-w-lg">
                          Kendalikan aliran modal internasional Anda dengan jasa "Pusat Kirim Duit" yang terintegrasi penuh.
                       </p>
                       <div className="flex items-center gap-6">
                          <Globe className="w-12 h-12 text-white" />
                          <p className="text-sm font-black uppercase tracking-[0.2em]">Same Day Settlement <br /> Global Corridor Access</p>
                       </div>
                    </div>
                    <div className="flex-1 w-full p-12 lg:p-24 bg-gradient-to-br from-red-900/30 to-black/40 backdrop-blur-3xl rounded-[5rem] border border-white/10 shadow-2xl">
                       <div className="space-y-16">
                          <div className="flex items-baseline justify-between gap-6 border-b border-white/5 pb-8">
                             <span className="text-5xl font-display font-black italic uppercase">IDN</span>
                             <ArrowRight className="w-8 h-8 text-primary" />
                             <span className="text-5xl font-display font-black italic uppercase">GLOBAL</span>
                          </div>
                          <p className="text-lg opacity-60 font-medium">Layanan kirim uang luar negeri yang memberikan rasa kejujuran, keamanan dan pelayanan yang ramah luar biasacepat.</p>
                       </div>
                    </div>
                 </div>

              </div>
           </div>
        </section>

        {/* Bottom Call to Action Strategy */}
        <section className="py-60 bg-white grain overflow-hidden">
           <div className="container px-4 lg:px-16 text-center space-y-24">
              <h2 className="text-6xl md:text-9xl font-display font-black tracking-tighter italic text-premium">
                 Ready to <br /> Transact?
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                 <button className="bg-primary text-white font-black px-12 h-24 rounded-[3rem] text-sm uppercase tracking-[0.3em] hover:scale-110 transition-transform shadow-2xl w-full sm:w-auto">
                    Contact Dealing Desk
                 </button>
                 <button className="bg-neutral-50 border border-black/5 text-neutral-500 font-bold px-12 h-24 rounded-[3rem] text-xs uppercase tracking-widest hover:bg-neutral-100 transition-all w-full sm:w-auto">
                    View FAQ Desk
                 </button>
              </div>
           </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
