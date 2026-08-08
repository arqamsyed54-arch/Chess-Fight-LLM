import Link from 'next/link'

const features = [
  { icon: 'document_scanner', title: 'Advanced Image OCR', desc: 'Extract text and complex mathematical formulas directly from photos of textbooks or handwritten notes with pristine accuracy.' },
  { icon: 'database', title: '10,000+ Question Bank', desc: 'Access and remix a vast repository of peer-reviewed questions across disciplines.' },
  { icon: 'picture_as_pdf', title: 'Multi-Format Export', desc: 'One click to generate PDF, Word, or LaTeX formats tailored to your institution\'s templates.' },
  { icon: 'psychology', title: 'Comprehensive AI Solutions', desc: 'We don\'t just generate questions. Our AI crafts detailed step-by-step solutions and grading rubrics.' },
  { icon: 'auto_awesome', title: 'Three-Paper Output', desc: 'Every generation produces a Question Paper, Answer Key, and Solution Paper.' },
  { icon: 'speed', title: 'Difficulty Control', desc: 'Six calibrated levels from Easy to Extra Hard, plus Practice/Exam/National-level purposes.' },
  { icon: 'view_quilt', title: 'Template Gallery', desc: 'School letterhead, board-exam style, minimalist — pick a layout or skip to default.' },
  { icon: 'hub', title: 'MCP & API Access', desc: 'Drive paper generation from external AI agents via MCP, or build with our public REST API.' },
  { icon: 'analytics', title: 'Analytics Dashboard', desc: 'Usage trends, subject-wise breakdowns, and question-type distribution over time.' },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <nav className="flex justify-between items-center px-4 md:px-8 w-full h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <Link href="/" className="text-[24px] font-bold text-primary">Exam Heal AI</Link>
        <div className="hidden md:flex gap-6">
          <Link href="/features" className="text-[14px] font-semibold text-primary border-b-2 border-primary pb-1">Features</Link>
          <Link href="/pricing" className="text-[14px] font-semibold text-on-surface-variant hover:text-primary transition-colors pb-1">Pricing</Link>
          <Link href="/dashboard" className="text-[14px] font-semibold text-on-surface-variant hover:text-primary transition-colors pb-1">Dashboard</Link>
        </div>
        <Link href="/signup" className="bg-primary-container text-on-primary-container text-[14px] font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity">
          Sign Up
        </Link>
      </nav>

      <main className="max-w-[1280px] mx-auto px-4 md:px-8 pt-16 pb-20">
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-[48px] leading-[1.2] tracking-[-0.02em] font-extrabold text-on-surface mb-6">Everything You Need to Teach</h1>
          <p className="text-[18px] leading-[1.6] text-on-surface-variant">Intelligent infrastructure for educators. Focus on teaching, not formatting.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary-container/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary">{f.icon}</span>
              </div>
              <h3 className="text-[24px] leading-[1.4] font-semibold text-on-surface mb-2">{f.title}</h3>
              <p className="text-[16px] leading-[1.6] text-on-surface-variant">{f.desc}</p>
            </div>
          ))}
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