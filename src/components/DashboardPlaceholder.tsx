interface DashboardPlaceholderProps {
  title: string
  icon: string
  description: string
}

export default function DashboardPlaceholder({ title, icon, description }: DashboardPlaceholderProps) {
  return (
    <>
      <section>
        <h2 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-2">{title}</h2>
        <p className="text-[18px] leading-[1.6] text-on-surface-variant">{description}</p>
      </section>

      <section>
        <div className="bg-surface border border-outline-variant rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-primary">{icon}</span>
          </div>
          <h3 className="text-[24px] leading-[1.4] font-bold text-on-surface mb-2">Coming Soon</h3>
          <p className="text-[16px] leading-[1.6] text-on-surface-variant max-w-md">
            This section is under construction. Check back soon.
          </p>
        </div>
      </section>
    </>
  )
}