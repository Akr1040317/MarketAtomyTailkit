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

/**
 * Calculate section-level statistics
 * @param {Array} sectionResults - Array of section result objects
 * @param {Array} sections - Array of section objects from BHC_Assessment
 * @param {number} totalUsers - Total number of users for completion rate calculation
 * @returns {Object} Section statistics
 */
export function calculateSectionStatistics(sectionResults, sections, totalUsers = 0) {
  if (!sectionResults || !sections || sectionResults.length === 0) {
    return {};
  }

  const sectionStats = {};
  
  // Get unique user IDs from sectionResults for accurate completion rate
  const uniqueUserIds = new Set(sectionResults.map(r => r.userId).filter(Boolean));
  const actualTotalUsers = totalUsers > 0 ? totalUsers : uniqueUserIds.size;
  
  sections.forEach(section => {
    // Check if section has questions with weightage
    const hasWeightage = section.questions?.some(q => {
      if (!q.options || !Array.isArray(q.options)) return false;
      return q.options.some(opt => (opt.weight || 0) > 0);
    });

    // Skip sections without weightage (like Section 1: Business Information)
    if (!hasWeightage) {
      return;
    }

    const results = sectionResults.filter(r => r.sectionName === section.title);
    if (results.length === 0) {
      sectionStats[section.title] = {
        averageScore: 0,
        completionRate: 0,
        totalResponses: 0,
        scoreDistribution: { low: 0, medium: 0, high: 0 },
        scores: []
      };
      return;
    }

    const scores = results.map(r => r.sectionScore || 0).filter(s => s !== null && s !== undefined);
    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;

    // Calculate score distribution (need to determine thresholds per section)
    // For now, use simple thresholds: low < 33%, medium 33-66%, high > 66%
    const maxPossible = section.questions?.reduce((sum, q) => {
      if (q.options && Array.isArray(q.options)) {
        const maxWeight = Math.max(...q.options.map(o => o.weight || 0));
        return sum + maxWeight;
      }
      return sum;
    }, 0) || 100;

    const low = scores.filter(s => s < maxPossible * 0.33).length;
    const medium = scores.filter(s => s >= maxPossible * 0.33 && s < maxPossible * 0.66).length;
    const high = scores.filter(s => s >= maxPossible * 0.66).length;

    // Calculate completion rate based on total users, not total sectionResults
    const completionRate = actualTotalUsers > 0 
      ? Math.round((results.length / actualTotalUsers) * 100)
      : 0;

    sectionStats[section.title] = {
      averageScore: Math.round(averageScore * 10) / 10,
      completionRate,
      totalResponses: results.length,
      scoreDistribution: { low, medium, high },
      scores,
      maxPossible,
      sectionOrder: section.order || 0
    };
  });

  return sectionStats;
}

/**
 * Calculate question-level statistics
 * @param {Array} sectionResults - Array of section result objects
 * @param {Array} sections - Array of section objects from BHC_Assessment
 * @returns {Object} Question statistics
 */
