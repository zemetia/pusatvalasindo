"use client"

import React, { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  SendHorizontal,
  ShieldCheck,
  Globe,
  Clock,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  MapPin,
  Phone,
  Building2,
  FileText,
  CheckCircle2,
  ChevronDown,
  X,
  Menu,
  Banknote,
  Timer,
  Users,
} from "lucide-react"

// ─── Data ────────────────────────────────────────────────────────────────────

const destinations = [
  { flag: "🇺🇸", country: "Amerika Serikat", currency: "USD" },
  { flag: "🇯🇵", country: "Jepang", currency: "JPY" },
  { flag: "🇬🇧", country: "Inggris", currency: "GBP" },
  { flag: "🇪🇺", country: "Eropa", currency: "EUR" },
  { flag: "🇨🇭", country: "Swiss", currency: "CHF" },
  { flag: "🇳🇿", country: "Selandia Baru", currency: "NZD" },
  { flag: "🇨🇦", country: "Kanada", currency: "CAD" },
  { flag: "🇸🇬", country: "Singapura", currency: "SGD" },
  { flag: "🇭🇰", country: "Hong Kong", currency: "HKD" },
  { flag: "🇦🇺", country: "Australia", currency: "AUD" },
]

const fees = [
  {
    index: "01",
    label: "Di bawah USD 10.000",
    sublabel: "Full Amount",
    fee: "USD 40 + Rp 200.000",
    desc: "Penerima menerima penuh nominal yang dikirim tanpa potongan di sisi bank tujuan.",
    highlight: false,
  },
  {
    index: "02",
    label: "Di bawah USD 10.000",
    sublabel: "Non-Full Amount",
    fee: "USD 15 + Rp 200.000",
    desc: "Biaya bank tujuan akan dipotong dari jumlah yang diterima.",
    highlight: true,
  },
  {
    index: "03",
    label: "Di atas USD 10.000",
    sublabel: "Full & Non-Full",
    fee: "USD 40 / USD 15",
    desc: "Tanpa biaya tambahan lainnya. Full amount USD 40, non-full amount USD 15.",
    highlight: false,
  },
]

const steps = [
  {
    num: "01",
    title: "Hubungi via WhatsApp",
    desc: "Kirimkan permintaan transfer melalui WhatsApp. Bisa online, tidak perlu datang ke kantor.",
  },
  {
    num: "02",
    title: "Siapkan Dokumen",
    desc: "KTP + data penerima. Untuk nominal di atas USD 24.000, sertakan dokumen underlying.",
  },
  {
    num: "03",
    title: "Transfer Selesai",
    desc: "Estimasi 2–4 hari kerja. Penerima dapat mengambil dana di bank/ATM setempat.",
  },
]

const stats = [
  { icon: Globe, value: "10", label: "Negara Tujuan" },
  { icon: Banknote, value: "10", label: "Mata Uang" },
  { icon: Timer, value: "2–4", label: "Hari Kerja" },
  { icon: Users, value: "100%", label: "Berlisensi OJK" },
]

// ─── Sub-components ────────────────────────────────────────────────────────

