import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { processComputedScores } from '../../utils/analytics';
import { 
  aggregateUserScores, 
  getHealthLevelDistribution, 
  calculateCompletionRate,
  calculateSectionStatistics,
  calculateQuestionStatistics,
  calculateCategoryPercentiles,
  calculateTimeMetrics,
  fetchSectionResults,
  aggregateSectionScores,
  exportAnalyticsToCSV,
  downloadCSV
} from '../../utils/adminUtils';
import { CATEGORY_RANGES, getCategoryMaxScore } from '../../utils/scoreRanges';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import jsPDF from 'jspdf';

const COLORS = {
  low: '#ef4444',
  medium: '#eab308',
  high: '#22c55e'
};

const CATEGORY_LABELS = {
  foundationalStructure: 'Foundational Structure',
  financialPosition: 'Financial Strength',
  salesMarketing: 'Sales & Marketing',
  productService: 'Product Viability',
  general: 'Overall Health'
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'sections', label: 'Section Stats', icon: '📝' },
  { id: 'questions', label: 'Question Analysis', icon: '❓' },
  { id: 'categories', label: 'Category Breakdown', icon: '📈' },
  { id: 'time', label: 'Time Analytics', icon: '⏱️' },
  { id: 'engagement', label: 'Engagement Metrics', icon: '👥' },
  { id: 'insights', label: 'Predictive Insights', icon: '🔮' }
];

