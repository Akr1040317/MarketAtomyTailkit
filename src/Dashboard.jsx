import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

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
const ScoreCard = ({ score, label, colorClass }) => (
  <div className="relative flex flex-col p-5 bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
    <div className="text-3xl font-extrabold text-gray-900">{score}%</div>
    <div className="text-sm font-medium text-gray-500 mt-1">{label}</div>
    <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
      <div
        className={`${colorClass} h-2 rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

// Roadmap Step Component
const RoadmapStep = ({ step, label, isActive }) => (
  <div className="flex flex-col items-center">
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold transition-all duration-300 ${
        isActive ? "bg-emerald-500 text-white shadow-md" : "bg-gray-300 text-gray-600"
      }`}
    >
      {step}
    </div>
    <span className="mt-3 text-sm font-medium text-gray-300">{label}</span>
  </div>
);

export default function Dashboard() {
  const [computedScores, setComputedScores] = useState(null);
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
          setComputedScores(userData.computedScores || {});
        }
      } catch (error) {
        console.error("Error fetching user scores:", error);
      }
    };

    fetchUserScores();
  }, [user]);

  // Get score safely
  const getScore = (categoryKey) =>
    computedScores?.[categoryKey]?.total ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Introduction Section */}
        <section className="bg-white rounded-2xl shadow-xl p-8 transition-all duration-300">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Business Health Check Assessment
          </h1>
          <p className="mt-4 text-gray-600 leading-relaxed">
            The Business Health Check (BHC) Assessment evaluates your business
            across 21 critical Key Performance Indicators (KPIs) grouped into five
            interdependent systems: Foundational Structure, Financial Strength,
            Sales & Marketing, Product Viability, and Overall Health. This
            comprehensive analysis identifies strengths and gaps, providing
            actionable recommendations to drive growth and customer engagement.
          </p>
          <div className="mt-6 flex items-center space-x-4">
            <span className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
              Assessment Completed
            </span>
            <span className="text-sm text-gray-500">
              Last Updated: Jan 15, 2025
            </span>
          </div>
        </section>

        {/* Scores Section */}
        <section className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Your Business Health Scores
          </h2>
          <p className="mt-2 text-gray-600 leading-relaxed">
            Review your performance across key business areas.
          </p>
          {!computedScores ? (
            <p className="mt-4 text-gray-500 animate-pulse">Loading scores...</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {CATEGORY_ORDER.map((key) => (
                <ScoreCard
                  key={key}
                  score={getScore(key)}
                  label={CATEGORIES[key].label}
                  colorClass={CATEGORIES[key].color}
                />
              ))}
            </div>
          )}
        </section>

        {/* Next Steps & Placeholder */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Detailed Insights
            </h2>
            <p className="mt-2 text-gray-600 leading-relaxed">
              Coming soon: In-depth analysis and recommendations tailored to your
              scores.
            </p>
          </div>
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
              Next Steps
            </h2>
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl text-gray-100 space-y-4">
              {[
                "Schedule Marketing Strategy Session",
                "Complete Product Analysis",
                "Finalize Assessment Review",
              ].map((step, index) => (
                <div
                  key={index}
                  className="flex items-center text-sm font-medium transition-colors hover:text-emerald-400"
                >
                  <span className="mr-3 text-emerald-400 font-bold">
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
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
            Your Growth Roadmap
          </h2>
          <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl flex items-center justify-between relative">
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
                  <div className="h-1 bg-gray-600/50 flex-1 mx-4 rounded-full relative">
                    <div
                      className={`absolute h-1 rounded-full transition-all duration-500 ${
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
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
            Recommended Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl text-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:bg-gray-700/50"
              >
                <h3 className="font-semibold text-lg text-white">{title}</h3>
                <p className="text-sm text-gray-300 mt-2 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}