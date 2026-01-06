import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import { getRecommendedResources } from "./utils/reportContent";

export default function Resources() {
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
          <p className="text-gray-300 text-lg">Loading resources...</p>
        </div>
      </div>
    );
  }

  const recommendedResources = enhancedScores ? getRecommendedResources(enhancedScores) : [];

  // Group resources by type
  const resourcesByType = recommendedResources.reduce((acc, resource) => {
    const type = resource.type || 'other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(resource);
    return acc;
  }, {});

  const typeLabels = {
    download: 'Downloads',
    session: 'Sessions',
    video: 'Video Series',
    webinar: 'Webinars',
    podcast: 'Podcasts',
    program: 'Programs',
    newsletter: 'Newsletters',
    analysis: 'Analysis Tools',
    other: 'Other Resources'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 py-12 lg:py-16 shadow-none">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Recommended Resources
          </h1>
          <p className="text-xl text-emerald-50">
            Explore these resources to help strengthen your business based on your assessment results
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        {recommendedResources.length === 0 ? (
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              No Resources Available
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Complete your Business Health Check assessment to get personalized resource recommendations.
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
        ) : (
          <div className="space-y-8">
            {Object.keys(resourcesByType).map((type) => (
              <section key={type} className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800">
                    {typeLabels[type] || type}
                  </span>
                  <span className="text-gray-400 font-normal text-base">
                    ({resourcesByType[type].length} {resourcesByType[type].length === 1 ? 'resource' : 'resources'})
                  </span>
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {resourcesByType[type].map((resource, index) => (
                    <a
                      key={index}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        // Handle resource click
                      }}
                      className="group p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                            <svg
                              className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors"
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
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                            {resource.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                            {resource.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              {resource.type}
                            </span>
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
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

