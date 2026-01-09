import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { processComputedScores } from '../../utils/analytics';
import { aggregateUserScores, getHealthLevelDistribution, calculateCompletionRate } from '../../utils/adminUtils';
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
  Line
} from 'recharts';

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

export default function AnalyticsDashboard() {
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      calculateAnalytics();
    }
  }, [users, sections]);

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

      // Fetch sections for completion rate calculation
      const sectionsQuery = query(collection(db, 'BHC_Assessment'), orderBy('order'));
      const sectionsSnapshot = await getDocs(sectionsQuery);
      const sectionsData = sectionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSections(sectionsData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = () => {
    // Aggregate scores
    const aggregated = aggregateUserScores(users);
    
    // Calculate completion rate
    const completionRate = calculateCompletionRate(users, sections.length);
    
    // Get health level distribution
    const healthDistribution = getHealthLevelDistribution(aggregated.healthLevelDistribution);
    
    // Calculate average overall health
    let totalOverallHealth = 0;
    let countWithHealth = 0;
    users.forEach(user => {
      if (user.overallHealth && user.overallHealth.percentage !== undefined) {
        totalOverallHealth += user.overallHealth.percentage;
        countWithHealth++;
      }
    });
    const averageOverallHealth = countWithHealth > 0 ? totalOverallHealth / countWithHealth : 0;

    // Calculate active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = users.filter(user => {
      if (!user.lastLoggedOn) return false;
      const lastLogin = user.lastLoggedOn.toDate ? user.lastLoggedOn.toDate() : new Date(user.lastLoggedOn);
      return lastLogin >= thirtyDaysAgo;
    }).length;

    // Process category averages
    const categoryAverages = {};
    Object.entries(aggregated.categoryAverages).forEach(([category, data]) => {
      // Calculate percentage (need max score for each category)
      // For now, use raw average - in production, you'd normalize this
      categoryAverages[category] = {
        averageScore: Math.round(data.average * 10) / 10,
        averagePercentage: 0, // Would need to calculate based on max possible score
        count: data.count
      };
    });

    setAnalyticsData({
      totalUsers: users.length,
      activeUsers,
      completionRate: Math.round(completionRate),
      averageOverallHealth: Math.round(averageOverallHealth * 10) / 10,
      healthLevelDistribution: healthDistribution,
      categoryAverages
    });
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
      average: data.averageScore
    }));
  }, [analyticsData]);

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
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Total Users</div>
          <div className="text-3xl font-bold text-gray-900">{analyticsData.totalUsers}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Active Users (30 days)</div>
          <div className="text-3xl font-bold text-gray-900">{analyticsData.activeUsers}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Completion Rate</div>
          <div className="text-3xl font-bold text-gray-900">{analyticsData.completionRate}%</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Avg Overall Health</div>
          <div className="text-3xl font-bold text-gray-900">{analyticsData.averageOverallHealth}%</div>
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
              <span className="font-medium">{analyticsData.healthLevelDistribution.low.count} ({analyticsData.healthLevelDistribution.low.percentage}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Medium:</span>
              <span className="font-medium">{analyticsData.healthLevelDistribution.medium.count} ({analyticsData.healthLevelDistribution.medium.percentage}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">High:</span>
              <span className="font-medium">{analyticsData.healthLevelDistribution.high.count} ({analyticsData.healthLevelDistribution.high.percentage}%)</span>
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
              <Bar dataKey="average" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Performance Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Category Performance Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(analyticsData.categoryAverages).map(([category, data]) => (
                <tr key={category}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {CATEGORY_LABELS[category] || category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.averageScore}
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
}
