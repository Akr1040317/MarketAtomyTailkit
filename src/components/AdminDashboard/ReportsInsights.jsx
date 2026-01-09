import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { processComputedScores } from '../../utils/analytics';
import { 
  exportAnalyticsToCSV, 
  downloadCSV,
  calculateSectionStatistics,
  calculateQuestionStatistics,
  calculateCategoryPercentiles,
  calculateTimeMetrics,
  fetchSectionResults,
  aggregateSectionScores,
  calculateAnswerDistributions
} from '../../utils/adminUtils';
import { CATEGORY_RANGES, getCategoryMaxScore } from '../../utils/scoreRanges';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import jsPDF from 'jspdf';

const CATEGORY_LABELS = {
  foundationalStructure: 'Foundational Structure',
  financialPosition: 'Financial Strength',
  salesMarketing: 'Sales & Marketing',
  productService: 'Product Viability',
  general: 'Overall Health'
};

const REPORT_TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'sections', label: 'Section Report', icon: '📝' },
  { id: 'questions', label: 'Question Analysis', icon: '❓' },
  { id: 'categories', label: 'Category Deep Dive', icon: '📈' },
  { id: 'engagement', label: 'Engagement Metrics', icon: '👥' },
  { id: 'insights', label: 'Predictive Insights', icon: '🔮' }
];

const COLORS = {
  low: '#ef4444',
  medium: '#eab308',
  high: '#22c55e'
};

