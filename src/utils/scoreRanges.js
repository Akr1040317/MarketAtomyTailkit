/**
 * Score Range Definitions for BHC Assessment Categories
 * Based on BHC Section Range Definition CSV files
 */

export const CATEGORY_RANGES = {
  foundationalStructure: {
    label: "Foundational Structure",
    sections: [2, 3, 5, 6, 7],
    lowRangeTop: 44,
    medRangeTop: 90,
    formLow: 7.75,
    formHigh: 135,
    maxPossible: 135, // Maximum possible score
  },
  financialPosition: {
    label: "Financial Position",
    sections: [4, 8, 11, 12, 16, 17, 18],
    lowRangeTop: 33,
    medRangeTop: 120,
    formLow: 13,
    formHigh: 169,
    maxPossible: 169,
  },
  salesMarketing: {
    label: "Sales & Marketing",
    sections: [10, 12, 13, 14, 15],
    lowRangeTop: 44,
    medRangeTop: 100,
    formLow: 12,
    formHigh: 138,
    maxPossible: 138,
  },
  productService: {
    label: "Product/Service",
    sections: [8, 9, 19],
    lowRangeTop: 25,
    medRangeTop: 56,
    formLow: -1,
    formHigh: 64,
    maxPossible: 64,
  },
  general: {
    label: "General",
    sections: [20, 21],
    lowRangeTop: -10,
    medRangeTop: 20,
    formLow: -18,
    formHigh: 29,
    maxPossible: 29,
  },
};

/**
 * Get category range configuration by key
 */
export function getCategoryRange(categoryKey) {
  return CATEGORY_RANGES[categoryKey] || null;
}

/**
 * Get maximum possible score for a category
 */
export function getCategoryMaxScore(categoryKey) {
  const range = getCategoryRange(categoryKey);
  return range ? range.maxPossible : 0;
}

/**
 * Get health level thresholds for a category
 */
export function getCategoryThresholds(categoryKey) {
  const range = getCategoryRange(categoryKey);
  if (!range) return null;
  
  return {
    low: {
      min: range.formLow,
      max: range.lowRangeTop,
    },
    medium: {
      min: range.lowRangeTop + 1,
      max: range.medRangeTop,
    },
    high: {
      min: range.medRangeTop + 1,
      max: range.maxPossible,
    },
  };
}

