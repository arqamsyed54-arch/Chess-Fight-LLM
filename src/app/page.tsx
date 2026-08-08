import Link from 'next/link'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

const features = [
  {
    title: 'AI Paper Generation',
    description: 'Generate exam-ready question papers from uploaded books or notes using advanced AI.',
  },
  {
    title: 'Answer & Solution Papers',
    description: 'Every generation produces 3 documents: Question Paper, Answer Key, and Step-by-step Solutions.',
  },
  {
    title: '10,000+ Question Bank',
    description: 'Access curated, universally-recognized exam questions across all subjects.',
  },
  {
    title: 'Multi-Format Export',
    description: 'Download as print-ready PDF or editable DOCX files.',
  },
]

const steps = [
  { step: '1', title: 'Upload', description: 'Upload images of your book or notes' },
  { step: '2', title: 'Configure', description: 'Select subject, difficulty, and question types' },
  { step: '3', title: 'Generate', description: 'AI creates your complete exam package' },
  { step: '4', title: 'Download', description: 'Get Question, Answer, and Solution papers' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold text-blue-600">Exam Heal AI</span>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-slate-600 hover:text-slate-900">
                Sign In
              </Link>
              <Link href="/signup">
                <Button variant="accent" size="sm">Get Started Free</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 tracking-tight">
            Generate Exam Papers
            <span className="text-blue-600"> in Minutes</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            AI-powered platform that creates complete exam packages — Question Papers,
            Answer Keys, and Step-by-step Solutions — from your study materials.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link href="/signup">
              <Button variant="accent" size="lg">Generate Your First Paper Free</Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg">See How It Works</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Everything You Need
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6">
                <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-slate-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Start Free, Scale as You Grow
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            100 free credits monthly. Generate up to 2 papers. No credit card required.
          </p>
          <Link href="/signup">
            <Button variant="accent" size="lg">Get Started Free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-xl font-bold text-blue-600">Exam Heal AI</span>
            <div className="flex gap-6 text-slate-600">
              <Link href="/login" className="hover:text-slate-900">Sign In</Link>
              <Link href="/signup" className="hover:text-slate-900">Sign Up</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
