export const dynamic = 'force-dynamic'

import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background text-on-surface h-full flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col md:ml-64 min-h-screen h-screen overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
          <div className="max-w-[1280px] mx-auto space-y-20">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
