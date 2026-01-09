/**
 * Admin Utility Functions
 * Helper functions for admin dashboard operations
 */

/**
 * Export users data to CSV format
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Applied filters (for filename)
 * @returns {string} CSV formatted string
 */
export function exportUsersToCSV(users, filters = {}) {
  if (!users || users.length === 0) {
    return '';
  }

  // CSV headers
  const headers = [
    'Email',
    'First Name',
    'Last Name',
    'Username',
    'Role',
    'Signup Date',
    'Last Login',
    'Assessment Completed',
    'Overall Health Score',
    'Overall Health Level'
  ];

  // Convert users to CSV rows
  const rows = users.map(user => {
    const signupDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A';
    const lastLogin = user.lastLoggedOn?.toDate ? user.lastLoggedOn.toDate().toLocaleDateString() : 'Never';
    
    // Check if assessment is completed (has computedScores with all categories)
    const hasScores = user.computedScores && Object.keys(user.computedScores).length > 0;
    const assessmentCompleted = hasScores ? 'Yes' : 'No';
    
    // Get overall health if available
    const overallHealth = user.overallHealth || {};
    const healthScore = overallHealth.percentage !== undefined ? overallHealth.percentage : 'N/A';
    const healthLevel = overallHealth.healthLevel || 'N/A';

    return [
      user.email || '',
      user.firstName || '',
      user.lastName || '',
      user.username || '',
      user.role || 'tier1',
      signupDate,
      lastLogin,
      assessmentCompleted,
      healthScore,
      healthLevel
    ].map(field => {
      // Escape commas and quotes in CSV
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Export analytics data to CSV format
 * @param {Object} analyticsData - Analytics data object
 * @returns {string} CSV formatted string
 */
export function exportAnalyticsToCSV(analyticsData) {
  if (!analyticsData) {
    return '';
  }

  const rows = [];
  
  // Overall metrics
  rows.push(['Metric', 'Value']);
  rows.push(['Total Users', analyticsData.totalUsers || 0]);
  rows.push(['Active Users (30 days)', analyticsData.activeUsers || 0]);
  rows.push(['Completion Rate', `${analyticsData.completionRate || 0}%`]);
  rows.push(['Average Overall Health Score', analyticsData.averageOverallHealth || 0]);
  rows.push([]);
  
  // Category averages
  rows.push(['Category', 'Average Score', 'Average Percentage']);
  if (analyticsData.categoryAverages) {
    Object.entries(analyticsData.categoryAverages).forEach(([category, data]) => {
      rows.push([
        category,
        data.averageScore || 0,
        `${data.averagePercentage || 0}%`
      ]);
    });
  }
  rows.push([]);
  
  // Health level distribution
  rows.push(['Health Level', 'Count', 'Percentage']);
  if (analyticsData.healthLevelDistribution) {
    Object.entries(analyticsData.healthLevelDistribution).forEach(([level, data]) => {
      rows.push([
        level,
        data.count || 0,
        `${data.percentage || 0}%`
      ]);
    });
  }

  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Aggregate user scores across all users
 * @param {Array} users - Array of user objects with computedScores
 * @returns {Object} Aggregated score data
 */
export function aggregateUserScores(users) {
  if (!users || users.length === 0) {
    return {
      categoryTotals: {},
      categoryAverages: {},
      healthLevelDistribution: { low: 0, medium: 0, high: 0 },
      totalUsers: 0
    };
  }

  const categoryTotals = {};
  const categoryCounts = {};
  const healthLevelCounts = { low: 0, medium: 0, high: 0 };
  let usersWithScores = 0;

  users.forEach(user => {
    if (user.computedScores && Object.keys(user.computedScores).length > 0) {
      usersWithScores++;
      
      // Aggregate category scores
      Object.entries(user.computedScores).forEach(([category, data]) => {
        if (category !== 'overallHealth' && data && typeof data.total === 'number') {
          if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
            categoryCounts[category] = 0;
          }
          categoryTotals[category] += data.total;
          categoryCounts[category]++;
        }
      });

      // Count health levels
      if (user.overallHealth && user.overallHealth.healthLevel) {
        const level = user.overallHealth.healthLevel;
        if (healthLevelCounts.hasOwnProperty(level)) {
          healthLevelCounts[level]++;
        }
      }
    }
  });

  // Calculate averages
  const categoryAverages = {};
  Object.keys(categoryTotals).forEach(category => {
    const count = categoryCounts[category];
    categoryAverages[category] = {
      total: categoryTotals[category],
      average: count > 0 ? categoryTotals[category] / count : 0,
      count: count
    };
  });

  return {
    categoryTotals,
    categoryAverages,
    healthLevelDistribution: healthLevelCounts,
    totalUsers: users.length,
    usersWithScores
  };
}

/**
 * Calculate assessment completion rate
 * @param {Array} users - Array of user objects
 * @param {number} totalSections - Total number of assessment sections
 * @returns {number} Completion rate percentage
 */
export function calculateCompletionRate(users, totalSections) {
  if (!users || users.length === 0 || !totalSections || totalSections === 0) {
    return 0;
  }

  let completedCount = 0;

  users.forEach(user => {
    // Check if user has completed all sections
    // This is a simplified check - in reality, we'd check sectionResults collection
    if (user.computedScores && Object.keys(user.computedScores).length >= 5) {
      // Check if all main categories have scores
      const requiredCategories = ['foundationalStructure', 'financialPosition', 'salesMarketing', 'productService', 'general'];
      const hasAllCategories = requiredCategories.every(cat => 
        user.computedScores[cat] && user.computedScores[cat].total !== undefined
      );
      if (hasAllCategories) {
        completedCount++;
      }
    }
  });

  return totalSections > 0 ? Math.round((completedCount / users.length) * 100) : 0;
}

/**
 * Get health level distribution percentages
 * @param {Object} healthLevelCounts - Object with health level counts
 * @returns {Object} Health level distribution with percentages
 */
export function getHealthLevelDistribution(healthLevelCounts) {
  const total = Object.values(healthLevelCounts).reduce((sum, count) => sum + count, 0);
  
  if (total === 0) {
    return {
      low: { count: 0, percentage: 0 },
      medium: { count: 0, percentage: 0 },
      high: { count: 0, percentage: 0 }
    };
  }

  return {
    low: {
      count: healthLevelCounts.low || 0,
      percentage: Math.round(((healthLevelCounts.low || 0) / total) * 100)
    },
    medium: {
      count: healthLevelCounts.medium || 0,
      percentage: Math.round(((healthLevelCounts.medium || 0) / total) * 100)
    },
    high: {
      count: healthLevelCounts.high || 0,
      percentage: Math.round(((healthLevelCounts.high || 0) / total) * 100)
    }
  };
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV content string
 * @param {string} filename - Filename for download
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Filter users based on search criteria
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered users array
 */
export function filterUsers(users, filters) {
  if (!users || users.length === 0) {
    return [];
  }

  let filtered = [...users];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(user => {
      const email = (user.email || '').toLowerCase();
      const firstName = (user.firstName || '').toLowerCase();
      const lastName = (user.lastName || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      
      return email.includes(searchLower) ||
             firstName.includes(searchLower) ||
             lastName.includes(searchLower) ||
             username.includes(searchLower);
    });
  }

  // Role filter
  if (filters.role && filters.role !== 'all') {
    filtered = filtered.filter(user => user.role === filters.role);
  }

  // Assessment status filter
  if (filters.assessmentStatus) {
    if (filters.assessmentStatus === 'completed') {
      filtered = filtered.filter(user => {
        return user.computedScores && Object.keys(user.computedScores).length >= 5;
      });
    } else if (filters.assessmentStatus === 'incomplete') {
      filtered = filtered.filter(user => {
        return !user.computedScores || Object.keys(user.computedScores).length < 5;
      });
    }
  }

  // Date range filter
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter(user => {
      if (!user.createdAt) return false;
      const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return userDate >= fromDate;
    });
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999); // End of day
    filtered = filtered.filter(user => {
      if (!user.createdAt) return false;
      const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return userDate <= toDate;
    });
  }

  return filtered;
}
