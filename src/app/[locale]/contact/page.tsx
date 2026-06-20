"use client"

import React from "react"
import { Header } from "@/components/premium/Header"
import { Footer } from "@/components/premium/Footer"
import { motion } from "framer-motion"
import { Phone, Mail, MapPin, MessageCircle, ArrowRight, Clock, Send } from "lucide-react"

const hubs = [
  {
    name: "Jakarta_HQ",
    address: "Mutiara Taman Palem A5-27, Cengkareng, Jakarta Barat",
    hours: "08.00 - 16.30 (Mon-Fri)",
    phone: "021-2951-3988",
    wa: "081770099920",
    maps: "https://maps.app.goo.gl/P37npFa6zb3nYR8Y6"
  },
  {
    name: "Tangerang_Desk",
    address: "GLC Boulevard walllstreet a No.16, Cipondoh, Tangerang",
    hours: "08.00 - 16.30 (Mon-Fri)",
    phone: "0823-3380-0080",
    wa: "082333800080",
    maps: "https://maps.app.goo.gl/1SGvqb2UvqXpotfN9"
  }
]

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20 selection:text-primary grain">
      <Header />

      <main className="pt-60">
        
        {/* Extraordinary Connect Hero */}
        <section className="pb-32 bg-white">
          <div className="container px-4 lg:px-16">
            <div className="flex flex-col gap-12 max-w-5xl">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-[2px] bg-primary" />
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Global Hotlines</span>
              </div>
              <h1 className="text-[12vw] xl:text-[10vw] font-display font-black leading-[0.8] tracking-tighter text-neutral-900 uppercase italic">
                Direct <br />
                <span className="text-primary pr-12">Connect_</span>
              </h1>
              <p className="text-3xl text-neutral-500 font-medium leading-tight max-w-2xl italic">
                Connect with our senior dealing desk for immediate currency settlement and specialized corporate treasury support.
              </p>
            </div>
          </div>
        </section>

        {/* Dynamic Global Hubs */}
        <section className="py-60 red-gradient-texture text-white grain relative overflow-hidden">
           <div className="container px-4 lg:px-16 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1px] bg-white/10 border border-white/10 rounded-[5rem] overflow-hidden">
                 {hubs.map((hub, i) => (
                    <div key={hub.name} className="p-12 lg:p-24 bg-gradient-to-br from-red-900/20 to-black/30 backdrop-blur-3xl space-y-12 group hover:from-red-900/30 hover:to-black/40 transition-all duration-700">
                       <div className="flex justify-between items-start">
                          <div className="space-y-4">
                             <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/40">Hub_0{i+1}</span>
                             <h3 className="text-5xl lg:text-7xl font-display font-black italic uppercase leading-none">{hub.name}.</h3>
                          </div>
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center">
                             <MapPin className="w-8 h-8 text-primary" />
                          </div>
                       </div>
                       
                       <p className="text-2xl font-medium leading-relaxed italic opacity-80 max-w-md">"{hub.address}"</p>

                       <div className="space-y-8 pt-12 border-t border-white/5">
                          <div className="flex items-center gap-6">
                             <Clock className="w-6 h-6 text-primary" />
                             <span className="text-sm font-black uppercase tracking-widest">{hub.hours}</span>
                          </div>
                          <div className="flex items-center gap-6">
                             <Phone className="w-6 h-6 text-primary" />
                             <span className="text-sm font-black uppercase tracking-widest">{hub.phone}</span>
                          </div>
                       </div>

                       <div className="pt-12">
                          <a href={hub.maps} target="_blank" className="w-full h-20 bg-white text-primary rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-4 hover:scale-105 transition-transform shadow-2xl">
                             Locate Branch <ArrowRight className="w-4 h-4" />
                          </a>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* Institutional Inquiry Form */}
        <section className="py-60 bg-white grain overflow-hidden">
           <div className="container px-4 lg:px-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-24 items-start">
                 
                 {/* Form Descriptor */}
                 <div className="lg:col-span-12 xl:col-span-5 space-y-12">
                    <h2 className="text-6xl lg:text-8xl font-display font-black italic uppercase leading-[0.8] text-premium">Institutional <br /> Inquiry_</h2>
                    <p className="text-xl text-neutral-500 font-medium leading-relaxed max-w-sm">
                       For enterprise account openings, high-volume settlement requests, or compliance inquiries, please utilize the secure desk form.
                    </p>
                    <div className="space-y-6">
                       <div className="flex items-center gap-6 group">
                          <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center border border-black/5 group-hover:bg-primary transition-colors">
                             <MessageCircle className="w-6 h-6 text-neutral-400 group-hover:text-white" />
                          </div>
                          <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Response Time</span>
                             <p className="text-sm font-bold text-neutral-900 uppercase">Under 15 Minutes</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* High-End Form */}
                 <div className="lg:col-span-12 xl:col-span-7 bg-neutral-50 p-12 lg:p-24 rounded-[5rem] border border-black/5 shadow-2xl shadow-black/5">
                    <form className="space-y-12">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <div className="space-y-4">
                             <label className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-400 ml-4">Full Identity</label>
                             <input type="text" placeholder="Corporate or Individual Name" className="w-full h-20 bg-white border border-black/5 rounded-3xl px-8 focus:border-primary/40 outline-none transition-all font-medium" />
                          </div>
                          <div className="space-y-4">
                             <label className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-400 ml-4">Direct Contact</label>
                             <input type="email" placeholder="Email or Phone Number" className="w-full h-20 bg-white border border-black/5 rounded-3xl px-8 focus:border-primary/40 outline-none transition-all font-medium" />
                          </div>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-400 ml-4">Inquiry Subject</label>
                          <textarea placeholder="Nature of your inquiry (Exchange, Settlement, Partnership)" rows={5} className="w-full bg-white border border-black/5 rounded-[3rem] p-8 focus:border-primary/40 outline-none transition-all font-medium resize-none" />
                       </div>
                       <button className="w-full h-24 bg-neutral-900 text-white rounded-[3rem] font-black uppercase tracking-[0.4em] text-[10px] hover:bg-primary transition-all shadow-2xl shadow-black/20 flex items-center justify-center gap-4 group">
                          Dispatch to Dealing Desk
                          <Send className="w-4 h-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform" />
                       </button>
                    </form>
                 </div>

              </div>
           </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