export function calculateQuestionStatistics(sectionResults, sections) {
  if (!sectionResults || !sections || sectionResults.length === 0) {
    return {};
  }

  const questionStats = {};

  sections.forEach(section => {
    if (!section.questions || section.questions.length === 0) return;

    section.questions.forEach(question => {
      const questionId = question.id;
      const results = sectionResults.filter(r => r.sectionName === section.title);
      
      let totalAnswers = 0;
      let totalWeight = 0;
      const answerCounts = {};
      const answerWeights = {};

      results.forEach(result => {
        const answer = result.answers?.[questionId];
        if (!answer) return;

        totalAnswers++;

        if (question.type === 'multipleChoice' && answer.answer) {
          const answerText = answer.answer;
          answerCounts[answerText] = (answerCounts[answerText] || 0) + 1;
          totalWeight += answer.weight || 0;
          answerWeights[answerText] = (answerWeights[answerText] || 0) + (answer.weight || 0);
        } else if (question.type === 'multipleSelect' && Array.isArray(answer)) {
          answer.forEach(a => {
            const answerText = a.answer;
            answerCounts[answerText] = (answerCounts[answerText] || 0) + 1;
            totalWeight += a.weight || 0;
            answerWeights[answerText] = (answerWeights[answerText] || 0) + (a.weight || 0);
          });
        } else if (answer.answer) {
          const answerText = String(answer.answer);
          answerCounts[answerText] = (answerCounts[answerText] || 0) + 1;
        }
      });

      const mostCommonAnswer = Object.entries(answerCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      questionStats[questionId] = {
        questionId,
        questionText: question.text,
        sectionName: section.title,
        sectionOrder: section.order || 0,
        questionType: question.type,
        totalAnswers,
        averageWeight: totalAnswers > 0 ? Math.round((totalWeight / totalAnswers) * 10) / 10 : 0,
        completionRate: results.length > 0 ? Math.round((totalAnswers / results.length) * 100) : 0,
        mostCommonAnswer,
        answerDistribution: answerCounts,
        answerWeights,
        options: question.options || []
      };
    });
  });

  return questionStats;
}

/**
 * Calculate category percentiles
 * @param {Array} users - Array of user objects
 * @param {string} categoryKey - Category key
 * @returns {Object} Percentile data
 */
export function calculateCategoryPercentiles(users, categoryKey) {
  if (!users || users.length === 0 || !categoryKey) {
    return {
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      min: 0,
      max: 0,
      average: 0,
      stdDev: 0
    };
  }

  const scores = users
    .map(user => {
      const categoryData = user.computedScores?.[categoryKey];
      return categoryData?.total;
    })
    .filter(score => score !== undefined && score !== null)
    .sort((a, b) => a - b);

  if (scores.length === 0) {
    return {
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      min: 0,
      max: 0,
      average: 0,
      stdDev: 0
    };
  }

  const percentile = (arr, p) => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  };

  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  return {
    p25: percentile(scores, 25),
    p50: percentile(scores, 50),
    p75: percentile(scores, 75),
    p90: percentile(scores, 90),
    min: Math.min(...scores),
    max: Math.max(...scores),
    average: Math.round(average * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    count: scores.length
  };
}

/**
 * Calculate time-based metrics
 * @param {Array} users - Array of user objects
 * @param {Array} sectionResults - Array of section result objects
 * @returns {Object} Time-based analytics
 */
export function calculateTimeMetrics(users, sectionResults) {
  if (!users || !sectionResults) {
    return {
      registrationTrends: [],
      completionTimeline: [],
      averageCompletionTime: 0,
      activityPatterns: {}
    };
  }

  // Registration trends (by month)
  const registrationTrends = {};
  users.forEach(user => {
    if (user.createdAt) {
      const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      registrationTrends[monthKey] = (registrationTrends[monthKey] || 0) + 1;
    }
  });

  // Completion timeline
  const completionTimeline = {};
  sectionResults.forEach(result => {
    if (result.submittedAt) {
      const date = result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!completionTimeline[monthKey]) {
        completionTimeline[monthKey] = { count: 0, uniqueUsers: new Set() };
      }
      completionTimeline[monthKey].count++;
      completionTimeline[monthKey].uniqueUsers.add(result.userId);
    }
  });

  // Average completion time (time between first and last section submission per user)
  const userCompletionTimes = {};
  sectionResults.forEach(result => {
    if (!result.submittedAt || !result.userId) return;
    const date = result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt);
    if (!userCompletionTimes[result.userId]) {
      userCompletionTimes[result.userId] = [];
    }
    userCompletionTimes[result.userId].push(date.getTime());
  });

  const completionTimes = Object.values(userCompletionTimes)
    .map(times => {
      if (times.length < 2) return null;
      const sorted = times.sort((a, b) => a - b);
      return (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24); // Convert to days
    })
    .filter(time => time !== null);

  const averageCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length
    : 0;

  // Activity patterns (by day of week)
  const activityPatterns = {
    byDayOfWeek: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    byHour: {}
  };

  sectionResults.forEach(result => {
    if (result.submittedAt) {
      const date = result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt);
      const dayOfWeek = date.getDay();
      activityPatterns.byDayOfWeek[dayOfWeek] = (activityPatterns.byDayOfWeek[dayOfWeek] || 0) + 1;
      
      const hour = date.getHours();
      activityPatterns.byHour[hour] = (activityPatterns.byHour[hour] || 0) + 1;
    }
  });

  return {
    registrationTrends: Object.entries(registrationTrends)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    completionTimeline: Object.entries(completionTimeline)
      .map(([month, data]) => ({
        month,
        submissions: data.count,
        uniqueUsers: data.uniqueUsers.size
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    averageCompletionTime: Math.round(averageCompletionTime * 10) / 10,
    activityPatterns
  };
}

/**
 * Compare metrics between two datasets
 * @param {Object} data1 - First dataset
 * @param {Object} data2 - Second dataset
 * @param {string} metric - Metric to compare
 * @returns {Object} Comparison results
 */
export function compareMetrics(data1, data2, metric) {
  if (!data1 || !data2 || !metric) {
    return { difference: 0, percentageChange: 0 };
  }

  const value1 = data1[metric] || 0;
  const value2 = data2[metric] || 0;
  const difference = value2 - value1;
  const percentageChange = value1 !== 0 ? ((difference / value1) * 100) : 0;

  return {
    value1,
    value2,
    difference: Math.round(difference * 10) / 10,
    percentageChange: Math.round(percentageChange * 10) / 10,
    isImprovement: difference > 0
  };
}

/**
 * Fetch all section results efficiently
 * @param {Object} db - Firestore database instance
 * @returns {Promise<Array>} Array of section results
 */
export async function fetchSectionResults(db) {
  try {
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
    const sectionResultsQuery = query(collection(db, 'sectionResults'), orderBy('submittedAt', 'desc'));
    const querySnapshot = await getDocs(sectionResultsQuery);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching section results:', error);
    return [];
  }
}

/**
 * Get answer distributions for a specific question
 * @param {string} questionId - Question ID
 * @param {Array} sectionResults - Array of section result objects
 * @param {Object} question - Question object with options
 * @returns {Object} Answer distribution data
 */
export function calculateAnswerDistributions(questionId, sectionResults, question) {
  if (!questionId || !sectionResults || !question) {
    return { distribution: {}, totalAnswers: 0 };
  }

  const distribution = {};
  let totalAnswers = 0;

  sectionResults.forEach(result => {
    const answer = result.answers?.[questionId];
    if (!answer) return;

    totalAnswers++;

    if (question.type === 'multipleChoice' && answer.answer) {
      const answerText = answer.answer;
      if (!distribution[answerText]) {
        distribution[answerText] = { count: 0, totalWeight: 0 };
      }
      distribution[answerText].count++;
      distribution[answerText].totalWeight += answer.weight || 0;
    } else if (question.type === 'multipleSelect' && Array.isArray(answer)) {
      answer.forEach(a => {
        const answerText = a.answer;
        if (!distribution[answerText]) {
          distribution[answerText] = { count: 0, totalWeight: 0 };
        }
        distribution[answerText].count++;
        distribution[answerText].totalWeight += a.weight || 0;
      });
    } else if (answer.answer) {
      const answerText = String(answer.answer);
      if (!distribution[answerText]) {
        distribution[answerText] = { count: 0, totalWeight: 0 };
      }
      distribution[answerText].count++;
    }
  });

  // Calculate percentages
  Object.keys(distribution).forEach(key => {
    distribution[key].percentage = totalAnswers > 0
      ? Math.round((distribution[key].count / totalAnswers) * 100)
      : 0;
    distribution[key].averageWeight = distribution[key].count > 0
      ? Math.round((distribution[key].totalWeight / distribution[key].count) * 10) / 10
      : 0;
  });

  return { distribution, totalAnswers };
}

/**
 * Aggregate section scores
 * @param {Array} sectionResults - Array of section result objects
 * @returns {Object} Aggregated scores by section
 */
export function aggregateSectionScores(sectionResults) {
  if (!sectionResults || sectionResults.length === 0) {
    return {};
  }

  const aggregated = {};

  sectionResults.forEach(result => {
    const sectionName = result.sectionName;
    if (!aggregated[sectionName]) {
      aggregated[sectionName] = {
        scores: [],
        totalResponses: 0,
        averageScore: 0
      };
    }
    if (result.sectionScore !== undefined && result.sectionScore !== null) {
      aggregated[sectionName].scores.push(result.sectionScore);
      aggregated[sectionName].totalResponses++;
    }
  });

  // Calculate averages
  Object.keys(aggregated).forEach(sectionName => {
    const data = aggregated[sectionName];
    if (data.scores.length > 0) {
      data.averageScore = Math.round(
        (data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length) * 10
      ) / 10;
    }
  });

  return aggregated;
}
