'use client'

export default function TopBar() {
  return (
    <header className="bg-surface border-b border-outline-variant h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h2 className="text-[24px] leading-[1.4] font-bold hidden sm:block">Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        {/* Credits Badge */}
        <div className="flex items-center gap-3 bg-primary-container/10 px-4 py-1.5 rounded-full border border-primary-fixed-dim">
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Credits Remaining</span>
            <span className="text-[16px] font-bold text-primary leading-none mt-1">4,850</span>
          </div>
          <button className="bg-primary text-on-primary px-3 py-1 rounded-full text-[12px] font-bold hover:opacity-90 transition-opacity">
            Top Up
          </button>
        </div>
        <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary-container rounded-full border-2 border-surface"></span>
        </button>
      </div>
    </header>
  )
}
