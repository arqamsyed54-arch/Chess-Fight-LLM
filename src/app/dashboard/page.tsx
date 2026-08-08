import Link from 'next/link'

const recentPapers = [
  { title: 'Advanced Thermodynamics Midterm', code: 'PHYS-302', date: 'Oct 24, 2024' },
  { title: 'Intro to Computer Science Final', code: 'CS-101', date: 'Oct 20, 2024' },
  { title: 'Modern History Essay Prompts', code: 'HIST-204', date: 'Oct 15, 2024' },
]

const subjects = [
  { name: 'Physics', pct: 45, color: 'bg-primary' },
  { name: 'Computer Sci', pct: 35, color: 'bg-secondary-container' },
  { name: 'History', pct: 20, color: 'bg-tertiary' },
]

export default function DashboardPage() {
  return (
    <>
      {/* Welcome */}
      <section>
        <h2 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-2">Hello, Professor Smith!</h2>
        <p className="text-[18px] leading-[1.6] text-on-surface-variant">Welcome back. Ready to craft some brilliant assessments today?</p>
      </section>

      {/* Quick Actions */}
      <section>
        <h3 className="text-[20px] font-bold text-on-surface mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Generate */}
          <Link href="/dashboard/generate" className="group bg-surface border border-outline-variant rounded-2xl p-6 flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary-container/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-secondary-container/10 text-secondary-container flex items-center justify-center mb-4">
                <span className="material-symbols-outlined icon-fill">auto_awesome</span>
              </div>
              <h4 className="text-[18px] font-bold mb-2">Generate New Paper</h4>
              <p className="text-sm text-on-surface-variant">Use AI to create a comprehensive exam from your syllabus in minutes.</p>
            </div>
            <div className="mt-6 flex items-center text-secondary-container text-[14px] font-bold group-hover:gap-2 transition-all">
              Start Wizard <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </Link>

          {/* Question Bank */}
          <Link href="/dashboard/question-bank" className="group bg-surface border border-outline-variant rounded-2xl p-6 flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-1 transition-all cursor-pointer">
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined icon-fill">search</span>
              </div>
              <h4 className="text-[18px] font-bold mb-2">Search Question Bank</h4>
              <p className="text-sm text-on-surface-variant">Browse over 50,000 peer-reviewed questions by topic and difficulty.</p>
            </div>
            <div className="mt-6 flex items-center text-primary text-[14px] font-bold group-hover:gap-2 transition-all">
              Browse Bank <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </Link>

          {/* AI Support */}
          <Link href="/dashboard/support" className="group bg-surface border border-outline-variant rounded-2xl p-6 flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-1 transition-all cursor-pointer">
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container text-tertiary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined icon-fill">support_agent</span>
              </div>
              <h4 className="text-[18px] font-bold mb-2">Request AI Support</h4>
              <p className="text-sm text-on-surface-variant">Need help drafting a specific complex scenario? Chat with our specialist AI.</p>
            </div>
            <div className="mt-6 flex items-center text-tertiary text-[14px] font-bold group-hover:gap-2 transition-all">
              Open Chat <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent & Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        {/* Recent Generations */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[20px] font-bold text-on-surface">Recent Generations</h3>
            <button className="text-primary text-[14px] font-bold hover:underline">View All</button>
          </div>
          <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(15,23,42,0.02)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant text-[12px] font-bold uppercase tracking-wider">
                  <th className="p-4">Subject / Title</th>
                  <th className="p-4 hidden sm:table-cell">Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentPapers.map((paper) => (
                  <tr key={paper.code} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="p-4">
                      <div className="font-semibold text-on-surface">{paper.title}</div>
                      <div className="text-sm text-outline">{paper.code}</div>
                    </td>
                    <td className="p-4 text-on-surface-variant hidden sm:table-cell">{paper.date}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgba(34,197,94,0.1)] text-[#15803d] text-xs font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span> Completed
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-colors" title="Questions">Q</button>
                        <button className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-colors" title="Answers">A</button>
                        <button className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-colors" title="Solutions">S</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Usage Overview */}
        <section className="lg:col-span-1">
          <h3 className="text-[20px] font-bold text-on-surface mb-6">Usage Overview</h3>
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-[0_4px_12px_rgba(15,23,42,0.02)] space-y-6">
            {/* Monthly Stat */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[14px] font-semibold text-on-surface-variant">Papers This Month</span>
                <span className="text-[24px] font-bold text-primary">12</span>
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
              <div className="text-right mt-1">
                <span className="text-[10px] font-bold text-outline">Target: 20</span>
              </div>
            </div>
            <hr className="border-outline-variant" />
            {/* Subject Distribution */}
            <div>
              <span className="text-[14px] font-semibold text-on-surface-variant mb-4 block">Subject Distribution</span>
              <div className="space-y-3">
                {subjects.map((s) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${s.color}`}></div>
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
