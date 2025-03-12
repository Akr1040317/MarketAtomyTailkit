import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export default function Dashboard() {
  const [computedScores, setComputedScores] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch user's computed scores from Firestore
  useEffect(() => {
    async function fetchUserScores() {
      if (!user) return;
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.computedScores) {
            setComputedScores(userData.computedScores);
          }
        }
      } catch (error) {
        console.error("Error fetching user scores:", error);
      }
    }

    fetchUserScores();
  }, [user]);

  // Helper function to safely get a score (returns 0 if not found)
  const getScore = (categoryKey) => {
    return computedScores && computedScores[categoryKey]
      ? computedScores[categoryKey].total
      : 0;
  };

  // Category definitions
  const categoryLabels = {
    foundationalStructure: "Foundational Structure",
    financialPosition: "Financial Strength",
    salesMarketing: "Sales & Marketing",
    productService: "Product Viability",
    general: "Overall Health",
  };

  // You can adjust these colors to match your design or dynamically choose colors
  const categoryColors = {
    foundationalStructure: "bg-green-500",
    financialPosition: "bg-green-500",
    salesMarketing: "bg-red-500",
    productService: "bg-yellow-500",
    general: "bg-red-500",
  };

  // Order in which to display the categories
  const categories = [
    "foundationalStructure",
    "financialPosition",
    "salesMarketing",
    "productService",
    "general",
  ];

  // Score Card Component
  function ScoreCard({ score, label, colorClass }) {
    return (
      <div className="p-4 bg-white rounded-lg shadow border border-gray-100">
        <div className="text-2xl font-bold text-gray-800">{score}%</div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-2">
          <div
            className={`${colorClass} h-2 rounded-full`}
            style={{ width: `${score}%` }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101b31] min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header / Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <h1 className="text-2xl font-bold text-white">
            Welcome to Your Business Health Dashboard
          </h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-4">
            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Assessment Completed
            </span>
            <span className="text-sm text-gray-200">Last Updated: Jan 15, 2025</span>
          </div>
        </div>
        <p className="text-gray-300">
          Your assessment shows both strengths and areas for improvement. Let’s work
          together to optimize your business health.
        </p>

        {/* Business Health Scores (new format) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900">Business Health Scores</h2>

          {!computedScores && (
            <p className="text-gray-500 mt-4">Loading scores...</p>
          )}

          {computedScores && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {categories.map((catKey) => {
                const score = getScore(catKey);
                const label = categoryLabels[catKey];
                const colorClass = categoryColors[catKey];
                return (
                  <ScoreCard
                    key={catKey}
                    score={score}
                    label={label}
                    colorClass={colorClass}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {/* Placeholder or Additional Content */}
          </div>
          <div className="md:col-span-1 space-y-4">
            <h2 className="text-xl font-bold text-white">Next Steps</h2>
            <div className="bg-gray-900 p-4 rounded-lg text-gray-100 space-y-2">
              <div className="flex items-center">
                <span className="mr-2">1.</span>
                <span>Schedule Marketing Strategy Session</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">2.</span>
                <span>Complete Product Analysis</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">3.</span>
                <span>Final Assessment Complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* Business Growth Roadmap */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">
            Your Business Growth Roadmap
          </h2>
          <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-gray-100">
              <div className="bg-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                1
              </div>
              <span className="mt-2">Assessment</span>
            </div>
            <div className="h-0.5 bg-gray-600 flex-1 mx-2"></div>
            {/* Step 2 */}
            <div className="flex flex-col items-center text-gray-100">
              <div className="bg-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                2
              </div>
              <span className="mt-2">Analysis</span>
            </div>
            <div className="h-0.5 bg-gray-600 flex-1 mx-2"></div>
            {/* Step 3 */}
            <div className="flex flex-col items-center text-gray-100">
              <div className="bg-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                3
              </div>
              <span className="mt-2">Strategy</span>
            </div>
            <div className="h-0.5 bg-gray-600 flex-1 mx-2"></div>
            {/* Step 4 */}
            <div className="flex flex-col items-center text-gray-100">
              <div className="bg-gray-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                4
              </div>
              <span className="mt-2">Implementation</span>
            </div>
            <div className="h-0.5 bg-gray-600 flex-1 mx-2"></div>
            {/* Step 5 */}
            <div className="flex flex-col items-center text-gray-100">
              <div className="bg-gray-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                5
              </div>
              <span className="mt-2">Growth</span>
            </div>
          </div>
        </div>

        {/* Recommended Resources */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Recommended Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-900 p-4 rounded-lg text-gray-100">
              <h3 className="font-semibold text-lg">Customer Magnet Series</h3>
              <p className="text-sm text-gray-300 mt-2">
                5-step vision clarification video series
              </p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg text-gray-100">
              <h3 className="font-semibold text-lg">Side Hustle Guide</h3>
              <p className="text-sm text-gray-300 mt-2">
                Essential steps to maximize mini-hustle
              </p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg text-gray-100">
              <h3 className="font-semibold text-lg">Strategy Session</h3>
              <p className="text-sm text-gray-300 mt-2">
                Work with a mentor to finalize your action plan
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
