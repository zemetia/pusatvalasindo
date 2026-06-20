"use client"

import React from "react"
import { motion } from "framer-motion"
import { Header } from "@/components/premium/Header"
import { Footer } from "@/components/premium/Footer"
import { Landmark, ShieldCheck, Star, ArrowUpRight, ArrowRight } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20 selection:text-primary grain">
      <Header />

      <main className="pt-60">
        {/* Extraordinary Heritage Hero */}
        <section className="pb-32 bg-white">
          <div className="container px-4 lg:px-16">
            <div className="flex flex-col gap-12 max-w-5xl">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-[2px] bg-primary" />
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Institutional Legacy</span>
              </div>
              <h1 className="text-[12vw] xl:text-[10vw] font-display font-black leading-[0.8] tracking-tighter text-neutral-900 uppercase italic">
                Authorized <br />
                <span className="text-primary pr-12">Heritage_</span>
              </h1>
              <p className="text-3xl text-neutral-500 font-medium leading-tight max-w-2xl italic">
                Established in 2018. Jakarta's most trusted partner for secure, legal, and rapid currency exchange.
              </p>
            </div>
          </div>
        </section>

        {/* Narrative Split */}
        <section className="py-60 red-gradient-texture text-white grain relative overflow-hidden">
           <div className="container px-4 lg:px-16 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-start">
                 <div className="space-y-12">
                    <h2 className="text-6xl lg:text-8xl font-display font-black italic uppercase leading-[0.8]">
                       The Desk <br /> Story.
                    </h2>
                    <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                       <Landmark className="w-12 h-12 text-primary" />
                    </div>
                 </div>
                 <div className="space-y-12">
                    <p className="text-3xl font-medium leading-relaxed italic opacity-90">
                       Pusat Valas Indo adalah perusahaan yang bergerak di bidang valuta asing sejak tahun 2018. Berlokasi strategis di Cengkareng Timur, Jakarta Barat.
                    </p>
                    <p className="text-xl font-medium leading-relaxed opacity-70">
                       Kami adalah money changer legal dan bersertifikat dengan Izin No. 20/28/KEP.GBI/DKSP/2018 oleh Bank Indonesia. Fokus kami adalah menghadirkan rasa kejujuran, keamanan, dan pelayanan yang ramah luar biasa.
                    </p>
                    <div className="pt-12 border-t border-white/10">
                       <div className="grid grid-cols-2 gap-12">
                          <div className="space-y-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Founded</span>
                             <p className="text-4xl font-display font-black italic">2018_</p>
                          </div>
                          <div className="space-y-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Authorized</span>
                             <p className="text-4xl font-display font-black italic">PVI_DKSP</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Vision Poster */}
        <section className="py-60 bg-white grain overflow-hidden">
           <div className="container px-4 lg:px-16">
              <div className="bg-neutral-50 rounded-[5rem] border border-black/5 p-12 lg:p-32 flex flex-col items-center text-center space-y-16 shadow-2xl shadow-black/5 group">
                 <div className="flex items-center gap-4">
                    <Star className="w-6 h-6 text-primary fill-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.8em] text-neutral-400">Institutional Vision</span>
                    <Star className="w-6 h-6 text-primary fill-primary" />
                 </div>
                 <h3 className="text-5xl lg:text-[7vw] font-display font-black italic uppercase leading-[0.9] tracking-tighter text-neutral-900">
                    "Become the Most <br /> <span className="text-primary">Trusted & Leading</span> <br /> Money Changer."
                 </h3>
                 <p className="text-xl text-neutral-500 font-medium max-w-2xl italic">
                    Dedicated to providing excellence in foreign exchange services with a commitment to integrity and innovation.
                 </p>
                 <div className="pt-12">
                    <button className="flex items-center gap-4 text-sm font-black uppercase tracking-[0.5em] text-primary hover:text-neutral-900 transition-colors">
                       Our Full Roadmap <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </button>
                 </div>
              </div>
           </div>
        </section>

        {/* Compliance Card */}
        <section className="py-60 red-gradient-texture text-white grain overflow-hidden">
           <div className="container px-4 lg:px-16 relative z-10">
              <div className="flex flex-col lg:flex-row gap-24 items-center bg-gradient-to-br from-red-900/30 to-black/40 backdrop-blur-3xl p-12 lg:p-24 rounded-[5rem] border border-white/10 shadow-2xl">
                 <div className="flex-1 space-y-8">
                    <div className="flex items-center gap-6">
                       <ShieldCheck className="w-16 h-16 text-primary bg-white p-4 rounded-2xl" />
                       <span className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40">Legal_Framework</span>
                    </div>
                    <h2 className="text-6xl font-display font-black italic uppercase leading-tight">100% Authorized <br /> Compliance.</h2>
                    <p className="text-xl opacity-70 font-medium leading-relaxed">
                       Pusat Valas Indo operates under the direct supervision of Bank Indonesia. Our rigorous KYC and AML protocols ensure your wealth is exchanged within the highest legal standards.
                    </p>
                 </div>
                 <div className="flex-shrink-0 w-full lg:w-96 p-12 bg-gradient-to-br from-red-900/20 to-black/30 rounded-[3rem] border border-white/5 space-y-12">
                    <div className="space-y-2">
                       <span className="text-[9px] font-black uppercase tracking-widest text-white/40">License No.</span>
                       <p className="text-lg font-black uppercase italic tracking-tighter">20/28/KEP.GBI/DKSP/2018</p>
                    </div>
                    <div className="space-y-4">
                       <p className="text-xs font-medium opacity-60">This license authorizes Pusat Valas Indo to conduct KUPVA BB (Kegiatan Usaha Penukaran Valuta Asing Bukan Bank).</p>
                       <button className="w-full h-16 bg-white text-primary rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary hover:text-white transition-all shadow-xl">
                          Verify Credentials
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
