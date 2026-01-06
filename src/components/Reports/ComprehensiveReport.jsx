import CategoryReportCard from './CategoryReportCard';
import HealthLevelBadge from './HealthLevelBadge';
import {
  generateActionItems,
  getRecommendedResources,
} from '../../utils/reportContent';

/**
 * Comprehensive Report Component
 * Full report view combining all categories
 */
export default function ComprehensiveReport({ enhancedScores }) {
  if (!enhancedScores) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <p className="text-gray-500">No assessment data available.</p>
      </div>
    );
  }

  const actionItems = generateActionItems(enhancedScores);
  const recommendedResources = getRecommendedResources(enhancedScores);
  const overallHealth = enhancedScores.overallHealth;

  const categoryKeys = Object.keys(enhancedScores).filter(
    (key) => key !== 'overallHealth'
  );

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Executive Summary
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Overall Business Health
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-5xl font-extrabold text-gray-900">
                {overallHealth?.percentage || 0}%
              </span>
              {overallHealth && (
                <HealthLevelBadge level={overallHealth.healthLevel} size="lg" />
              )}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Assessment Overview
            </h3>
            <p className="text-gray-600">
              Your business has been evaluated across{' '}
              {overallHealth?.categoryCount || 0} key performance areas. Review
              the detailed breakdown below to understand your strengths and
              areas for improvement.
            </p>
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Category-by-Category Breakdown
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {categoryKeys.map((key) => (
            <CategoryReportCard
              key={key}
              categoryKey={key}
              analytics={enhancedScores[key]}
            />
          ))}
        </div>
      </section>

      {/* Priority Action Items */}
      {actionItems.length > 0 && (
        <section className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Priority Action Items
          </h2>
          <p className="text-gray-600 mb-6">
            Based on your assessment, here are the areas that need immediate
            attention:
          </p>
          <div className="space-y-4">
            {actionItems.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {item.categoryLabel}
                    </h4>
                    <p className="text-gray-700 text-sm mb-2">{item.message}</p>
                    {item.resources && item.resources.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          Quick Actions:
                        </p>
                        <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                          {item.resources.map((resource, rIndex) => (
                            <li key={rIndex}>{resource.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Next Steps */}
      <section className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-3xl font-bold mb-4">Next Steps</h2>
        <p className="mb-6 text-emerald-50">
          Ready to take action? Schedule a consultation with one of our
          assessment strategists to develop a customized plan for your business
          growth.
        </p>
        <button className="bg-white text-emerald-600 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition-colors">
          Schedule Assessment Debrief
        </button>
      </section>
    </div>
  );
}

