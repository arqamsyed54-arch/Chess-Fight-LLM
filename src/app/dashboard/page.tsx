import Card from '@/components/ui/Card'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-slate-500">Papers Generated</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-sm font-medium text-slate-500">Credits Remaining</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">100</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-sm font-medium text-slate-500">Current Plan</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">Free</p>
        </Card>
      </div>
      
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <a
            href="/dashboard/generate"
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Generate Paper
          </a>
          <a
            href="/dashboard/question-bank"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Browse Question Bank
          </a>
        </div>
      </Card>
    </div>
  )
}
