"use client"

import React from "react"
import { Link } from "@src/i18n/routing"
import { motion } from "framer-motion"
import { ArrowUpRight, Landmark, Globe, SendHorizontal, ShieldCheck, ExternalLink } from "lucide-react"

const companies = [
  {
    index: "01",
    abbr: "PVI",
    name: "Pusat Valas Indo",
    tagline: "Money Changer",
    est: "Est. 2018",
    license: "BI No. 20/28/KEP.GBI/DKSP/2018",
    desc: "Penukaran valuta asing premium di Jakarta & Tangerang. Kurs kompetitif, real-time, tanpa biaya tersembunyi.",
    tags: ["USD/IDR", "EUR/IDR", "SGD/IDR", "JPY/IDR", "+20 Mata Uang"],
    href: "/",
    cta: "Lihat Kurs Live",
    accent: {
      text: "text-primary",
      bg: "bg-primary/5",
      border: "border-primary/20",
      badge: "bg-primary text-white",
      dot: "bg-primary",
      icon: "text-primary",
    },
    Icon: Landmark,
  },
  {
    index: "02",
    abbr: "PTU",
    name: "Pusat Tukar Uang",
    tagline: "Money Changer",
    est: "Tangerang",
    license: "BI Authorized • KUPVA BB",
    desc: "Layanan penukaran valuta asing di Tangerang dengan pelayanan profesional dan rate terbaik.",
    tags: ["USD/IDR", "SGD/IDR", "EUR/IDR", "MYR/IDR", "HKD/IDR"],
    href: null,
    cta: "Cabang Sister",
    accent: {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-500 text-white",
      dot: "bg-amber-500",
      icon: "text-amber-600",
    },
    Icon: Globe,
  },
  {
    index: "03",
    abbr: "PKD",
    name: "Pusat Kirim Duit",
    tagline: "International Remittance",
    est: "Est. Jul 2024",
    license: "PTD Terdaftar • OJK",
    desc: "Kirim uang internasional ke 10 negara untuk pengusaha Indonesia. Aman, transparan, berlisensi OJK.",
    tags: ["Amerika", "Jepang", "Eropa", "Australia", "+6 Negara"],
    href: "/pusat-kirim-duit",
    cta: "Pelajari Layanan",
    accent: {
      text: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-700 text-white",
      dot: "bg-blue-700",
      icon: "text-blue-700",
    },
    Icon: SendHorizontal,
  },
]

export function Companies() {
  return (
    <section className="py-60 md:py-80 bg-neutral-50 text-neutral-900 overflow-hidden grain relative border-t border-black/5">
      <div className="absolute left-[2%] top-0 text-[18vw] font-display font-black text-black/[0.02] uppercase italic pointer-events-none select-none leading-none">
        Group_
      </div>

      <div className="container px-4 lg:px-16 mx-auto relative z-10">

        {/* Section Header */}
        <div className="flex flex-col lg:flex-row items-baseline justify-between gap-12 border-b border-black/5 pb-24 mb-48">
          <div className="space-y-8">
            <div className="flex items-center gap-8">
              <div className="w-16 h-[1px] bg-primary" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-primary">Our Ecosystem</span>
            </div>
            <h2 className="text-8xl md:text-[10vw] lg:text-[9vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-neutral-900">
              3 Perusahaan_
            </h2>
          </div>
          <p className="text-xl lg:text-2xl text-neutral-400 font-medium max-w-sm leading-relaxed italic border-l-4 border-black/10 pl-8">
            Grup layanan keuangan terpercaya untuk kebutuhan valuta asing dan transfer dana internasional.
          </p>
        </div>

        {/* Company Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {companies.map((co, i) => (
            <motion.div
              key={co.abbr}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`relative group rounded-[4rem] border ${co.href ? "cursor-pointer" : "cursor-default"} border-black/5 bg-white p-10 lg:p-12 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 transition-all duration-700 flex flex-col`}
            >
              {/* Index + Badge */}
              <div className="flex items-start justify-between mb-12">
                <span className={`text-[9px] font-black uppercase tracking-[0.8em] ${co.accent.text} opacity-60`}>
                  Company_{co.index}
                </span>
                <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${co.accent.badge}`}>
                  {co.tagline}
                </span>
              </div>

              {/* Icon */}
              <div className={`w-20 h-20 rounded-[2rem] ${co.accent.bg} flex items-center justify-center mb-10 border ${co.accent.border}`}>
                <co.Icon className={`w-10 h-10 ${co.accent.icon}`} />
              </div>

              {/* Name */}
              <div className="mb-6">
                <div className={`text-[10px] font-black uppercase tracking-[0.6em] ${co.accent.text} mb-2`}>{co.est}</div>
                <h3 className="text-4xl lg:text-5xl font-display font-black italic uppercase leading-none text-neutral-900 group-hover:opacity-80 transition-opacity">
                  {co.abbr}
                  <span className={`${co.accent.text}`}>_</span>
                </h3>
                <p className="text-lg font-bold text-neutral-400 uppercase tracking-[0.3em] mt-2">{co.name}</p>
              </div>

              {/* Description */}
              <p className="text-base text-neutral-500 font-medium leading-relaxed mb-8 flex-1">
                {co.desc}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-10">
                {co.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-3 py-1 rounded-xl ${co.accent.bg} ${co.accent.text} text-[9px] font-black uppercase tracking-wider border ${co.accent.border}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* License */}
              <div className="flex items-center gap-3 pb-10 border-b border-black/5 mb-10">
                <ShieldCheck className={`w-4 h-4 ${co.accent.icon} flex-shrink-0`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{co.license}</span>
              </div>

              {/* CTA */}
              {co.href ? (
                <Link
                  href={co.href}
                  className={`flex items-center justify-between group/btn`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${co.accent.text}`}>
                    {co.cta}
                  </span>
                  <div className={`w-10 h-10 rounded-xl ${co.accent.bg} border ${co.accent.border} flex items-center justify-center group-hover/btn:scale-110 transition-transform`}>
                    <ArrowUpRight className={`w-5 h-5 ${co.accent.icon}`} />
                  </div>
                </Link>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-300">
                    {co.cta}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-black/5 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-neutral-300" />
                  </div>
                </div>
              )}

              {/* Hover Accent Line */}
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-0 group-hover:w-[60%] ${co.accent.dot} rounded-full transition-all duration-700`} />
            </motion.div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="mt-32 flex flex-col md:flex-row items-center justify-center gap-12 text-center">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-400">
              Seluruh entitas beroperasi di bawah naungan grup yang sama
            </span>
            <div className="w-2 h-2 rounded-full bg-blue-700 animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  )
}
