"use client"

import * as React from "react"
import { usePathname as useNextPathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { X, Globe, Search, ArrowRight } from "lucide-react"
import { Link, routing, usePathname, useRouter } from "@src/i18n/routing"
import { useLocale, useTranslations } from "next-intl"

export function Header() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("Navigation")

  const navLinks = [
    { name: t("home"), href: "/" },
    { name: t("about"), href: "/about" },
    { name: t("services"), href: "/services" },
    { name: t("contact"), href: "/contact" },
    { name: t("pusatKirimDuit"), href: "/pusat-kirim-duit" },
  ]

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as any })
  }

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] transition-all duration-700 flex items-center px-4 md:px-16 pointer-events-none h-32 bg-white/40 backdrop-blur-3xl border-b border-black/5 shadow-xl shadow-black/5",
          scrolled ? "h-24 bg-white/60" : "h-32"
        )}
      >
        <div className="container h-full flex items-center justify-between pointer-events-auto">
          
          <Link href="/" className="flex items-center group">
            <div className="relative w-36 md:w-48 group-hover:scale-105 transition-transform duration-700">
               <img 
                src="/images/logo/logo-red.png" 
                alt="Pusat Valas Indo" 
                className="w-full h-auto object-contain"
               />
            </div>
          </Link>

          <div className="flex items-center gap-8">
             <div className="hidden md:flex items-center gap-4 px-6 py-3 bg-neutral-900 text-white rounded-2xl shadow-xl hover:bg-primary transition-all group cursor-pointer">
                <span className="text-[10px] font-black uppercase tracking-widest">Connect Desk</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
             </div>
             
             <button
               className="p-4 bg-white rounded-3xl text-neutral-900 border border-black/5 shadow-xl hover:scale-110 active:scale-95 transition-all"
               onClick={() => setIsOpen(true)}
             >
               <div className="flex flex-col gap-1.5 w-6">
                  <div className="h-[2px] w-full bg-neutral-900" />
                  <div className="h-[2px] w-[60%] bg-primary self-end" />
               </div>
             </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 bg-white z-[200] flex flex-col p-12 lg:p-24 grain"
          >
            <div className="flex justify-between items-center mb-6">
               <span className="font-display font-black text-3xl italic">PVI<span className="text-primary">_</span></span>
               <button onClick={() => setIsOpen(false)} className="p-8 bg-neutral-900 text-white rounded-full hover:bg-primary transition-colors"><X className="w-8 h-8" /></button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
               <nav className="flex flex-col gap-2">
                 {navLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link
                        href={link.href as any}
                        className={cn(
                         "text-3xl sm:text-4xl lg:text-5xl xl:text-5xl font-display font-black italic tracking-tighter hover:text-primary transition-all uppercase leading-none block py-2",
                         pathname === link.href ? "text-primary" : "text-neutral-900"
                        )}
                        onClick={() => setIsOpen(false)}
                      >
                        {link.name}.
                      </Link>
                    </motion.div>
                 ))}
               </nav>

               <div className="hidden lg:flex flex-col justify-center gap-12 border-l border-black/5 pl-12 xl:pl-24">
                  <div className="space-y-4">
                     <span className="text-[10px] font-black uppercase tracking-[0.8em] text-primary">Direct_Inquiry</span>
                     <h3 className="text-5xl font-display font-black italic uppercase leading-tight text-neutral-900">Let's talk <br /> Treasury.</h3>
                  </div>
                  <div className="space-y-6">
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center border border-black/5"><Globe className="w-6 h-6 text-primary" /></div>
                        <p className="text-sm font-black uppercase tracking-widest text-neutral-500">Jakarta / Tangerang / ID</p>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center border border-black/5"><Search className="w-6 h-6 text-primary" /></div>
                        <p className="text-sm font-black uppercase tracking-widest text-neutral-500">Authorized BI No. 20/28</p>
                     </div>
                  </div>

                  <div className="pt-8">
                     <Link 
                       href="/dashboard"
                       onClick={() => setIsOpen(false)}
                       className="flex items-center gap-4 group"
                     >
                        <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                           <ArrowRight className="w-6 h-6" />
                         </div>
                         <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">System Access</span>
                            <p className="text-xl font-display font-black italic uppercase text-neutral-900">Admin Panel_</p>
                         </div>
                      </Link>
                   </div>
                </div>
            </div>

            <div className="mt-auto flex flex-col md:flex-row justify-between items-center gap-12 pt-12 border-t border-black/5">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-400 italic">Established in 2018 for the elite traders of Indonesia.</p>
                <div className="flex gap-4">
                   <button 
                    onClick={() => switchLocale('id')}
                    className={cn(
                      "px-6 py-2 rounded-full text-[10px] font-black transition-all",
                      locale === 'id' ? "bg-neutral-900 text-white" : "bg-transparent text-neutral-400 hover:text-neutral-900"
                    )}
                   >
                     ID
                   </button>
                   <button 
                    onClick={() => switchLocale('en')}
                    className={cn(
                      "px-6 py-2 rounded-full text-[10px] font-black transition-all",
                      locale === 'en' ? "bg-neutral-900 text-white" : "bg-transparent text-neutral-400 hover:text-neutral-900"
                    )}
                   >
                     EN
                   </button>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

