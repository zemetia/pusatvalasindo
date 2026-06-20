import { Header } from "@/components/premium/Header"
import { Hero } from "@/components/premium/Hero"
import { TrustLogos } from "@/components/premium/TrustLogos"
import { ExchangeRates } from "@/components/premium/ExchangeRates"
import { Features } from "@/components/premium/Features"
import { Companies } from "@/components/premium/Companies"
import { Locations } from "@/components/premium/Locations"
import { Testimonials } from "@/components/premium/Testimonials"
import { Footer } from "@/components/premium/Footer"
import { WhatsAppCTA } from "@/components/premium/WhatsAppCTA"
import { getExchangeRates } from "@/lib/rates"
import { getTranslations } from 'next-intl/server'

export default async function page() {
  const rates = await getExchangeRates()
  const t = await getTranslations('HomePage')

  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20 selection:text-primary grain">
      <Header />

      <main className="relative">
        <Hero rates={rates} />
        <TrustLogos />
        <ExchangeRates rates={rates} />
        <Features />
        
        <Companies />

        <div className="bg-white">
          <Locations />
          <Testimonials />
        </div>

        {/* Improved Final CTA (Light/High-end) */}
        <section className="py-40 bg-white text-neutral-900 overflow-hidden relative border-t border-black/5">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 to-transparent pointer-events-none" />
          <div className="container relative z-10 text-center space-y-16 px-4">
            <h2 className="text-6xl md:text-9xl font-display font-black tracking-tighter italic text-premium">
               Ready for <br /> Best Margins?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
               <a 
                href="https://api.whatsapp.com/send?phone=6281770099920"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
               >
                <button className="bg-primary text-white font-black px-12 h-20 rounded-[2rem] text-sm uppercase tracking-[0.3em] hover:scale-110 transition-transform shadow-2xl shadow-primary/20 w-full sm:w-auto">
                  Contact Dealing Desk
                </button>
               </a>
                <a href="#locations" className="w-full sm:w-auto">
                  <button className="bg-neutral-50 border border-black/5 hover:bg-neutral-100 text-neutral-500 font-bold px-12 h-20 rounded-[2rem] text-xs uppercase tracking-widest transition-all w-full sm:w-auto">
                    View Our Branches
                  </button>
                </a>
            </div>
            <p className="text-neutral-400 text-[10px] font-black uppercase tracking-[0.5em] pt-12">
               Licensed by BANK INDONESIA • Safe & Secure
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppCTA />
    </div>
  )
}


