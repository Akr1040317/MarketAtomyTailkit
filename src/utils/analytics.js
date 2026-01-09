import { CATEGORY_RANGES, getCategoryRange, getCategoryMaxScore, getCategoryThresholds } from './scoreRanges.js';

/**
 * Normalize a raw score to a percentage
 * @param {number} rawScore - The raw score value
 * @param {number} maxPossible - Maximum possible score
 * @returns {number} Percentage score (0-100)
 */
export function normalizeScore(rawScore, maxPossible) {
  if (!maxPossible || maxPossible === 0) return 0;
  const percentage = (rawScore / maxPossible) * 100;
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, percentage));
}

/**
 * Determine health level based on category and raw score
 * @param {string} categoryKey - Category key (e.g., 'foundationalStructure')
 * @param {number} rawScore - Raw score value
 * @returns {string} Health level: 'low', 'medium', or 'high'
 */
export function determineHealthLevel(categoryKey, rawScore) {
  const thresholds = getCategoryThresholds(categoryKey);
  if (!thresholds) return 'low';

  if (rawScore <= thresholds.low.max) {
    return 'low';
  } else if (rawScore <= thresholds.medium.max) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * Get health level label for display
 * @param {string} level - Health level ('low', 'medium', 'high')
 * @returns {object} Label and color information
 */
export function getHealthLevelLabel(level) {
  const labels = {
    low: {
      label: 'Needs Attention',
      shortLabel: 'Low',
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-500',
    },
    medium: {
      label: 'Needs Tweaking',
      shortLabel: 'Medium',
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-500',
    },
    high: {
      label: 'Healthy',
      shortLabel: 'High',
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-500',
    },
  };

  return labels[level] || labels.low;
}

/**
 * Calculate category analytics from raw score
 * @param {string} categoryKey - Category key
 * @param {number} rawScore - Raw score value
 * @returns {object} Analytics object with normalized score, health level, etc.
 */
export function calculateCategoryAnalytics(categoryKey, rawScore) {
  const maxPossible = getCategoryMaxScore(categoryKey);
  const healthLevel = determineHealthLevel(categoryKey, rawScore);
  const percentage = normalizeScore(rawScore, maxPossible);
  const healthLabel = getHealthLevelLabel(healthLevel);

  return {
    rawScore,
    maxPossible,
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
    healthLevel,
    healthLabel,
  };
}

/**
 * Calculate overall business health score
 * @param {object} categoryScores - Object with category keys and their analytics
 * @returns {object} Overall health analytics
 */
export function calculateOverallHealth(categoryScores) {
  const categories = Object.keys(categoryScores);
  let totalPercentage = 0;
  let validCategories = 0;

  categories.forEach((key) => {
    const analytics = categoryScores[key];
    if (analytics && typeof analytics.percentage === 'number') {
      totalPercentage += analytics.percentage;
      validCategories++;
    }
  });

  const overallPercentage = validCategories > 0 
    ? totalPercentage / validCategories 
    : 0;

  // Determine overall health level based on average percentage
  let overallLevel = 'low';
  if (overallPercentage >= 70) {
    overallLevel = 'high';
  } else if (overallPercentage >= 40) {
    overallLevel = 'medium';
  }

  return {
    percentage: Math.round(overallPercentage * 10) / 10,
    healthLevel: overallLevel,
    healthLabel: getHealthLevelLabel(overallLevel),
    categoryCount: validCategories,
  };
}

/**
 * Process computed scores and add analytics
 * @param {object} computedScores - Raw computed scores from Firestore
 * @returns {object} Enhanced scores with analytics
 */
export function processComputedScores(computedScores) {
  if (!computedScores) return null;

  const enhanced = {};
  const categoryKeys = Object.keys(computedScores);

  categoryKeys.forEach((key) => {
    const categoryData = computedScores[key];
    if (categoryData && typeof categoryData.total === 'number') {
      enhanced[key] = {
        ...categoryData,
        ...calculateCategoryAnalytics(key, categoryData.total),
      };
    }
  });

  // Calculate overall health
  enhanced.overallHealth = calculateOverallHealth(enhanced);

  return enhanced;
}

/**
 * Get priority action items based on health levels
 * @param {object} enhancedScores - Processed scores with analytics
 * @returns {array} Array of priority action items
 */
export function getPriorityActionItems(enhancedScores) {
  if (!enhancedScores) return [];

  const actionItems = [];
  const categoryKeys = Object.keys(enhancedScores).filter(
    (key) => key !== 'overallHealth'
  );

  // Sort categories by health level (lowest first)
  const sortedCategories = categoryKeys
    .map((key) => ({
      key,
      analytics: enhancedScores[key],
    }))
    .filter((item) => item.analytics)
    .sort((a, b) => {
      const levelOrder = { low: 0, medium: 1, high: 2 };
      return (
        levelOrder[a.analytics.healthLevel] -
        levelOrder[b.analytics.healthLevel]
      );
    });

  // Get top 3 categories that need attention
  sortedCategories.slice(0, 3).forEach((item) => {
    const range = getCategoryRange(item.key);
    actionItems.push({
      category: item.key,
      categoryLabel: range?.label || item.key,
      healthLevel: item.analytics.healthLevel,
      score: item.analytics.percentage,
      priority: actionItems.length + 1,
    });
  });

  return actionItems;
}

