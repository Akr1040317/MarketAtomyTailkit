import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
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

export default function Dashboard({ onNavigateToReports }) {
  const [computedScores, setComputedScores] = useState(null);
  const [enhancedScores, setEnhancedScores] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch user's computed scores
  useEffect(() => {
    const fetchUserScores = async () => {
      if (!user) return;
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const rawScores = userData.computedScores || {};
          setComputedScores(rawScores);
          
          // Process scores with analytics
          const processed = processComputedScores(rawScores);
          setEnhancedScores(processed);
        }
      } catch (error) {
        console.error("Error fetching user scores:", error);
      }
    };

    fetchUserScores();
  }, [user]);

  // Get analytics for a category
  const getAnalytics = (categoryKey) =>
    enhancedScores?.[categoryKey] || null;

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
          <div className="mt-7 flex items-center space-x-4">
            <span className="bg-emerald-500 text-white px-5 py-2 rounded-full text-base font-semibold shadow-sm">
              Assessment Completed
            </span>
            <span className="text-base text-gray-500">
              Last Updated: Jan 15, 2025
            </span>
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
              <div className="mt-6 flex justify-end">
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
              {enhancedScores ? (
                <>
                  Click "View Full Report" above or navigate to the Reports page 
                  to see comprehensive analysis, category-by-category breakdown, 
                  priority action items, and recommended resources tailored to your 
                  assessment scores.
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
              {[
                "Schedule Marketing Strategy Session",
                "Complete Product Analysis",
                "Finalize Assessment Review",
              ].map((step, index) => (
                <div
                  key={index}
                  className="flex items-center text-base font-medium transition-colors hover:text-emerald-400"
                >
                  <span className="mr-4 text-emerald-400 font-bold text-lg">
                    {index + 1}.
                  </span>
                  <span>{step}</span>
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
            {[
              { step: 1, label: "Assessment", active: true },
              { step: 2, label: "Analysis", active: true },
              { step: 3, label: "Strategy", active: true },
              { step: 4, label: "Implementation", active: false },
              { step: 5, label: "Growth", active: false },
            ].map(({ step, label, active }, index, arr) => (
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
        <section>
          <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">
            Recommended Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Customer Magnet Series",
                desc: "5-step vision clarification video series",
              },
              {
                title: "Side Hustle Guide",
                desc: "Essential steps to maximize your hustle",
              },
              {
                title: "Strategy Session",
                desc: "Work with a mentor to finalize your plan",
              },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl text-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:bg-gray-700/50"
              >
                <h3 className="font-semibold text-xl text-white">{title}</h3>
                <p className="text-base text-gray-300 mt-3 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}