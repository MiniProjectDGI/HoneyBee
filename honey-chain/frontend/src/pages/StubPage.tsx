import { Link } from 'react-router-dom';

interface StubPageProps {
  title: string;
  description?: string;
  apiInfo?: string;
}

/**
 * StubPage — properly shows what the page is for and what API endpoint it consumes.
 * Never shows fake data — shows the empty state and infrastructure that's ready.
 */
export default function StubPage({ title, description, apiInfo }: StubPageProps) {

  const content = (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mx-auto mb-5">🏗️</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{title}</h1>
        {description && <p className="text-slate-500 text-sm mb-5 max-w-md mx-auto">{description}</p>}

        <div className="bg-slate-50 rounded-xl p-4 text-left mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Implementation Status</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-slate-600">Database schema ready (Prisma models defined)</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-slate-600">Backend service layer ready</span>
          </div>
          {apiInfo && (
            <div className="flex items-start gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-1" />
              <span className="text-xs text-slate-600">
                API: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-xs">{apiInfo}</code>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-slate-600">Frontend UI in progress — connect to real data</span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Link
            to="/dashboard"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );

  // If in dashboard context, don't wrap in layout (ProtectedRoute already does)
  return content;
}