export default function AnalyticsDashboard() {
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionResults, setSectionResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [sectionStats, setSectionStats] = useState(null);
  const [questionStats, setQuestionStats] = useState(null);
  const [categoryDetails, setCategoryDetails] = useState(null);
  const [timeMetrics, setTimeMetrics] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [mostAnsweredOpen, setMostAnsweredOpen] = useState(false);
  const [mostSkippedOpen, setMostSkippedOpen] = useState(false);
  const [lowestScoresOpen, setLowestScoresOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (users.length > 0 && sections.length > 0 && sectionResults.length > 0) {
      calculateAllAnalytics();
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
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllAnalytics = () => {
    // Filter data based on date range
    let filteredUsers = [...users];
    let filteredResults = [...sectionResults];

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredUsers = filteredUsers.filter(user => {
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
      filteredUsers = filteredUsers.filter(user => {
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
      filteredUsers = filteredUsers.filter(user => user.role === roleFilter);
    }

    if (completionFilter === 'completed') {
      filteredUsers = filteredUsers.filter(user => {
        return user.computedScores && Object.keys(user.computedScores).length >= 5;
      });
    } else if (completionFilter === 'incomplete') {
      filteredUsers = filteredUsers.filter(user => {
        return !user.computedScores || Object.keys(user.computedScores).length < 5;
      });
    }

    // Basic analytics
    const aggregated = aggregateUserScores(filteredUsers);
    const completionRate = calculateCompletionRate(filteredUsers, sections.length);
    const healthDistribution = getHealthLevelDistribution(aggregated.healthLevelDistribution);
    
    let totalOverallHealth = 0;
    let countWithHealth = 0;
    filteredUsers.forEach(user => {
      if (user.overallHealth && user.overallHealth.percentage !== undefined) {
        totalOverallHealth += user.overallHealth.percentage;
        countWithHealth++;
      }
    });
    const averageOverallHealth = countWithHealth > 0 ? totalOverallHealth / countWithHealth : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = filteredUsers.filter(user => {
      if (!user.lastLoggedOn) return false;
      const lastLogin = user.lastLoggedOn.toDate ? user.lastLoggedOn.toDate() : new Date(user.lastLoggedOn);
      return lastLogin >= thirtyDaysAgo;
    }).length;

    // Process category averages with percentages
    const categoryAverages = {};
    Object.entries(aggregated.categoryAverages).forEach(([category, data]) => {
      const maxPossible = getCategoryMaxScore(category);
      const averagePercentage = maxPossible > 0 ? (data.average / maxPossible) * 100 : 0;
      categoryAverages[category] = {
        averageScore: Math.round(data.average * 10) / 10,
        averagePercentage: Math.round(averagePercentage * 10) / 10,
        count: data.count,
        maxPossible
      };
    });

    setAnalyticsData({
      totalUsers: filteredUsers.length,
      activeUsers,
      completionRate: Math.round(completionRate),
      averageOverallHealth: Math.round(averageOverallHealth * 10) / 10,
      healthLevelDistribution: healthDistribution,
      categoryAverages
    });

    // Section statistics
    const sectionStatsData = calculateSectionStatistics(filteredResults, sections);
    setSectionStats(sectionStatsData);

    // Question statistics
    const questionStatsData = calculateQuestionStatistics(filteredResults, sections);
    setQuestionStats(questionStatsData);

    // Category details with percentiles
    const categoryDetailsData = {};
    Object.keys(CATEGORY_RANGES).forEach(categoryKey => {
      categoryDetailsData[categoryKey] = calculateCategoryPercentiles(filteredUsers, categoryKey);
    });
    setCategoryDetails(categoryDetailsData);

    // Time metrics
    const timeMetricsData = calculateTimeMetrics(filteredUsers, filteredResults);
    setTimeMetrics(timeMetricsData);

    // Calculate trends data for insights
    const healthLevels = { low: 0, medium: 0, high: 0 };
    const categoryTrends = {
      foundationalStructure: { low: 0, medium: 0, high: 0 },
      financialPosition: { low: 0, medium: 0, high: 0 },
      salesMarketing: { low: 0, medium: 0, high: 0 },
      productService: { low: 0, medium: 0, high: 0 },
      general: { low: 0, medium: 0, high: 0 }
    };

    filteredUsers.forEach(user => {
      if (user.overallHealth && user.overallHealth.healthLevel) {
        const level = user.overallHealth.healthLevel;
        if (healthLevels.hasOwnProperty(level)) {
          healthLevels[level]++;
        }
      }

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

    const monthlyTrends = {};
    filteredUsers.forEach(user => {
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
      totalUsers: filteredUsers.length
    });
  };

  const handleExportCSV = () => {
    if (!analyticsData) return;
    const csvContent = exportAnalyticsToCSV(analyticsData);
    const filename = `analytics_export_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleGeneratePDF = async () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    let yPos = 20;
    const pageWidth = 210;
    const margin = 15;
    
    // Header
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('Business Health Check - Analytics & Reports', margin, yPos);
    yPos += 10;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;

    // Overall Health Distribution
    if (analyticsData) {
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Overall Health Distribution', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Low: ${analyticsData.healthLevelDistribution.low.count} (${analyticsData.healthLevelDistribution.low.percentage}%)`, margin, yPos);
      yPos += 6;
      pdf.text(`Medium: ${analyticsData.healthLevelDistribution.medium.count} (${analyticsData.healthLevelDistribution.medium.percentage}%)`, margin, yPos);
      yPos += 6;
      pdf.text(`High: ${analyticsData.healthLevelDistribution.high.count} (${analyticsData.healthLevelDistribution.high.percentage}%)`, margin, yPos);
      yPos += 10;
    }

    // Category Averages
    if (analyticsData && analyticsData.categoryAverages) {
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Category Performance', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      Object.entries(analyticsData.categoryAverages).forEach(([category, data]) => {
        pdf.text(`${CATEGORY_LABELS[category] || category}: ${data.averagePercentage}% (Avg: ${data.averageScore}/${data.maxPossible})`, margin, yPos);
        yPos += 6;
        if (yPos > 280) {
          pdf.addPage();
          yPos = 20;
        }
      });
      yPos += 5;
    }

    // Section Statistics
    if (sectionStats) {
      if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
      }
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Section Performance Report', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      Object.entries(sectionStats).forEach(([sectionName, stats]) => {
        pdf.text(`${sectionName}: Avg Score: ${stats.averageScore}, Completion: ${stats.completionRate}%`, margin, yPos);
        yPos += 6;
        if (yPos > 280) {
          pdf.addPage();
          yPos = 20;
        }
      });
    }

    pdf.save(`analytics_reports_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const healthLevelChartData = useMemo(() => {
    if (!analyticsData) return [];
    return [
      { name: 'Low', value: analyticsData.healthLevelDistribution.low.count, color: COLORS.low },
      { name: 'Medium', value: analyticsData.healthLevelDistribution.medium.count, color: COLORS.medium },
      { name: 'High', value: analyticsData.healthLevelDistribution.high.count, color: COLORS.high }
    ];
  }, [analyticsData]);

  const categoryChartData = useMemo(() => {
    if (!analyticsData || !analyticsData.categoryAverages) return [];
    return Object.entries(analyticsData.categoryAverages).map(([category, data]) => ({
      category: CATEGORY_LABELS[category] || category,
      average: data.averageScore,
      percentage: data.averagePercentage
    }));
  }, [analyticsData]);

  const sectionChartData = useMemo(() => {
    if (!sectionStats) return [];
    return Object.entries(sectionStats)
      .map(([sectionName, stats]) => ({
        section: sectionName.length > 30 ? sectionName.substring(0, 27) + '...' : sectionName,
        fullSection: sectionName,
        averageScore: stats.averageScore,
        completionRate: stats.completionRate
      }))
      .sort((a, b) => {
        const sectionA = sections.find(s => s.title === a.fullSection);
        const sectionB = sections.find(s => s.title === b.fullSection);
        return (sectionA?.order || 0) - (sectionB?.order || 0);
      });
  }, [sectionStats, sections]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Total Users</div>
              <div className="text-3xl font-bold text-gray-900">{analyticsData?.totalUsers || 0}</div>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Active Users (30 days)</div>
              <div className="text-3xl font-bold text-gray-900">{analyticsData?.activeUsers || 0}</div>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Completion Rate</div>
              <div className="text-3xl font-bold text-gray-900">{analyticsData?.completionRate || 0}%</div>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Avg Overall Health</div>
              <div className="text-3xl font-bold text-gray-900">{analyticsData?.averageOverallHealth || 0}%</div>
            </div>
            <div className="text-4xl">💚</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Level Distribution Pie Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Health Level Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={healthLevelChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {healthLevelChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Low:</span>
              <span className="font-medium">{analyticsData?.healthLevelDistribution.low.count || 0} ({analyticsData?.healthLevelDistribution.low.percentage || 0}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Medium:</span>
              <span className="font-medium">{analyticsData?.healthLevelDistribution.medium.count || 0} ({analyticsData?.healthLevelDistribution.medium.percentage || 0}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">High:</span>
              <span className="font-medium">{analyticsData?.healthLevelDistribution.high.count || 0} ({analyticsData?.healthLevelDistribution.high.percentage || 0}%)</span>
            </div>
          </div>
        </div>

        {/* Average Scores Per Category Bar Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Average Scores by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="percentage" fill="#10b981" name="Percentage" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Performance Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Category Performance Details</h3>
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analyticsData?.categoryAverages && Object.entries(analyticsData.categoryAverages).map(([category, data]) => (
                <tr key={category} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {CATEGORY_LABELS[category] || category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.averageScore} / {data.maxPossible}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.averagePercentage}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSectionStats = () => {
    if (!sectionStats) return <div className="text-center py-12 text-gray-500">Loading section statistics...</div>;

    const sortedSections = Object.entries(sectionStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => a.sectionOrder - b.sectionOrder);

    const problematicSections = [...sortedSections]
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    return (
      <div className="space-y-6">
        {/* Section Performance Table */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Section Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distribution</th>
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
                      {section.completionRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {section.totalResponses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <span className="text-red-600">{section.scoreDistribution.low}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-yellow-600">{section.scoreDistribution.medium}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-green-600">{section.scoreDistribution.high}</span>
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
              data={sectionChartData}
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
                  const fullSection = sectionChartData.find(d => d.section === label)?.fullSection || label;
                  return fullSection;
                }}
              />
              <Legend />
              <Bar dataKey="averageScore" fill="#3b82f6" name="Average Score" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completionRate" fill="#10b981" name="Completion Rate %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most Problematic Sections */}
        {problematicSections.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Sections Needing Attention</h3>
            <div className="space-y-3">
              {problematicSections.map((section, index) => (
                <div key={section.name} className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-gray-900">#{index + 1} {section.name}</h4>
                      <p className="text-sm text-gray-600">Average Score: {section.averageScore}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-600">{section.averageScore}</div>
                      <div className="text-xs text-gray-500">{section.completionRate}% complete</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuestionAnalysis = () => {
    if (!questionStats) return <div className="text-center py-12 text-gray-500">Loading question statistics...</div>;

    const questionArray = Object.values(questionStats)
      .sort((a, b) => a.sectionOrder - b.sectionOrder || 0);

    // Filter by section if needed
    let filteredQuestions = questionArray;
    if (sectionFilter !== 'all') {
      filteredQuestions = questionArray.filter(q => q.sectionName === sectionFilter);
    }

    // Filter out Section 1 questions (no weightage)
    const questionsWithWeightage = filteredQuestions.filter(q => {
      const section = sections.find(s => s.title === q.sectionName);
      if (!section || section.order === 1) return false; // Exclude Section 1
      // Check if section has questions with weightage
      return section.questions?.some(question => {
        if (!question.options || !Array.isArray(question.options)) return false;
        return question.options.some(opt => (opt.weight || 0) > 0);
      });
    });

    // Most answered questions
    const mostAnswered = [...questionsWithWeightage]
      .filter(q => q.totalAnswers > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10);

    // Most skipped questions
    const mostSkipped = [...questionsWithWeightage]
      .filter(q => q.totalAnswers > 0)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 10);

    // Questions with lowest scores (excluding Section 1)
    const lowestScores = [...questionsWithWeightage]
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
                {questionsWithWeightage.map((question) => (
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

        {/* Most Answered Questions - Collapsible */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <button
            onClick={() => setMostAnsweredOpen(!mostAnsweredOpen)}
            className="w-full flex justify-between items-center mb-4"
          >
            <h3 className="text-lg font-bold text-gray-900">Most Answered Questions</h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${mostAnsweredOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mostAnsweredOpen && (
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
          )}
        </div>

        {/* Most Skipped Questions - Collapsible */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <button
            onClick={() => setMostSkippedOpen(!mostSkippedOpen)}
            className="w-full flex justify-between items-center mb-4"
          >
            <h3 className="text-lg font-bold text-gray-900">Most Skipped Questions</h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${mostSkippedOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mostSkippedOpen && (
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
          )}
        </div>

        {/* Questions with Lowest Scores - Collapsible */}
        {lowestScores.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <button
              onClick={() => setLowestScoresOpen(!lowestScoresOpen)}
              className="w-full flex justify-between items-center mb-4"
            >
              <h3 className="text-lg font-bold text-gray-900">Questions with Lowest Average Scores</h3>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${lowestScoresOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {lowestScoresOpen && (
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
            )}
          </div>
        )}

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
                  {(() => {
                    const distribution = selectedQuestion.answerDistribution;
                    const total = selectedQuestion.totalAnswers || Object.values(distribution).reduce((sum, count) => sum + (typeof count === 'number' ? count : count.count || 0), 0);
                    return Object.entries(distribution).map(([answer, count]) => {
                      const answerCount = typeof count === 'number' ? count : count.count || 0;
                      const percentage = total > 0 ? Math.round((answerCount / total) * 100) : 0;
                      return (
                        <div key={answer} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900">{answer}</span>
                            <span className="text-sm text-gray-600">{answerCount} responses ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-emerald-500 h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
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

  const renderCategoryBreakdown = () => {
    if (!categoryDetails) return <div className="text-center py-12 text-gray-500">Loading category details...</div>;

    return (
      <div className="space-y-6">
        {/* Category Percentiles */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Category Score Percentiles</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">25th %ile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Median</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">75th %ile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">90th %ile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(categoryDetails).map(([category, stats]) => (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {CATEGORY_LABELS[category] || category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.p25}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stats.p50}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.p75}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.p90}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">{stats.average}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Comparison Radar Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Category Performance Comparison</h3>
            <p className="text-sm text-gray-600 mb-1">
              This radar chart visualizes the average performance percentage across all business health categories.
            </p>
            <p className="text-sm text-gray-500">
              <strong>What it shows:</strong> Each point represents a category's average score percentage (0-100%). 
              The larger the area covered, the better overall business health. Use this to quickly identify which 
              categories need the most attention.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={categoryChartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="category" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Average %" dataKey="percentage" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
              <Tooltip 
                formatter={(value) => `${value}%`}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTimeAnalytics = () => {
    if (!timeMetrics) return <div className="text-center py-12 text-gray-500">Loading time analytics...</div>;

    return (
      <div className="space-y-6">
        {/* Registration Trends */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">User Registration Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeMetrics.registrationTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" name="New Users" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion Timeline */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Assessment Completion Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeMetrics.completionTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="submissions" stroke="#10b981" name="Submissions" />
              <Line type="monotone" dataKey="uniqueUsers" stroke="#f59e0b" name="Unique Users" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="text-sm font-medium text-gray-500 mb-1">Average Completion Time</div>
            <div className="text-3xl font-bold text-gray-900">{timeMetrics.averageCompletionTime} days</div>
            <div className="text-xs text-gray-500 mt-1">Time between first and last section</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="text-sm font-medium text-gray-500 mb-1">Total Section Submissions</div>
            <div className="text-3xl font-bold text-gray-900">
              {timeMetrics.completionTimeline.reduce((sum, item) => sum + item.submissions, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total section submissions across all users</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="text-sm font-medium text-gray-500 mb-1">Peak Activity Day</div>
            <div className="text-3xl font-bold text-gray-900">
              {Object.entries(timeMetrics.activityPatterns.byDayOfWeek)
                .sort((a, b) => b[1] - a[1])[0]?.[0] ? 
                ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Object.entries(timeMetrics.activityPatterns.byDayOfWeek).sort((a, b) => b[1] - a[1])[0][0]] : 
                'N/A'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEngagementMetrics = () => {
    if (!timeMetrics) return <div className="text-center py-12 text-gray-500">Loading engagement metrics...</div>;

    const avgSectionsPerUser = sectionResults.length > 0 && users.length > 0
      ? Math.round((sectionResults.length / users.length) * 10) / 10
      : 0;

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
            <div className="text-sm font-medium text-gray-500 mb-1">Total Submissions</div>
            <div className="text-3xl font-bold text-gray-900">
              {timeMetrics.completionTimeline.reduce((sum, item) => sum + item.submissions, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Across all sections</div>
          </div>
        </div>

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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{point.section}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{point.completions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {point.dropOff > 0 ? `-${point.dropOff}` : '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{point.dropOffPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Activity Patterns</h3>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Day of Week</h4>
            <div className="space-y-2">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                const count = timeMetrics.activityPatterns.byDayOfWeek[index] || 0;
                const maxCount = Math.max(...Object.values(timeMetrics.activityPatterns.byDayOfWeek), 1);
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{day}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div 
                        className="bg-emerald-500 h-4 rounded-full" 
                        style={{ width: `${Math.max(5, (count / maxCount) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPredictiveInsights = () => {
    if (!trendsData || !categoryDetails) return <div className="text-center py-12 text-gray-500">Loading insights...</div>;

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
                      <td className="px-4 py-2 text-gray-900">{user.firstName} {user.lastName}</td>
                      <td className="px-4 py-2 text-gray-600">{user.email}</td>
                      <td className="px-4 py-2 text-red-600 font-medium">{user.overallHealth?.percentage || 'N/A'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setRoleFilter('all'); setCompletionFilter('all'); }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => (
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
          {activeTab === 'sections' && renderSectionStats()}
          {activeTab === 'questions' && renderQuestionAnalysis()}
          {activeTab === 'categories' && renderCategoryBreakdown()}
          {activeTab === 'time' && renderTimeAnalytics()}
          {activeTab === 'engagement' && renderEngagementMetrics()}
          {activeTab === 'insights' && renderPredictiveInsights()}
        </div>
      </div>
    </div>
  );
}
