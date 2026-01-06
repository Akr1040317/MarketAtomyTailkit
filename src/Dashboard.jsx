import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import { generateActionItems, getRecommendedResources } from "./utils/reportContent";
import HealthLevelBadge from "./components/Reports/HealthLevelBadge";

// Constants for category configuration
const CATEGORIES = {
  foundationalStructure: {
    label: "Foundational Structure",
    color: "bg-blue-600",
  },
  financialPosition: {
    label: "Financial Strength",
    color: "bg-emerald-600",
  },
  salesMarketing: {
    label: "Sales & Marketing",
    color: "bg-purple-600",
  },
  productService: {
    label: "Product Viability",
    color: "bg-amber-500",
  },
  general: {
    label: "Overall Health",
    color: "bg-teal-600",
  },
};

const CATEGORY_ORDER = Object.keys(CATEGORIES);

// Score Card Component
const ScoreCard = ({ analytics, label, colorClass }) => {
  const percentage = analytics?.percentage || 0;
  const healthLevel = analytics?.healthLevel || 'low';
  
  return (
    <div className="relative flex flex-col p-6 bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="text-4xl font-extrabold text-gray-900">{percentage}%</div>
      <div className="text-base font-medium text-gray-500 mt-2">{label}</div>
      <div className="mt-3">
        <HealthLevelBadge level={healthLevel} size="sm" />
      </div>
      <div className="w-full bg-gray-100 h-3 rounded-full mt-4 overflow-hidden">
        <div
          className={`${colorClass} h-3 rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
};

// Roadmap Step Component
const RoadmapStep = ({ step, label, isActive }) => (
  <div className="flex flex-col items-center">
    <div
      className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${
        isActive ? "bg-emerald-500 text-white shadow-md" : "bg-gray-300 text-gray-600"
      }`}
    >
      {step}
    </div>
    <span className="mt-4 text-base font-medium text-gray-300">{label}</span>
  </div>
);

export default function Dashboard({ onNavigateToReports, onNavigateToResources }) {
  const [computedScores, setComputedScores] = useState(null);
  const [enhancedScores, setEnhancedScores] = useState(null);
  const [completedSections, setCompletedSections] = useState([]);
  const [totalSections, setTotalSections] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch user's computed scores and progress
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        // Fetch user document
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const rawScores = userData.computedScores || {};
          setComputedScores(rawScores);
          
          // Process scores with analytics
          const processed = processComputedScores(rawScores);
          setEnhancedScores(processed);
          
          // Get last updated timestamp
          if (userData.overallHealth?.lastCalculated) {
            setLastUpdated(userData.overallHealth.lastCalculated.toDate());
          }
        }

        // Fetch completed sections
        const sectionResultsQuery = query(
          collection(db, "sectionResults"),
          where("userId", "==", user.uid)
        );
        const sectionResultsSnapshot = await getDocs(sectionResultsQuery);
        const completed = sectionResultsSnapshot.docs.map(
          (docSnap) => docSnap.data().sectionName
        );
        setCompletedSections([...new Set(completed)]);

        // Fetch total sections count
        const sectionsQuery = query(collection(db, "BHC_Assessment"));
        const sectionsSnapshot = await getDocs(sectionsQuery);
        setTotalSections(sectionsSnapshot.size);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [user]);

  // Get analytics for a category
  const getAnalytics = (categoryKey) =>
    enhancedScores?.[categoryKey] || null;

  // Calculate assessment completion percentage
  const completionPercentage = totalSections > 0 
    ? Math.round((completedSections.length / totalSections) * 100)
    : 0;

  // Check if assessment is completed
  const isAssessmentComplete = completedSections.length === totalSections && totalSections > 0;

  // Get priority action items
  const actionItems = enhancedScores ? generateActionItems(enhancedScores) : [];
  
  // Get top recommended resources (limit to 3)
  const recommendedResources = enhancedScores 
    ? getRecommendedResources(enhancedScores).slice(0, 3)
    : [];

  // Generate dynamic next steps based on assessment status and scores
  const getNextSteps = () => {
    if (!isAssessmentComplete) {
      return [
        `Complete remaining ${totalSections - completedSections.length} assessment sections`,
        "Review your answers for accuracy",
        "Submit all sections to generate your full report"
      ];
    }

    if (actionItems.length > 0) {
      return actionItems.slice(0, 3).map((item, index) => {
        const categoryLabel = item.categoryLabel;
        if (item.resources && item.resources.length > 0) {
          return `Focus on ${categoryLabel}: ${item.resources[0].title}`;
        }
        return `Address ${categoryLabel} - Review recommendations in full report`;
      });
    }

    // If all categories are healthy
    if (enhancedScores?.overallHealth?.healthLevel === 'high') {
      return [
        "Maintain your strong business foundation",
        "Explore growth opportunities and expansion",
        "Schedule periodic reassessments to track progress"
      ];
    }

    return [
      "Review your comprehensive report for detailed insights",
      "Schedule an Assessment Debrief with a coach",
      "Implement recommended action items from your report"
    ];
  };

  // Determine roadmap progress
  const getRoadmapProgress = () => {
    if (!isAssessmentComplete) {
      return [
        { step: 1, label: "Assessment", active: completedSections.length > 0 },
        { step: 2, label: "Analysis", active: false },
        { step: 3, label: "Strategy", active: false },
        { step: 4, label: "Implementation", active: false },
        { step: 5, label: "Growth", active: false },
      ];
    }

    // Assessment complete, show progress based on scores
    const overallHealth = enhancedScores?.overallHealth;
    const hasLowScores = actionItems.length > 0;
    
    return [
      { step: 1, label: "Assessment", active: true },
      { step: 2, label: "Analysis", active: true },
      { step: 3, label: "Strategy", active: hasLowScores || overallHealth?.healthLevel !== 'high' },
      { step: 4, label: "Implementation", active: false },
      { step: 5, label: "Growth", active: false },
    ];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 p-6 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Introduction Section */}
        <section className="bg-white rounded-2xl shadow-xl p-10 transition-all duration-300">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Business Health Check Assessment
          </h1>
          <p className="mt-5 text-lg text-gray-600 leading-relaxed">
            The Business Health Check (BHC) Assessment evaluates your business
            across 21 critical Key Performance Indicators (KPIs) grouped into five
            interdependent systems: Foundational Structure, Financial Strength,
            Sales & Marketing, Product Viability, and Overall Health. This
            comprehensive analysis identifies strengths and gaps, providing
            actionable recommendations to drive growth and customer engagement.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {isAssessmentComplete ? (
              <span className="bg-emerald-500 text-white px-5 py-2 rounded-full text-base font-semibold shadow-sm">
                Assessment Completed
              </span>
            ) : (
              <span className="bg-yellow-500 text-white px-5 py-2 rounded-full text-base font-semibold shadow-sm">
                Assessment In Progress ({completionPercentage}%)
              </span>
            )}
            {lastUpdated && (
              <span className="text-base text-gray-500">
                Last Updated: {lastUpdated.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            )}
            {!isAssessmentComplete && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Navigate to assessment
                  window.location.hash = "#assessment";
                }}
                className="text-emerald-600 hover:text-emerald-700 font-semibold underline"
              >
                Continue Assessment →
              </a>
            )}
          </div>
        </section>

        {/* Scores Section */}
        <section className="bg-white rounded-2xl shadow-xl p-10">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            Your Business Health Scores
          </h2>
          <p className="mt-3 text-lg text-gray-600 leading-relaxed">
            Review your performance across key business areas.
          </p>
          {!enhancedScores ? (
            <p className="mt-6 text-lg text-gray-500 animate-pulse">Loading scores...</p>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
                {CATEGORY_ORDER.map((key) => (
                  <ScoreCard
                    key={key}
                    analytics={getAnalytics(key)}
                    label={CATEGORIES[key].label}
                    colorClass={CATEGORIES[key].color}
                  />
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button
                  onClick={() => {
                    if (onNavigateToReports) {
                      onNavigateToReports();
                    }
                  }}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors shadow-lg hover:shadow-xl"
                >
                  View Full Report
                </button>
                <button
                  onClick={async () => {
                    if (!enhancedScores) return;
                    const { downloadPDFReport } = await import('./utils/pdfGenerator');
                    const auth = getAuth();
                    const user = auth.currentUser;
                    const userDocRef = doc(db, "users", user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    const userData = userDocSnap.exists() ? userDocSnap.data() : {};
                    await downloadPDFReport(enhancedScores, {
                      firstName: userData.firstName || '',
                      email: user?.email || '',
                    });
                  }}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Print Full Report
                </button>
              </div>
            </>
          )}
        </section>

        {/* Next Steps & Placeholder */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white rounded-2xl shadow-xl p-10">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Detailed Insights
            </h2>
            <p className="mt-3 text-lg text-gray-600 leading-relaxed">
              {isAssessmentComplete && enhancedScores ? (
                <>
                  {actionItems.length > 0 ? (
                    <>
                      Your assessment reveals <strong>{actionItems.length} priority area{actionItems.length > 1 ? 's' : ''}</strong> that need immediate attention. 
                      Click "View Full Report" above to see comprehensive analysis, category-by-category breakdown, 
                      and actionable recommendations tailored to your scores.
                    </>
                  ) : (
                    <>
                      Your business shows strong health across all categories! 
                      Click "View Full Report" above to see detailed insights and explore growth opportunities.
                    </>
                  )}
                </>
              ) : enhancedScores ? (
                <>
                  You've completed {completedSections.length} of {totalSections} sections. 
                  Complete your assessment to unlock comprehensive insights and personalized recommendations.
                </>
              ) : (
                "Complete your assessment to see detailed insights and recommendations."
              )}
            </p>
          </div>
          <div className="md:col-span-1">
            <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
              Next Steps
            </h2>
            <div className="bg-gray-800/50 backdrop-blur-sm p-7 rounded-xl text-gray-100 space-y-5">
              {getNextSteps().map((step, index) => (
                <div
                  key={index}
                  className="flex items-start text-base font-medium transition-colors hover:text-emerald-400"
                >
                  <span className="mr-4 text-emerald-400 font-bold text-lg flex-shrink-0">
                    {index + 1}.
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap Section */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
            Your Growth Roadmap
          </h2>
          <div className="bg-gray-800/50 backdrop-blur-sm p-10 rounded-xl flex items-center justify-between relative">
            {getRoadmapProgress().map(({ step, label, active }, index, arr) => (
              <React.Fragment key={step}>
                <RoadmapStep step={step} label={label} isActive={active} />
                {index < arr.length - 1 && (
                  <div className="h-1.5 bg-gray-600/50 flex-1 mx-6 rounded-full relative">
                    <div
                      className={`absolute h-1.5 rounded-full transition-all duration-500 ${
                        active ? "bg-emerald-500 w-full" : "bg-transparent w-0"
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Resources Section */}
        {recommendedResources.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
              Recommended Resources
            </h2>
            <p className="text-gray-400 mb-6">
              Based on your assessment results, here are resources tailored to your business needs:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {recommendedResources.map((resource, index) => (
                <a
                  key={index}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigateToResources) {
                      onNavigateToResources();
                    }
                  }}
                  className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl text-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:bg-gray-700/50 border border-gray-700 hover:border-emerald-500"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-xl text-white">{resource.title}</h3>
                    <svg
                      className="w-5 h-5 text-gray-400 flex-shrink-0"
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
                  <p className="text-base text-gray-300 mt-3 leading-relaxed">{resource.description}</p>
                  <div className="mt-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
                      {resource.type}
                    </span>
                  </div>
                </a>
              ))}
            </div>
            {recommendedResources.length >= 3 && (
              <div className="mt-6 text-center">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigateToResources) {
                      onNavigateToResources();
                    }
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
                >
                  View All Resources →
                </a>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}