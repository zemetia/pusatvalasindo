import { Link } from "@src/i18n/routing"
import { Landmark, ArrowUpRight, Instagram, Facebook, Globe, Phone, Mail } from "lucide-react"

const footerLinks = [
  { name: "Beranda", href: "/" },
  { name: "Tentang", href: "/about" },
  { name: "Layanan", href: "/services" },
  { name: "Kontak", href: "/contact" },
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
]

export function Footer() {
  return (
    <footer className="bg-white text-neutral-900 pt-60 pb-20 border-t border-black/5 grain relative overflow-hidden">
      
      {/* Extreme Branding Background Removed */}

      <div className="container px-4 lg:px-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-24 lg:gap-12">
          
          {/* Brand Focus */}
          <div className="lg:col-span-6 space-y-16">
            <Link href="/" className="flex flex-col gap-6 group">
              <div className="relative w-64 md:w-80 group-hover:scale-110 transition-transform duration-700">
                 <img 
                  src="/images/logo/logo-red.png" 
                  alt="Pusat Valas Indo" 
                  className="w-full h-auto object-contain"
                 />
              </div>
            </Link>
            
            <p className="text-3xl font-display font-black italic text-neutral-400 max-w-md leading-tight uppercase">
              Jakarta's elite currency gateway. <br />
              Secure. Licensed. Direct.
            </p>

            <div className="flex gap-12 text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300">
               <div className="space-y-4">
                  <span className="text-primary">Socials_</span>
                  <div className="flex gap-6 text-neutral-900">
                    <Instagram className="w-5 h-5 hover:text-primary cursor-pointer transition-colors" />
                    <Facebook className="w-5 h-5 hover:text-primary cursor-pointer transition-colors" />
                  </div>
               </div>
               <div className="space-y-4">
                  <span className="text-primary">Desk_</span>
                  <div className="flex gap-6 text-neutral-900">
                    <Phone className="w-5 h-5 hover:text-primary cursor-pointer transition-colors" />
                    <Mail className="w-5 h-5 hover:text-primary cursor-pointer transition-colors" />
                  </div>
               </div>
            </div>
          </div>

          {/* Massive Links System */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-12">
               {footerLinks.map((link) => (
                 <Link 
                  key={link.name} 
                  href={link.href} 
                  className="group flex flex-col gap-2 border-b border-black/5 pb-8 hover:border-primary transition-colors"
                 >
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.4em] mb-4">Nav_0{footerLinks.indexOf(link)+1}</span>
                    <div className="flex items-center justify-between">
                       <span className="text-5xl font-display font-black italic uppercase group-hover:text-primary transition-colors">{link.name}.</span>
                       <ArrowUpRight className="w-8 h-8 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-500" />
                    </div>
                 </Link>
               ))}
            </div>
          </div>
        </div>

        {/* Legal Strip */}
        <div className="mt-60 pt-16 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-12">
           <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex items-center gap-4">
                 <Globe className="w-4 h-4 text-primary" />
                 <span className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400 italic">PT Pusat Valas Indo _ Est 2018</span>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-300">
                 Bank Indonesia License No. 20/28/KEP.GBI/DKSP/2018
              </p>
           </div>
           <p className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400 text-center md:text-right">
             © 2025 PT Pusat Valas Indo. <br className="md:hidden" /> Designed by Zharkwave.
           </p>
        </div>
      </div>
    </footer>
  )
}
