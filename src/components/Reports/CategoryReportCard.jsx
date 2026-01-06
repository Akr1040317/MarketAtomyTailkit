import HealthLevelBadge from './HealthLevelBadge';
import { getCategoryReport } from '../../utils/reportContent';
import { getCategoryRange } from '../../utils/scoreRanges';

/**
 * Category Report Card Component
 * Displays detailed analysis for a single category
 */
export default function CategoryReportCard({ categoryKey, analytics }) {
  if (!analytics) return null;

  const categoryRange = getCategoryRange(categoryKey);
  const report = getCategoryReport(categoryKey, analytics.healthLevel);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {categoryRange?.label || categoryKey}
          </h3>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-3xl font-extrabold text-gray-900">
              {analytics.percentage}%
            </span>
            <HealthLevelBadge level={analytics.healthLevel} />
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Score: {analytics.rawScore} / {analytics.maxPossible}</span>
          <span>{analytics.percentage}%</span>
        </div>
        <div className="mt-2 w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              analytics.healthLevel === 'high'
                ? 'bg-green-500'
                : analytics.healthLevel === 'medium'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, analytics.percentage)}%` }}
          />
        </div>
      </div>

      {/* Report Message */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed">{report.message}</p>
      </div>

      {/* Resources */}
      {report.resources && report.resources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Recommended Resources:
          </h4>
          <div className="space-y-2">
            {report.resources.map((resource, index) => (
              <a
                key={index}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Handle resource click - could navigate to resources page
                }}
                className="group flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all duration-200"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {resource.title}
                  </div>
                  {resource.description && (
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {resource.description}
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      {resource.type}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

