import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { processComputedScores } from '../../utils/analytics';
import { exportAnalyticsToCSV, downloadCSV } from '../../utils/adminUtils';
import { downloadPDFReport } from '../../utils/pdfGenerator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CATEGORY_LABELS = {
  foundationalStructure: 'Foundational Structure',
  financialPosition: 'Financial Strength',
  salesMarketing: 'Sales & Marketing',
  productService: 'Product Viability',
  general: 'Overall Health'
};

export default function ReportsInsights() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState('all');
  const [trendsData, setTrendsData] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      calculateTrends();
    }
  }, [users, dateFrom, dateTo, roleFilter, completionFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(usersQuery);
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrends = () => {
    // Filter users based on criteria
    let filtered = [...users];

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(user => {
        if (!user.createdAt) return false;
        const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        return userDate >= fromDate;
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

    // Convert to array and calculate averages
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
    // Generate aggregate report PDF
    // This would create a summary report with key insights
    alert('PDF generation feature coming soon. For now, use CSV export.');
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Report Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={handleGeneratePDF}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Generate PDF Report
          </button>
        </div>
      </div>

      {trendsData && (
        <>
          {/* Health Level Distribution */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Overall Health Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{trendsData.healthLevelDistribution.low}</div>
                <div className="text-sm text-gray-600">Low Health</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{trendsData.healthLevelDistribution.medium}</div>
                <div className="text-sm text-gray-600">Medium Health</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{trendsData.healthLevelDistribution.high}</div>
                <div className="text-sm text-gray-600">High Health</div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(trendsData.categoryTrends).map(([category, levels]) => (
                    <tr key={category}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {CATEGORY_LABELS[category] || category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{levels.low}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{levels.medium}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{levels.high}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Health Areas */}
          {trendsData.lowHealthAreas.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Areas Needing Attention</h3>
              <div className="space-y-3">
                {trendsData.lowHealthAreas.map((area, index) => (
                  <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-gray-900">{area.category}</h4>
                        <p className="text-sm text-gray-600">
                          {area.lowPercentage}% of users have low health in this category
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">{area.lowPercentage}%</div>
                        <div className="text-xs text-gray-500">{area.totalUsers} users</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Trends Chart */}
          {trendsData.monthlyTrends.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Completion Trends Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendsData.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completionRate" stroke="#10b981" name="Completion Rate %" />
                  <Line type="monotone" dataKey="avgHealth" stroke="#3b82f6" name="Avg Health Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
