import Link from 'next/link'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <nav className="flex justify-between items-center px-4 md:px-8 w-full h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <Link href="/" className="text-[24px] font-bold text-primary">Exam Heal AI</Link>
        <div className="hidden md:flex gap-6">
          <Link href="/features" className="text-[14px] font-semibold text-on-surface-variant hover:text-primary transition-colors pb-1">Features</Link>
          <Link href="/pricing" className="text-[14px] font-semibold text-primary border-b-2 border-primary pb-1">Pricing</Link>
          <Link href="/dashboard" className="text-[14px] font-semibold text-on-surface-variant hover:text-primary transition-colors pb-1">Dashboard</Link>
        </div>
        <Link href="/signup" className="bg-primary-container text-on-primary-container text-[14px] font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity">
          Sign Up
        </Link>
      </nav>

      <main className="max-w-[1280px] mx-auto px-4 md:px-8 pt-16 pb-20">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-[48px] leading-[1.2] tracking-[-0.02em] font-extrabold text-on-surface mb-6">Simple, transparent pricing</h1>
          <p className="text-[18px] leading-[1.6] text-on-surface-variant">Choose the plan that best fits your needs. Whether you&apos;re a single educator or a large institution, we have you covered.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 flex flex-col">
            <h3 className="text-[24px] leading-[1.4] font-semibold text-on-surface">Free</h3>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant mt-2">Basic features for personal use.</p>
            <div className="mt-6 mb-6">
              <span className="text-[48px] leading-[1.2] font-extrabold text-on-surface">$0</span>
              <span className="text-[16px] text-on-surface-variant ml-1">/mo</span>
            </div>
            <div className="inline-flex items-center bg-primary-container/10 text-primary px-3 py-1 rounded-full text-[12px] font-bold">
              <span className="material-symbols-outlined text-[16px] mr-1">toll</span> 50 Credits / mo
            </div>
            <p className="text-sm text-on-surface-variant mt-2 mb-6">~ 5 Papers</p>
            <ul className="flex-grow space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Standard generation</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Basic templates</span>
              </li>
            </ul>
            <Link href="/signup" className="w-full bg-surface text-primary border border-primary text-[14px] font-semibold py-3 rounded-lg text-center hover:bg-primary-container/10 transition-colors mt-auto">Get Started</Link>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 flex flex-col">
            <h3 className="text-[24px] leading-[1.4] font-semibold text-on-surface">Student</h3>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant mt-2">Enhanced limits for active learners.</p>
            <div className="mt-6 mb-6">
              <span className="text-[48px] leading-[1.2] font-extrabold text-on-surface">$9</span>
              <span className="text-[16px] text-on-surface-variant ml-1">/mo</span>
            </div>
            <div className="inline-flex items-center bg-primary-container/10 text-primary px-3 py-1 rounded-full text-[12px] font-bold">
              <span className="material-symbols-outlined text-[16px] mr-1">toll</span> 250 Credits / mo
            </div>
            <p className="text-sm text-on-surface-variant mt-2 mb-6">~ 25 Papers</p>
            <ul className="flex-grow space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Priority generation</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">All templates</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Export to PDF/Word</span>
              </li>
            </ul>
            <Link href="/signup" className="w-full bg-surface text-primary border border-primary text-[14px] font-semibold py-3 rounded-lg text-center hover:bg-primary-container/10 transition-colors mt-auto">Subscribe</Link>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border-2 border-primary relative p-6 flex flex-col shadow-[0_12px_32px_rgba(15,23,42,0.1)] md:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-on-primary px-4 py-1 rounded-full text-[12px] font-bold uppercase tracking-wide shadow-md">
              Most Popular
            </div>
            <h3 className="text-[24px] leading-[1.4] font-semibold text-on-surface mt-2">Teacher</h3>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant mt-2">The perfect balance for busy educators.</p>
            <div className="mt-6 mb-6">
              <span className="text-[48px] leading-[1.2] font-extrabold text-on-surface">$29</span>
              <span className="text-[16px] text-on-surface-variant ml-1">/mo</span>
            </div>
            <div className="inline-flex items-center bg-primary-container/10 text-primary px-3 py-1 rounded-full text-[12px] font-bold">
              <span className="material-symbols-outlined text-[16px] mr-1">toll</span> 1000 Credits / mo
            </div>
            <p className="text-sm text-on-surface-variant mt-2 mb-6">~ 100 Papers</p>
            <ul className="flex-grow space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Unlimited generation</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">AI Grading Assistant</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Plagiarism checking</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Advanced analytics</span>
              </li>
            </ul>
            <Link href="/signup" className="w-full bg-primary text-on-primary text-[14px] font-semibold py-3 rounded-lg text-center hover:bg-primary/90 transition-colors mt-auto shadow-md">Get Teacher Plan</Link>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 flex flex-col">
            <h3 className="text-[24px] leading-[1.4] font-semibold text-on-surface">School</h3>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant mt-2">For departments and small schools.</p>
            <div className="mt-6 mb-6">
              <span className="text-[48px] leading-[1.2] font-extrabold text-on-surface">$99</span>
              <span className="text-[16px] text-on-surface-variant ml-1">/mo</span>
            </div>
            <div className="inline-flex items-center bg-primary-container/10 text-primary px-3 py-1 rounded-full text-[12px] font-bold">
              <span className="material-symbols-outlined text-[16px] mr-1">toll</span> 5000 Credits / mo
            </div>
            <p className="text-sm text-on-surface-variant mt-2 mb-6">~ 500 Papers</p>
            <ul className="flex-grow space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Up to 10 Teacher Seats</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Shared resource pool</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Admin dashboard</span>
              </li>
            </ul>
            <Link href="/signup" className="w-full bg-surface text-primary border border-primary text-[14px] font-semibold py-3 rounded-lg text-center hover:bg-primary-container/10 transition-colors mt-auto">Subscribe</Link>
          </div>

          <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 flex flex-col">
            <h3 className="text-[24px] leading-[1.4] font-semibold text-on-surface">Institution</h3>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant mt-2">Custom solutions for large organizations.</p>
            <div className="mt-6 mb-6">
              <span className="text-[48px] leading-[1.2] font-extrabold text-on-surface">Custom</span>
            </div>
            <div className="inline-flex items-center bg-primary-container/10 text-primary px-3 py-1 rounded-full text-[12px] font-bold">
              <span className="material-symbols-outlined text-[16px] mr-1">all_inclusive</span> Unlimited Credits
            </div>
            <p className="text-sm text-on-surface-variant mt-2 mb-6">Unlimited Papers</p>
            <ul className="flex-grow space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Unlimited seats</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Custom integrations (LMS)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 icon-fill">check_circle</span>
                <span className="text-[16px] text-on-surface">Dedicated success manager</span>
              </li>
            </ul>
            <button className="w-full bg-surface text-on-surface border border-outline text-[14px] font-semibold py-3 rounded-lg hover:bg-surface-container transition-colors mt-auto">Contact Sales</button>
          </div>
        </div>
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant px-4 md:px-8 py-20 w-full grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <span className="text-[24px] font-bold text-primary block mb-4">Exam Heal AI</span>
          <p className="text-[16px] text-on-surface-variant">&copy; 2024 Exam Heal AI. All rights reserved.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/features" className="text-[16px] text-on-surface-variant hover:text-secondary transition-colors">Features</Link>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/pricing" className="text-[16px] text-on-surface-variant hover:text-secondary transition-colors">Pricing</Link>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/signup" className="text-[16px] text-on-surface-variant hover:text-secondary transition-colors">Sign Up</Link>
        </div>
      </footer>
    </div>
  )
}