export default function ReportsInsights() {
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionResults, setSectionResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [trendsData, setTrendsData] = useState(null);
  const [sectionStats, setSectionStats] = useState(null);
  const [questionStats, setQuestionStats] = useState(null);
  const [categoryDetails, setCategoryDetails] = useState(null);
  const [timeMetrics, setTimeMetrics] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (users.length > 0 && sections.length > 0 && sectionResults.length > 0) {
      calculateAllTrends();
    }
  }, [users, sections, sectionResults, dateFrom, dateTo, roleFilter, completionFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // Fetch sections
      const sectionsQuery = query(collection(db, 'BHC_Assessment'), orderBy('order'));
      const sectionsSnapshot = await getDocs(sectionsQuery);
      const sectionsData = sectionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSections(sectionsData);

      // Fetch section results
      const sectionResultsData = await fetchSectionResults(db);
      setSectionResults(sectionResultsData);
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllTrends = () => {
    // Filter users based on criteria
    let filtered = [...users];
    let filteredResults = [...sectionResults];

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(user => {
        if (!user.createdAt) return false;
        const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        return userDate >= fromDate;
      });
      filteredResults = filteredResults.filter(result => {
        if (!result.submittedAt) return false;
        const resultDate = result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt);
        return resultDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(user => {
        if (!user.createdAt) return false;
        const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        return userDate <= toDate;
      });
      filteredResults = filteredResults.filter(result => {
        if (!result.submittedAt) return false;
        const resultDate = result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt);
        return resultDate <= toDate;
      });
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (completionFilter === 'completed') {
      filtered = filtered.filter(user => {
        return user.computedScores && Object.keys(user.computedScores).length >= 5;
      });
    } else if (completionFilter === 'incomplete') {
      filtered = filtered.filter(user => {
        return !user.computedScores || Object.keys(user.computedScores).length < 5;
      });
    }

    // Calculate health level distribution
    const healthLevels = { low: 0, medium: 0, high: 0 };
    const categoryTrends = {
      foundationalStructure: { low: 0, medium: 0, high: 0 },
      financialPosition: { low: 0, medium: 0, high: 0 },
      salesMarketing: { low: 0, medium: 0, high: 0 },
      productService: { low: 0, medium: 0, high: 0 },
      general: { low: 0, medium: 0, high: 0 }
    };

    filtered.forEach(user => {
      if (user.overallHealth && user.overallHealth.healthLevel) {
        const level = user.overallHealth.healthLevel;
        if (healthLevels.hasOwnProperty(level)) {
          healthLevels[level]++;
        }
      }

      // Process category scores
      if (user.computedScores) {
        Object.keys(categoryTrends).forEach(category => {
          const categoryData = user.computedScores[category];
          if (categoryData && categoryData.total !== undefined) {
            const processed = processComputedScores({ [category]: categoryData });
            if (processed && processed[category]) {
              const level = processed[category].healthLevel;
              if (categoryTrends[category].hasOwnProperty(level)) {
                categoryTrends[category][level]++;
              }
            }
          }
        });
      }
    });

    // Identify low health areas
    const lowHealthAreas = [];
    Object.entries(categoryTrends).forEach(([category, levels]) => {
      const total = levels.low + levels.medium + levels.high;
      if (total > 0) {
        const lowPercentage = (levels.low / total) * 100;
        if (lowPercentage > 50) {
          lowHealthAreas.push({
            category: CATEGORY_LABELS[category] || category,
            lowPercentage: Math.round(lowPercentage),
            totalUsers: total
          });
        }
      }
    });

    // Calculate trends over time (by month)
    const monthlyTrends = {};
    filtered.forEach(user => {
      if (user.createdAt) {
        const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyTrends[monthKey]) {
          monthlyTrends[monthKey] = { count: 0, completed: 0, avgHealth: 0, healthSum: 0 };
        }
        monthlyTrends[monthKey].count++;
        if (user.computedScores && Object.keys(user.computedScores).length >= 5) {
          monthlyTrends[monthKey].completed++;
        }
        if (user.overallHealth && user.overallHealth.percentage !== undefined) {
          monthlyTrends[monthKey].healthSum += user.overallHealth.percentage;
        }
      }
    });

    const trendsArray = Object.entries(monthlyTrends)
      .map(([month, data]) => ({
        month,
        users: data.count,
        completed: data.completed,
        completionRate: data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0,
        avgHealth: data.completed > 0 ? Math.round((data.healthSum / data.completed) * 10) / 10 : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    setTrendsData({
      healthLevelDistribution: healthLevels,
      categoryTrends,
      lowHealthAreas,
      monthlyTrends: trendsArray,
      totalUsers: filtered.length
    });

    // Calculate section statistics - pass total users for accurate completion rate
    const sectionStatsData = calculateSectionStatistics(filteredResults, sections, filtered.length);
    setSectionStats(sectionStatsData);

    // Calculate question statistics
    const questionStatsData = calculateQuestionStatistics(filteredResults, sections);
    setQuestionStats(questionStatsData);

    // Category details
    const categoryDetailsData = {};
    Object.keys(CATEGORY_RANGES).forEach(categoryKey => {
      categoryDetailsData[categoryKey] = calculateCategoryPercentiles(filtered, categoryKey);
    });
    setCategoryDetails(categoryDetailsData);

    // Time metrics
    const timeMetricsData = calculateTimeMetrics(filtered, filteredResults);
    setTimeMetrics(timeMetricsData);
  };

  const handleExportCSV = () => {
    if (!trendsData) return;
    
    const analyticsData = {
      totalUsers: trendsData.totalUsers,
      activeUsers: users.filter(u => {
        if (!u.lastLoggedOn) return false;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const lastLogin = u.lastLoggedOn.toDate ? u.lastLoggedOn.toDate() : new Date(u.lastLoggedOn);
        return lastLogin >= thirtyDaysAgo;
      }).length,
      completionRate: 0,
      averageOverallHealth: 0,
      healthLevelDistribution: trendsData.healthLevelDistribution,
      categoryAverages: {}
    };

    const csvContent = exportAnalyticsToCSV(analyticsData);
    const filename = `reports_export_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleGeneratePDF = async () => {
    // Generate comprehensive PDF report
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    let yPos = 20;
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Header
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('Business Health Check - Reports & Insights', margin, yPos);
    yPos += 10;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;

    // Overall Health Distribution
    if (trendsData) {
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Overall Health Distribution', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Low: ${trendsData.healthLevelDistribution.low}`, margin, yPos);
      yPos += 6;
      pdf.text(`Medium: ${trendsData.healthLevelDistribution.medium}`, margin, yPos);
      yPos += 6;
      pdf.text(`High: ${trendsData.healthLevelDistribution.high}`, margin, yPos);
      yPos += 10;
    }

    // Category Trends
    if (trendsData && trendsData.categoryTrends) {
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Category Performance Trends', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      Object.entries(trendsData.categoryTrends).forEach(([category, levels]) => {
        pdf.text(`${CATEGORY_LABELS[category] || category}: Low: ${levels.low}, Medium: ${levels.medium}, High: ${levels.high}`, margin, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    // Section Statistics
    if (sectionStats) {
      pdf.addPage();
      yPos = 20;
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Section Performance Report', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      Object.entries(sectionStats).forEach(([sectionName, stats]) => {
        pdf.text(`${sectionName}: Avg Score: ${stats.averageScore}, Completion: ${stats.completionRate}%`, margin, yPos);
        yPos += 6;
      });
    }

    pdf.save(`reports_insights_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Health Level Distribution */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Overall Health Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-6 bg-red-50 rounded-lg border-2 border-red-200">
            <div className="text-4xl font-bold text-red-600 mb-2">{trendsData?.healthLevelDistribution.low || 0}</div>
            <div className="text-sm font-medium text-gray-700">Low Health</div>
            <div className="text-xs text-gray-500 mt-1">
              {trendsData ? Math.round((trendsData.healthLevelDistribution.low / trendsData.totalUsers) * 100) : 0}% of users
            </div>
          </div>
          <div className="text-center p-6 bg-yellow-50 rounded-lg border-2 border-yellow-200">
            <div className="text-4xl font-bold text-yellow-600 mb-2">{trendsData?.healthLevelDistribution.medium || 0}</div>
            <div className="text-sm font-medium text-gray-700">Medium Health</div>
            <div className="text-xs text-gray-500 mt-1">
              {trendsData ? Math.round((trendsData.healthLevelDistribution.medium / trendsData.totalUsers) * 100) : 0}% of users
            </div>
          </div>
          <div className="text-center p-6 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="text-4xl font-bold text-green-600 mb-2">{trendsData?.healthLevelDistribution.high || 0}</div>
            <div className="text-sm font-medium text-gray-700">High Health</div>
            <div className="text-xs text-gray-500 mt-1">
              {trendsData ? Math.round((trendsData.healthLevelDistribution.high / trendsData.totalUsers) * 100) : 0}% of users
            </div>
          </div>
        </div>
      </div>

      {/* Category Trends */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Category Performance Trends</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Low</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medium</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">High</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trendsData?.categoryTrends && Object.entries(trendsData.categoryTrends).map(([category, levels]) => {
                const total = levels.low + levels.medium + levels.high;
                return (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {CATEGORY_LABELS[category] || category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{levels.low}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">{levels.medium}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{levels.high}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Health Areas */}
      {trendsData?.lowHealthAreas && trendsData.lowHealthAreas.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Areas Needing Attention</h3>
          <div className="space-y-3">
            {trendsData.lowHealthAreas.map((area, index) => (
              <div key={index} className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{area.category}</h4>
                    <p className="text-sm text-gray-600">
                      {area.lowPercentage}% of users have low health in this category
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-red-600">{area.lowPercentage}%</div>
                    <div className="text-xs text-gray-500">{area.totalUsers} users</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Trends Chart */}
      {trendsData?.monthlyTrends && trendsData.monthlyTrends.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Completion Trends Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsData.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="completionRate" stroke="#10b981" name="Completion Rate %" strokeWidth={2} />
              <Line type="monotone" dataKey="avgHealth" stroke="#3b82f6" name="Avg Health Score" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  const renderSectionReport = () => {
    if (!sectionStats) return <div className="text-center py-12 text-gray-500">Loading section report...</div>;

    const sortedSections = Object.entries(sectionStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => a.sectionOrder - b.sectionOrder);

    return (
      <div className="space-y-6">
        {/* Section Performance Report */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Section Performance Report</h3>
            <button
              onClick={() => {
                // Export section report CSV
                const rows = [['Section', 'Average Score', 'Completion Rate %', 'Total Responses', 'Low', 'Medium', 'High']];
                sortedSections.forEach(section => {
                  rows.push([
                    section.name,
                    section.averageScore,
                    section.completionRate,
                    section.totalResponses,
                    section.scoreDistribution.low,
                    section.scoreDistribution.medium,
                    section.scoreDistribution.high
                  ]);
                });
                const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                downloadCSV(csvContent, `section_report_${new Date().toISOString().split('T')[0]}.csv`);
              }}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedSections.map((section) => (
                  <tr key={section.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {section.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {section.averageScore}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full" 
                            style={{ width: `${section.completionRate}%` }}
                          ></div>
                        </div>
                        <span>{section.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {section.totalResponses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-3">
                        <span className="text-red-600 font-medium">{section.scoreDistribution.low}</span>
                        <span className="text-yellow-600 font-medium">{section.scoreDistribution.medium}</span>
                        <span className="text-green-600 font-medium">{section.scoreDistribution.high}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section Score Distribution Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Section Score Distribution</h3>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart 
              data={sortedSections.map(s => ({ 
                section: s.name.length > 30 ? s.name.substring(0, 27) + '...' : s.name,
                fullSection: s.name,
                avgScore: s.averageScore, 
                completion: s.completionRate 
              }))}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="section" 
                angle={-45} 
                textAnchor="end" 
                height={120}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'Completion Rate %') return `${value}%`;
                  return value;
                }}
                labelFormatter={(label) => {
                  const fullSection = sortedSections.find(s => (s.name.length > 30 ? s.name.substring(0, 27) + '...' : s.name) === label)?.name || label;
                  return fullSection;
                }}
              />
              <Legend />
              <Bar dataKey="avgScore" fill="#3b82f6" name="Average Score" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completion" fill="#10b981" name="Completion Rate %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderQuestionAnalysis = () => {
    if (!questionStats) return <div className="text-center py-12 text-gray-500">Loading question analysis...</div>;

    const questionArray = Object.values(questionStats)
      .sort((a, b) => a.sectionOrder - b.sectionOrder);

    let filteredQuestions = questionArray;
    if (sectionFilter !== 'all') {
      filteredQuestions = questionArray.filter(q => q.sectionName === sectionFilter);
    }

    // Most answered questions
    const mostAnswered = [...filteredQuestions]
      .filter(q => q.totalAnswers > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10);

    // Most skipped questions
    const mostSkipped = [...filteredQuestions]
      .filter(q => q.totalAnswers > 0)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 10);

    // Questions with lowest scores
    const lowestScores = [...filteredQuestions]
      .filter(q => q.totalAnswers > 0)
      .sort((a, b) => a.averageWeight - b.averageWeight)
      .slice(0, 10);

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Section</label>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
              >
                <option value="all">All Sections</option>
                {sections.map(section => (
                  <option key={section.id} value={section.title}>{section.title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Most Answered Questions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Most Answered Questions</h3>
          <div className="space-y-3">
            {mostAnswered.map((question, index) => (
              <div key={question.questionId} className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">#{index + 1} {question.questionText}</h4>
                    <p className="text-sm text-gray-600">Section: {question.sectionName}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-green-600">{question.completionRate}%</div>
                    <div className="text-xs text-gray-500">{question.totalAnswers} answers</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Skipped Questions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Most Skipped Questions</h3>
          <div className="space-y-3">
            {mostSkipped.map((question, index) => (
              <div key={question.questionId} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">#{index + 1} {question.questionText}</h4>
                    <p className="text-sm text-gray-600">Section: {question.sectionName}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-yellow-600">{question.completionRate}%</div>
                    <div className="text-xs text-gray-500">{question.totalAnswers} answers</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Questions with Lowest Scores */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Questions with Lowest Average Scores</h3>
          <div className="space-y-3">
            {lowestScores.map((question, index) => (
              <div key={question.questionId} className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">#{index + 1} {question.questionText}</h4>
                    <p className="text-sm text-gray-600">Section: {question.sectionName} | Most Common: {question.mostCommonAnswer}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-red-600">{question.averageWeight}</div>
                    <div className="text-xs text-gray-500">Avg weight</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Question Details Table */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">All Questions Analysis</h3>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Weight</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Most Common</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQuestions.map((question) => (
                  <tr key={question.questionId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">{question.sectionName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-md">
                      {question.questionText}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{question.averageWeight}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{question.completionRate}%</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{question.mostCommonAnswer}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setSelectedQuestion(question)}
                        className="text-emerald-600 hover:text-emerald-900 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Question Answer Distribution Modal */}
        {selectedQuestion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Answer Distribution</h3>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mb-4">
                <p className="text-gray-900 font-medium mb-2">{selectedQuestion.questionText}</p>
                <p className="text-sm text-gray-600">Section: {selectedQuestion.sectionName}</p>
              </div>
              {selectedQuestion.answerDistribution && Object.keys(selectedQuestion.answerDistribution).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(selectedQuestion.answerDistribution).map(([answer, data]) => (
                    <div key={answer} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-900">{answer}</span>
                        <span className="text-sm text-gray-600">{data.count} responses ({data.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full" 
                          style={{ width: `${data.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No answer distribution data available</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCategoryDeepDive = () => {
    if (!categoryDetails) return <div className="text-center py-12 text-gray-500">Loading category details...</div>;

    return (
      <div className="space-y-6">
        {/* Category Score Distributions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Category Score Distributions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(categoryDetails).map(([category, stats]) => (
              <div key={category} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">{CATEGORY_LABELS[category] || category}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Min:</span>
                    <span className="font-medium">{stats.min}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">25th %ile:</span>
                    <span className="font-medium">{stats.p25}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Median:</span>
                    <span className="font-medium text-emerald-600">{stats.p50}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">75th %ile:</span>
                    <span className="font-medium">{stats.p75}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">90th %ile:</span>
                    <span className="font-medium">{stats.p90}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max:</span>
                    <span className="font-medium">{stats.max}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-gray-600">Average:</span>
                    <span className="font-bold text-emerald-600">{stats.average}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Std Dev:</span>
                    <span className="font-medium">{stats.stdDev}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Comparison Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Category Score Ranges</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={Object.entries(categoryDetails).map(([category, stats]) => ({
              category: CATEGORY_LABELS[category] || category,
              min: stats.min,
              p25: stats.p25,
              median: stats.p50,
              p75: stats.p75,
              max: stats.max,
              average: stats.average
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="min" fill="#ef4444" name="Min" />
              <Bar dataKey="p25" fill="#f59e0b" name="25th %ile" />
              <Bar dataKey="median" fill="#10b981" name="Median" />
              <Bar dataKey="p75" fill="#3b82f6" name="75th %ile" />
              <Bar dataKey="max" fill="#8b5cf6" name="Max" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderEngagementMetrics = () => {
    if (!timeMetrics) return <div className="text-center py-12 text-gray-500">Loading engagement metrics...</div>;

    // Calculate engagement metrics
    const avgSectionsPerUser = sectionResults.length > 0 && users.length > 0
      ? Math.round((sectionResults.length / users.length) * 10) / 10
      : 0;

    // Drop-off analysis (sections where users stop)
    const sectionCompletionCounts = {};
    sectionResults.forEach(result => {
      const section = sections.find(s => s.title === result.sectionName);
      if (section) {
        const order = section.order || 0;
        if (!sectionCompletionCounts[order]) {
          sectionCompletionCounts[order] = 0;
        }
        sectionCompletionCounts[order]++;
      }
    });

    const sortedSections = sections.sort((a, b) => (a.order || 0) - (b.order || 0));
    const dropOffPoints = sortedSections.map((section, index) => {
      const prevCount = index > 0 ? sectionCompletionCounts[sortedSections[index - 1].order] || 0 : users.length;
      const currentCount = sectionCompletionCounts[section.order] || 0;
      const dropOff = prevCount - currentCount;
      return {
        section: section.title,
        order: section.order || 0,
        completions: currentCount,
        dropOff: dropOff,
        dropOffPercentage: prevCount > 0 ? Math.round((dropOff / prevCount) * 100) : 0
      };
    });

    return (
      <div className="space-y-6">
        {/* Engagement Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="text-sm font-medium text-gray-500 mb-1">Avg Sections per User</div>
            <div className="text-3xl font-bold text-gray-900">{avgSectionsPerUser}</div>
            <div className="text-xs text-gray-500 mt-1">Out of {sections.length} total sections</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="text-sm font-medium text-gray-500 mb-1">Avg Completion Time</div>
            <div className="text-3xl font-bold text-gray-900">{timeMetrics.averageCompletionTime} days</div>
            <div className="text-xs text-gray-500 mt-1">Time between first and last section</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="text-sm font-medium text-gray-500 mb-1">Total Section Submissions</div>
            <div className="text-3xl font-bold text-gray-900">
              {timeMetrics.completionTimeline.reduce((sum, item) => sum + item.submissions, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ({trendsData?.totalUsers || 0} users × multiple sections)
            </div>
          </div>
        </div>

        {/* Drop-off Analysis */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Section Drop-off Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drop-off</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drop-off %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dropOffPoints.map((point) => (
                  <tr key={point.section} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {point.section}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {point.completions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {point.dropOff > 0 ? `-${point.dropOff}` : '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {point.dropOffPercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Patterns */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Activity Patterns</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">By Day of Week</h4>
              <div className="space-y-2">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                  const count = timeMetrics.activityPatterns.byDayOfWeek[index] || 0;
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24">{day}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div 
                          className="bg-emerald-500 h-4 rounded-full" 
                          style={{ width: `${Math.max(5, (count / Math.max(...Object.values(timeMetrics.activityPatterns.byDayOfWeek))) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">By Hour of Day</h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {Array.from({ length: 24 }, (_, i) => i).map(hour => {
                  const count = timeMetrics.activityPatterns.byHour[hour] || 0;
                  return (
                    <div key={hour} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-12">{hour}:00</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full" 
                          style={{ width: `${Math.max(2, (count / Math.max(...Object.values(timeMetrics.activityPatterns.byHour), 1)) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPredictiveInsights = () => {
    if (!trendsData || !categoryDetails) return <div className="text-center py-12 text-gray-500">Loading insights...</div>;

    // Identify at-risk users (low scores in critical categories)
    const atRiskUsers = users.filter(user => {
      if (!user.computedScores) return false;
      const criticalCategories = ['foundationalStructure', 'financialPosition'];
      return criticalCategories.some(category => {
        const categoryData = user.computedScores[category];
        if (!categoryData || categoryData.total === undefined) return false;
        const processed = processComputedScores({ [category]: categoryData });
        return processed && processed[category] && processed[category].healthLevel === 'low';
      });
    });

    // Trend predictions
    const categoryTrends = trendsData.categoryTrends;
    const improvingCategories = [];
    const decliningCategories = [];

    Object.entries(categoryTrends).forEach(([category, levels]) => {
      const total = levels.low + levels.medium + levels.high;
      if (total > 0) {
        const lowPercentage = (levels.low / total) * 100;
        const highPercentage = (levels.high / total) * 100;
        
        if (highPercentage > 40) {
          improvingCategories.push({
            category: CATEGORY_LABELS[category] || category,
            highPercentage: Math.round(highPercentage)
          });
        }
        if (lowPercentage > 60) {
          decliningCategories.push({
            category: CATEGORY_LABELS[category] || category,
            lowPercentage: Math.round(lowPercentage)
          });
        }
      }
    });

    // Recommendations
    const recommendations = [];
    if (trendsData.lowHealthAreas.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Focus Areas Identified',
        message: `${trendsData.lowHealthAreas.length} categories need immediate attention. Consider targeted resources and support.`
      });
    }
    if (atRiskUsers.length > 0) {
      recommendations.push({
        type: 'alert',
        title: 'At-Risk Users Detected',
        message: `${atRiskUsers.length} users have low scores in critical categories. Consider proactive outreach.`
      });
    }
    if (improvingCategories.length > 0) {
      recommendations.push({
        type: 'success',
        title: 'Positive Trends',
        message: `${improvingCategories.length} categories showing strong performance. Use as success examples.`
      });
    }

    return (
      <div className="space-y-6">
        {/* At-Risk Users */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">At-Risk Users</h3>
          <p className="text-gray-600 mb-4">
            Users with low scores in critical categories (Foundational Structure, Financial Position)
          </p>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="text-3xl font-bold text-red-600 mb-2">{atRiskUsers.length}</div>
            <div className="text-sm text-gray-700">Users identified as at-risk</div>
          </div>
          {atRiskUsers.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Health Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {atRiskUsers.slice(0, 10).map(user => (
                    <tr key={user.id}>
                      <td className="px-4 py-2 text-gray-900">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{user.email}</td>
                      <td className="px-4 py-2 text-red-600 font-medium">
                        {user.overallHealth?.percentage || 'N/A'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Trend Predictions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Improving Categories */}
          {improvingCategories.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-green-500">📈</span>
                Improving Categories
              </h3>
              <div className="space-y-3">
                {improvingCategories.map((item, index) => (
                  <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{item.category}</span>
                      <span className="text-green-600 font-bold">{item.highPercentage}% high</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Declining Categories */}
          {decliningCategories.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-red-500">📉</span>
                Categories Needing Attention
              </h3>
              <div className="space-y-3">
                {decliningCategories.map((item, index) => (
                  <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{item.category}</span>
                      <span className="text-red-600 font-bold">{item.lowPercentage}% low</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border-l-4 ${
                  rec.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                  rec.type === 'alert' ? 'bg-red-50 border-red-500' :
                  'bg-green-50 border-green-500'
                }`}
              >
                <h4 className="font-semibold text-gray-900 mb-1">{rec.title}</h4>
                <p className="text-sm text-gray-700">{rec.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Report Filters</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handleGeneratePDF}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Generate PDF
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="tier1">Tier 1</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Completion Status</label>
            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sections' && renderSectionReport()}
          {activeTab === 'questions' && renderQuestionAnalysis()}
          {activeTab === 'categories' && renderCategoryDeepDive()}
          {activeTab === 'engagement' && renderEngagementMetrics()}
          {activeTab === 'insights' && renderPredictiveInsights()}
        </div>
      </div>
    </div>
  );
}
