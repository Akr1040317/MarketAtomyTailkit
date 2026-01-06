import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import ComprehensiveReport from "./components/Reports/ComprehensiveReport";
import HealthLevelBadge from "./components/Reports/HealthLevelBadge";
import { CATEGORY_RANGES } from "./utils/scoreRanges";

export default function Reports() {
  const [computedScores, setComputedScores] = useState(null);
  const [enhancedScores, setEnhancedScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch user's computed scores
  useEffect(() => {
    const fetchUserScores = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };

    fetchUserScores();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-300 text-lg">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (!enhancedScores || !computedScores) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 p-6 lg:p-12">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <svg
              className="mx-auto h-24 w-24 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              No Assessment Data Available
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Complete your Business Health Check assessment to generate your comprehensive report.
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = "#assessment";
              }}
              className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
            >
              Start Assessment
            </a>
          </div>
        </div>
      </div>
    );
  }

  const overallHealth = enhancedScores.overallHealth;
  const categoryKeys = Object.keys(enhancedScores).filter(
    (key) => key !== "overallHealth"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 py-12 lg:py-16 shadow-none">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                Business Health Check Report
              </h1>
              <p className="text-xl text-emerald-50 mb-6">
                Comprehensive analysis of your business performance across key areas
              </p>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
                  <div className="text-sm text-emerald-100 mb-1">Overall Health Score</div>
                  <div className="text-4xl font-bold text-white">
                    {overallHealth?.percentage || 0}%
                  </div>
                </div>
                {overallHealth && (
                  <HealthLevelBadge level={overallHealth.healthLevel} size="lg" />
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="text-sm text-emerald-100 mb-3">Assessment Date</div>
                <div className="text-2xl font-semibold text-white">
                  {new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 -mt-8 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6">
            {categoryKeys.map((key) => {
              const analytics = enhancedScores[key];
              const categoryRange = CATEGORY_RANGES[key];
              if (!analytics || !categoryRange) return null;
              
              // Color based on health level
              const colorClasses = {
                high: {
                  bg: 'bg-gradient-to-br from-green-500/20 to-emerald-600/20',
                  border: 'border-green-500/50',
                  text: 'text-green-400',
                  progress: 'bg-green-500',
                  glow: 'shadow-green-500/20'
                },
                medium: {
                  bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20',
                  border: 'border-yellow-500/50',
                  text: 'text-yellow-400',
                  progress: 'bg-yellow-500',
                  glow: 'shadow-yellow-500/20'
                },
                low: {
                  bg: 'bg-gradient-to-br from-red-500/20 to-rose-600/20',
                  border: 'border-red-500/50',
                  text: 'text-red-400',
                  progress: 'bg-red-500',
                  glow: 'shadow-red-500/20'
                }
              };
              
              const colors = colorClasses[analytics.healthLevel] || colorClasses.low;
              
              return (
                <div
                  key={key}
                  className={`relative text-center p-5 rounded-xl border ${colors.bg} ${colors.border} hover:scale-105 transition-all duration-300 ${colors.glow} shadow-lg hover:shadow-xl`}
                >
                  {/* Percentage Display */}
                  <div className="mb-3">
                    <div className={`text-4xl font-extrabold ${colors.text} mb-1`}>
                      {analytics.percentage}%
                    </div>
                    <div className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                      {categoryRange.label}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-700/50 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-1000 ease-out ${colors.progress}`}
                        style={{ width: `${Math.min(100, analytics.percentage)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Health Badge */}
                  <div className="flex justify-center">
                    <HealthLevelBadge level={analytics.healthLevel} size="sm" />
                  </div>
                  
                  {/* Score Details */}
                  <div className="mt-3 pt-3 border-t border-gray-600/50">
                    <div className="text-xs text-gray-400">
                      Score: <span className="text-gray-300 font-semibold">{analytics.rawScore}</span> / <span className="text-gray-300 font-semibold">{analytics.maxPossible}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Report Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <ComprehensiveReport enhancedScores={enhancedScores} />
      </div>

      {/* Footer CTA */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">
              Ready to Take Action?
            </h3>
            <p className="text-emerald-50 mb-6 max-w-2xl mx-auto">
              Schedule a consultation with one of our assessment strategists to develop
              a customized plan for your business growth.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="bg-white text-emerald-600 px-8 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-lg">
                Schedule Assessment Debrief
              </button>
              <button className="bg-white/20 backdrop-blur-sm text-white border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors">
                Download PDF Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