function PKDHeader() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] h-24 bg-white/60 backdrop-blur-3xl border-b border-black/5 shadow-xl shadow-black/5 flex items-center px-4 md:px-16">
        <div className="container h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 bg-blue-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <SendHorizontal className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400">PT</p>
              <p className="text-sm font-black uppercase tracking-widest text-neutral-900 leading-none">Pusat Kirim Duit</p>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-neutral-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              ← PVI Group
            </Link>
            <a
              href="https://api.whatsapp.com/send?phone=6208777169020"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <button
              className="p-4 bg-white rounded-3xl border border-black/5 shadow-xl hover:scale-110 transition-transform"
              onClick={() => setIsOpen(true)}
            >
              <div className="flex flex-col gap-1.5 w-6">
                <div className="h-[2px] w-full bg-neutral-900" />
                <div className="h-[2px] w-[60%] bg-blue-700 self-end" />
              </div>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 bg-white z-[200] flex flex-col p-12 lg:p-24"
          >
            <div className="flex justify-between items-center mb-6">
              <span className="font-display font-black text-3xl italic">
                PKD<span className="text-blue-700">_</span>
              </span>
              <button onClick={() => setIsOpen(false)} className="p-8 bg-neutral-900 text-white rounded-full hover:bg-blue-700 transition-colors">
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6">
              {[
                { name: "Tujuan Transfer", href: "#destinations" },
                { name: "Biaya & Kurs", href: "#fees" },
                { name: "Cara Kirim", href: "#how-it-works" },
                { name: "Syarat & Dokumen", href: "#requirements" },
                { name: "Lokasi & Kontak", href: "#contact" },
              ].map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setIsOpen(false)}
                  className="text-3xl sm:text-4xl lg:text-5xl font-display font-black italic tracking-tighter hover:text-blue-700 transition-all uppercase leading-none block text-neutral-900 py-2"
                >
                  {link.name}.
                </motion.a>
              ))}
            </div>

            <div className="mt-auto pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-8">
              <Link href="/" className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-400 hover:text-primary transition-colors italic">
                ← Kembali ke Pusat Valas Indo
              </Link>
              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-300">PTD Terdaftar OJK</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PusatKirimDuitPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-blue-100 selection:text-blue-900">
      <PKDHeader />

      <main className="relative">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen bg-white text-neutral-900 overflow-hidden pt-48 lg:pt-60 grain">
          {/* Grid Accent */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 left-1/4 w-[1px] h-full bg-blue-100" />
            <div className="absolute top-0 left-2/4 w-[1px] h-full bg-blue-100" />
            <div className="absolute top-0 left-3/4 w-[1px] h-full bg-blue-100" />
          </div>

          <div className="container px-4 md:px-16 mx-auto relative z-10 min-h-screen flex flex-col justify-center">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 items-center">

              <div className="xl:col-span-8 flex flex-col gap-12 lg:gap-20 mb-20 xl:mb-0">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-6"
                >
                  <div className="w-16 h-[1px] bg-blue-700" />
                  <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-700">PTD Terdaftar OJK • Est. 2024</span>
                </motion.div>

                <div className="relative">
                  <motion.h1
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10vw] lg:text-[9vw] xl:text-[8vw] font-display font-black leading-[0.85] tracking-tighter text-neutral-900 uppercase italic"
                  >
                    Kirim <br />
                    Uang ke <br />
                    <span className="text-blue-700">Dunia_</span>
                  </motion.h1>

                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 12 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="absolute top-[5%] right-[0%] lg:right-[40%] bg-blue-700 text-white p-8 rounded-full shadow-[0_30px_60px_-15px_rgba(29,78,216,0.4)] flex flex-col items-center justify-center text-center w-36 h-36 lg:w-44 lg:h-44 border-[10px] border-white z-20"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">OJK</span>
                    <span className="text-[8px] opacity-70 font-bold uppercase text-center mt-1">Penyelenggara<br />Transfer<br />Dana</span>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col md:flex-row items-start gap-12 pt-8"
                >
                  <p className="text-2xl lg:text-3xl text-neutral-500 max-w-sm font-medium leading-[1.2] tracking-tight italic border-l-4 border-blue-700 pl-8">
                    Solusi pengiriman uang internasional untuk pengusaha Indonesia. Aman, transparan, real-time.
                  </p>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 bg-blue-700/20 rounded-full hover:bg-blue-700 transition-colors" />)}
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">10 Negara Tujuan</span>
                    </div>
                    <a
                      href="https://api.whatsapp.com/send?phone=6208777169020&text=Halo%20Pusat%20Kirim%20Duit%2C%20saya%20ingin%20tanya%20layanan%20transfer."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 group px-8 py-4 bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-all"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-[0.3em]">Hubungi via WhatsApp</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </a>
                  </div>
                </motion.div>
              </div>

              {/* Stats Card */}
              <div className="xl:col-span-4 flex justify-end">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="w-full max-w-sm bg-white border border-black/5 p-10 rounded-[4rem] shadow-[0_80px_100px_-40px_rgba(0,0,0,0.1)] space-y-8"
                >
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400">Quick_Stats</p>
                    <h3 className="text-3xl font-display font-black italic text-blue-700 uppercase">At a Glance</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {stats.map((s) => (
                      <div key={s.label} className="bg-blue-50 rounded-3xl p-6 space-y-3 border border-blue-100">
                        <s.icon className="w-6 h-6 text-blue-700" />
                        <div className="text-4xl font-display font-black text-neutral-900 leading-none">{s.value}</div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-black/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Senin–Jumat 08.00–16.30</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Destinations ──────────────────────────────────────────────── */}
        <section id="destinations" className="py-60 md:py-80 bg-[#0f1f4a] text-white grain relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[1px] h-full bg-white" />
            <div className="absolute top-0 left-3/4 w-[1px] h-full bg-white" />
          </div>

          <div className="container px-4 lg:px-16 mx-auto relative z-10">
            <div className="mb-48 space-y-12 max-w-4xl">
              <div className="flex items-center gap-8">
                <div className="w-16 h-[1px] bg-blue-400" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-400">Tujuan Pengiriman</span>
              </div>
              <h2 className="text-8xl md:text-[10vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-white">
                10 <br /><span className="text-white/30">Negara_</span>
              </h2>
              <p className="text-2xl text-white/60 max-w-xl leading-relaxed font-medium">
                Minimal pengiriman USD 1.000 (ekuivalen). Estimasi transfer 2–4 hari kerja.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {destinations.map((dest, i) => (
                <motion.div
                  key={dest.country}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center gap-6 text-center hover:border-blue-400/40 hover:bg-white/10 transition-all duration-500 group"
                >
                  <span className="text-5xl">{dest.flag}</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-1">{dest.currency}</p>
                    <p className="text-sm font-black uppercase tracking-wider text-white/80">{dest.country}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-32 flex flex-col md:flex-row gap-8 items-center justify-center">
              <div className="flex items-center gap-4 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">Estimasi 2–4 Hari Kerja</span>
              </div>
              <div className="flex items-center gap-4 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl">
                <Banknote className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">Minimal USD 1.000 Ekuivalen</span>
              </div>
              <div className="flex items-center gap-4 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">Kurs Real-Time</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-60 md:py-80 bg-white text-neutral-900 grain relative overflow-hidden">
          <div className="absolute left-[2%] top-0 text-[18vw] font-display font-black text-black/[0.02] uppercase italic pointer-events-none select-none leading-none">
            Steps_
          </div>

          <div className="container px-4 lg:px-16 mx-auto relative z-10">
            <div className="mb-48 space-y-12">
              <div className="flex items-center gap-8">
                <div className="w-16 h-[1px] bg-blue-700" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-700">Cara Kirim</span>
              </div>
              <h2 className="text-8xl md:text-[10vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-neutral-900">
                3 Langkah <br /><span className="text-neutral-300">Mudah_</span>
              </h2>
            </div>

            <div className="space-y-40 lg:space-y-24">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -80 : 80 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`flex flex-col lg:flex-row gap-12 lg:gap-32 items-center ${i % 2 !== 0 ? "lg:flex-row-reverse" : ""}`}
                >
                  <div className="flex-1 text-center lg:text-left">
                    <span className="text-[10px] font-black uppercase tracking-[0.8em] text-blue-700 mb-8 block">Langkah_{step.num}</span>
                    <div className="text-[20vw] lg:text-[12vw] font-display font-black italic leading-none text-blue-700/10 select-none">
                      {step.num}
                    </div>
                  </div>
                  <div className="flex-1 w-full max-w-2xl">
                    <div className="bg-neutral-50 border border-black/5 p-12 lg:p-16 rounded-[4rem] shadow-2xl shadow-black/5 space-y-8 hover:border-blue-700/20 transition-all duration-700">
                      <h3 className="text-4xl lg:text-5xl font-display font-black italic uppercase leading-none text-neutral-900">
                        {step.title}
                      </h3>
                      <p className="text-xl text-neutral-500 font-medium leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fee Structure ─────────────────────────────────────────────── */}
        <section id="fees" className="py-60 md:py-80 bg-neutral-50 text-neutral-900 grain relative overflow-hidden border-t border-black/5">
          <div className="container px-4 lg:px-16 mx-auto relative z-10">
            <div className="flex flex-col lg:flex-row items-baseline justify-between gap-12 border-b border-black/5 pb-24 mb-48">
              <div className="space-y-8">
                <div className="flex items-center gap-8">
                  <div className="w-16 h-[1px] bg-blue-700" />
                  <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-700">Biaya Transfer</span>
                </div>
                <h2 className="text-8xl md:text-[10vw] lg:text-[9vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-neutral-900">
                  Transparan_
                </h2>
              </div>
              <p className="text-xl lg:text-2xl text-neutral-400 font-medium max-w-xs leading-relaxed italic border-l-4 border-black/10 pl-8">
                Tidak ada biaya tersembunyi. Semua biaya tertera jelas di awal.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {fees.map((fee, i) => (
                <motion.div
                  key={fee.index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-[4rem] p-10 lg:p-12 border transition-all duration-500 ${
                    fee.highlight
                      ? "bg-blue-700 border-blue-700 text-white shadow-2xl shadow-blue-700/20 scale-105"
                      : "bg-white border-black/5 text-neutral-900 shadow-xl shadow-black/5 hover:border-blue-200"
                  }`}
                >
                  <div className={`text-[9px] font-black uppercase tracking-[0.8em] mb-8 ${fee.highlight ? "text-blue-200" : "text-blue-700"}`}>
                    Tier_{fee.index}
                  </div>
                  <h3 className={`text-3xl font-display font-black italic uppercase leading-tight mb-2 ${fee.highlight ? "text-white" : "text-neutral-900"}`}>
                    {fee.label}
                  </h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-10 ${fee.highlight ? "text-blue-200" : "text-neutral-400"}`}>
                    {fee.sublabel}
                  </p>
                  <div className={`text-4xl font-display font-black italic mb-8 ${fee.highlight ? "text-white" : "text-blue-700"}`}>
                    {fee.fee}
                  </div>
                  <p className={`text-base font-medium leading-relaxed ${fee.highlight ? "text-blue-100" : "text-neutral-500"}`}>
                    {fee.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Requirements ──────────────────────────────────────────────── */}
        <section id="requirements" className="py-60 md:py-80 bg-white text-neutral-900 grain relative overflow-hidden border-t border-black/5">
          <div className="container px-4 lg:px-16 mx-auto">
            <div className="mb-48 space-y-8">
              <div className="flex items-center gap-8">
                <div className="w-16 h-[1px] bg-blue-700" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-700">Persyaratan</span>
              </div>
              <h2 className="text-8xl md:text-[10vw] font-display font-black tracking-tighter italic uppercase leading-[0.8] text-neutral-900">
                Dokumen_
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">

              {/* Personal */}
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-neutral-50 border border-black/5 rounded-[4rem] p-12 lg:p-16 space-y-12 hover:border-blue-200 transition-all duration-700"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-50 rounded-[2rem] flex items-center justify-center border border-blue-100">
                    <FileText className="w-8 h-8 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-700">Tipe_01</p>
                    <h3 className="text-3xl font-display font-black italic uppercase">Pribadi</h3>
                  </div>
                </div>
                <div className="space-y-6">
                  {[
                    "KTP (wajib)",
                    "Underlying dokumen (wajib jika nominal di atas USD 24.000)",
                  ].map((doc) => (
                    <div key={doc} className="flex items-start gap-4">
                      <CheckCircle2 className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                      <span className="text-lg text-neutral-600 font-medium">{doc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Business */}
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-blue-700 text-white rounded-[4rem] p-12 lg:p-16 space-y-12 shadow-2xl shadow-blue-700/20"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/10 rounded-[2rem] flex items-center justify-center border border-white/20">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-200">Tipe_02</p>
                    <h3 className="text-3xl font-display font-black italic uppercase text-white">Perusahaan</h3>
                  </div>
                </div>
                <div className="space-y-6">
                  {[
                    "KTP Direktur",
                    "NIB Perusahaan",
                    "NPWP Perusahaan",
                    "Underlying dokumen (wajib)",
                  ].map((doc) => (
                    <div key={doc} className="flex items-start gap-4">
                      <CheckCircle2 className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                      <span className="text-lg text-blue-100 font-medium">{doc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="mt-24 p-10 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-6">
              <ShieldCheck className="w-8 h-8 text-blue-700 flex-shrink-0 mt-1" />
              <p className="text-base text-neutral-600 font-medium leading-relaxed">
                <strong className="text-blue-700 font-black">Bisa online:</strong> Transaksi dapat dilakukan via WhatsApp tanpa perlu datang ke kantor. Dokumen dikirimkan secara digital.
              </p>
            </div>
          </div>
        </section>

        {/* ── Contact / Location ────────────────────────────────────────── */}
        <section id="contact" className="py-60 md:py-80 bg-[#0f1f4a] text-white grain relative overflow-hidden border-t border-white/5">
          <div className="container px-4 lg:px-16 mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">

              <div className="space-y-16">
                <div className="space-y-8">
                  <div className="flex items-center gap-8">
                    <div className="w-16 h-[1px] bg-blue-400" />
                    <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-400">Lokasi & Kontak</span>
                  </div>
                  <h2 className="text-7xl md:text-8xl font-display font-black tracking-tighter italic uppercase leading-[0.8] text-white">
                    Temui <br /><span className="text-white/30">Kami_</span>
                  </h2>
                </div>

                <div className="space-y-8">
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 flex-shrink-0">
                      <MapPin className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-400 mb-2">Alamat</p>
                      <p className="text-xl font-medium text-white/80 leading-relaxed">
                        Green Lake City, Rukan Wall Street<br />
                        Blok A No. 16, Cipondoh<br />
                        Kota Tangerang, Banten 15147
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 flex-shrink-0">
                      <Clock className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-400 mb-2">Jam Operasional</p>
                      <p className="text-xl font-medium text-white/80">Senin–Jumat: 08.00–16.30</p>
                      <p className="text-xl font-medium text-white/80">Sabtu: 08.00–14.00</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 flex-shrink-0">
                      <Phone className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-400 mb-2">WhatsApp</p>
                      <p className="text-xl font-medium text-white/80">0877-7169-0203</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white/5 border border-white/10 rounded-[4rem] p-12 lg:p-16 space-y-12">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-400 mb-4">Mulai Sekarang</p>
                    <h3 className="text-5xl font-display font-black italic uppercase text-white leading-tight">
                      Kirim via <br /> WhatsApp
                    </h3>
                  </div>
                  <p className="text-xl text-white/60 font-medium leading-relaxed">
                    Tidak perlu datang ke kantor. Hubungi kami via WhatsApp dan proses transfer dimulai dari mana saja.
                  </p>
                  <a
                    href="https://api.whatsapp.com/send?phone=6208777169020&text=Halo%20Pusat%20Kirim%20Duit%2C%20saya%20ingin%20tanya%20layanan%20transfer."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-4 w-full h-20 bg-blue-700 text-white rounded-3xl font-black uppercase tracking-[0.4em] text-[10px] hover:bg-blue-600 transition-all shadow-xl shadow-blue-700/30 group"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat WhatsApp
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                  </a>
                  <a
                    href="https://maps.app.goo.gl/1SGvqb2UvqXpotfN9"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-4 w-full h-16 bg-white/10 border border-white/10 text-white rounded-3xl font-black uppercase tracking-[0.4em] text-[10px] hover:bg-white/20 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    Lihat di Google Maps
                  </a>
                </div>

                <div className="flex items-center gap-4 px-8 py-5 bg-white/5 border border-white/10 rounded-2xl">
                  <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
                    PT Pusat Kirim Duit — Penyelenggara Transfer Dana, OJK
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="bg-white text-neutral-900 py-20 border-t border-black/5">
          <div className="container px-4 lg:px-16 mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-blue-700 rounded-xl flex items-center justify-center">
                  <SendHorizontal className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400">Bagian dari</p>
                  <Link href="/" className="text-sm font-black uppercase tracking-widest text-neutral-900 hover:text-primary transition-colors">
                    Pusat Valas Indo Group
                  </Link>
                </div>
              </div>

              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-300 text-center">
                © 2024 PT Pusat Kirim Duit. PTD Terdaftar OJK. Est. 18 Juli 2024.
              </p>

              <Link
                href="/"
                className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-primary transition-colors flex items-center gap-2"
              >
                ← Kembali ke PVI
              </Link>
            </div>
          </div>
        </footer>
      </main>

      {/* Floating WhatsApp */}
      <div className="fixed bottom-8 right-8 z-[60]">
        <a
          href="https://api.whatsapp.com/send?phone=6208777169020&text=Halo%20Pusat%20Kirim%20Duit%2C%20saya%20ingin%20tanya%20layanan%20transfer."
          target="_blank"
          rel="noopener noreferrer"
          className="relative block"
        >
          <span className="absolute inset-0 bg-blue-700/20 rounded-full animate-ping pointer-events-none" />
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative bg-blue-700 text-white p-4 rounded-full shadow-2xl flex items-center justify-center"
          >
            <MessageCircle className="w-8 h-8 fill-white/10" />
          </motion.div>
        </a>
      </div>
    </div>
  )
}
