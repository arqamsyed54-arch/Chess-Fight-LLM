import Link from 'next/link'

const steps = [
  { icon: 'upload_file', title: '1. Upload Source', desc: 'Drag & drop PDFs, images, or paste text directly.' },
  { icon: 'settings_suggest', title: '2. Configure', desc: 'Set difficulty, question types, and curriculum alignment.' },
  { icon: 'auto_awesome', title: '3. AI Generate', desc: 'Our engine constructs robust questions and detailed solutions.', active: true },
  { icon: 'download', title: '4. Download Set', desc: 'Export Question, Answer, and Solution PDFs instantly.' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Nav */}
      <nav className="flex justify-between items-center px-4 md:px-8 w-full h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-bold text-primary">Exam Heal AI</span>
        </div>
        <div className="hidden md:flex gap-6">
          <a className="text-[14px] font-semibold text-primary border-b-2 border-primary pb-1" href="#">Product</a>
          <a className="text-[14px] font-semibold text-on-surface-variant hover:text-primary transition-colors pb-1" href="#features">Features</a>
          <a className="text-[14px] font-semibold text-on-surface-variant hover:text-primary transition-colors pb-1" href="#pricing">Pricing</a>
        </div>
        <div>
          <Link href="/signup" className="bg-primary-container text-on-primary-container text-[14px] font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity">
            Sign Up
          </Link>
        </div>
      </nav>

      <main className="max-w-[1280px] mx-auto w-full">
        {/* Hero */}
        <section className="relative pt-20 pb-20 px-4 md:px-8 flex flex-col md:flex-row items-center gap-6 overflow-hidden">
          <div className="absolute inset-0 bg-pattern opacity-40 -z-10"></div>
          <div className="flex-1 space-y-6">
            <h1 className="text-[48px] leading-[1.2] tracking-[-0.02em] font-extrabold text-on-surface">
              Generate <span className="text-primary">Exam-Ready Papers</span> in Minutes
            </h1>
            <p className="text-[18px] leading-[1.6] text-on-surface-variant max-w-xl">
              Empower your teaching with AI. Instantly create complete Question, Answer, and Solution papers from any source material. Ensure academic integrity without the friction.
            </p>
            <div className="flex gap-4 pt-4">
              <Link href="/signup" className="bg-secondary-container text-on-white flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-md">
                <span className="material-symbols-outlined icon-fill">auto_awesome</span>
                Generate Your First Paper Free
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <div className="aspect-[4/3] rounded-xl overflow-hidden border border-outline-variant shadow-lg bg-surface-container relative">
              <div className="absolute bottom-4 left-4 right-4 bg-surface/90 backdrop-blur-sm border border-outline-variant rounded-lg p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary icon-fill">description</span>
                  <div>
                    <p className="text-[12px] font-bold text-on-surface">Midterm_Physics_101.pdf</p>
                    <p className="text-xs text-on-surface-variant">Processing complete...</p>
                  </div>
                </div>
                <span className="bg-primary-container/10 text-primary px-2 py-1 rounded text-xs font-bold">Ready</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4 md:px-8 bg-surface-container-low rounded-3xl mx-4 my-10">
          <div className="text-center mb-12">
            <h2 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-4">From Syllabus to Exam in 4 Steps</h2>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant max-w-2xl mx-auto">A frictionless workflow designed for high-velocity content generation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-outline-variant -z-0"></div>
            {steps.map((s) => (
              <div key={s.title} className="flex flex-col items-center text-center relative z-10">
                <div className={`w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-6 shadow-sm ${s.active ? 'border border-primary shadow-[0_4px_12px_rgba(37,99,235,0.2)]' : 'border border-outline-variant'}`}>
                  <span className={`material-symbols-outlined text-4xl ${s.active ? 'text-secondary-container icon-fill' : 'text-primary'}`}>{s.icon}</span>
                </div>
                <h3 className="text-[24px] leading-[1.4] font-semibold mb-2">{s.title}</h3>
                <p className="text-[16px] leading-[1.6] text-on-surface-variant">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-20 px-4 md:px-8" id="features">
          <div className="mb-12">
            <h2 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-4">Intelligent Infrastructure for Educators</h2>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant max-w-2xl">Focus on teaching, not formatting. Our tools handle the heavy lifting.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            {/* Feature 1 - Large */}
            <div className="md:col-span-2 bg-surface-container-high rounded-2xl p-6 border border-outline-variant flex flex-col justify-between overflow-hidden relative group">
              <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary">document_scanner</span>
                </div>
                <h3 className="text-[24px] leading-[1.4] font-semibold mb-2">Advanced Image OCR</h3>
                <p className="text-[16px] leading-[1.6] text-on-surface-variant">Extract text and complex mathematical formulas directly from photos of textbooks or handwritten notes with pristine accuracy.</p>
              </div>
            </div>
            {/* Feature 2 */}
            <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center mb-4 border border-outline-variant">
                  <span className="material-symbols-outlined text-tertiary">database</span>
                </div>
                <h3 className="text-[24px] leading-[1.4] font-semibold mb-2">10,000+ Question Bank</h3>
                <p className="text-[16px] leading-[1.6] text-on-surface-variant">Access and remix a vast repository of peer-reviewed questions across disciplines.</p>
              </div>
            </div>
            {/* Feature 3 */}
            <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center mb-4 border border-outline-variant">
                  <span className="material-symbols-outlined text-tertiary">picture_as_pdf</span>
                </div>
                <h3 className="text-[24px] leading-[1.4] font-semibold mb-2">Multi-Format Export</h3>
                <p className="text-[16px] leading-[1.6] text-on-surface-variant">One click to generate PDF, Word, or LaTeX formats tailored to your institution&apos;s templates.</p>
              </div>
            </div>
            {/* Feature 4 - Large */}
            <div className="md:col-span-2 bg-inverse-surface text-on-primary rounded-2xl p-6 border border-outline-variant flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 rounded-lg bg-secondary-container/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-secondary-container icon-fill">psychology</span>
                </div>
                <h3 className="text-[24px] leading-[1.4] font-semibold mb-2 text-on-primary">Comprehensive AI Solutions</h3>
                <p className="text-[16px] leading-[1.6] text-on-tertiary-fixed">We don&apos;t just generate questions. Our AI crafts detailed step-by-step solutions and grading rubrics, ensuring academic integrity and saving you hours of grading.</p>
              </div>
              <div className="absolute right-[-10%] top-[-10%] w-64 h-64 bg-secondary-container/10 rounded-full blur-3xl"></div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant px-4 md:px-8 py-20 w-full grid grid-cols-1 md:grid-cols-4 gap-6 mt-20">
        <div className="col-span-1">
          <span className="text-[24px] font-bold text-primary mb-4 block">Exam Heal AI</span>
          <p className="text-[16px] leading-[1.6] text-on-surface-variant mt-2">&copy; 2024 Exam Heal AI. All rights reserved.</p>
        </div>
        <div className="flex flex-col gap-2">
          <a className="text-[16px] leading-[1.6] text-on-surface-variant hover:text-secondary transition-colors" href="#">Product</a>
          <a className="text-[16px] leading-[1.6] text-on-surface-variant hover:text-secondary transition-colors" href="#">Features</a>
        </div>
        <div className="flex flex-col gap-2">
          <a className="text-[16px] leading-[1.6] text-on-surface-variant hover:text-secondary transition-colors" href="#">Pricing</a>
          <a className="text-[16px] leading-[1.6] text-on-surface-variant hover:text-secondary transition-colors" href="#">Privacy</a>
        </div>
        <div className="flex flex-col gap-2">
          <a className="text-[16px] leading-[1.6] text-on-surface-variant hover:text-secondary transition-colors" href="#">Terms</a>
          <a className="text-[16px] leading-[1.6] text-on-surface-variant hover:text-secondary transition-colors" href="#">Contact</a>
        </div>
      </footer>
    </div>
  )
}
