import React from 'react';
import companyLogo from '../../assets/companyLogo.png';
import { getCategoryReport } from '../../utils/reportContent';
import { CATEGORY_RANGES } from '../../utils/scoreRanges';
import { getHealthLevelLabel } from '../../utils/analytics';
import { generateActionItems } from '../../utils/reportContent';

/**
 * PDF Report Component
 * Renders the exact design of the Reports page for PDF generation
 * Uses only inline styles (no Tailwind) to avoid oklch color issues
 */
export default function PDFReport({ enhancedScores, userData = {} }) {
  if (!enhancedScores) return null;

  const overallHealth = enhancedScores.overallHealth;
  const categoryKeys = Object.keys(enhancedScores).filter(
    (key) => key !== 'overallHealth'
  );
  const actionItems = generateActionItems(enhancedScores);

  const getHealthLevelBadge = (level) => {
    const healthLabel = getHealthLevelLabel(level);
    
    // Map health levels to colors
    const badgeStyles = {
      high: {
        backgroundColor: 'rgb(220, 252, 231)',
        color: 'rgb(22, 101, 52)',
        borderColor: 'rgb(34, 197, 94)',
      },
      medium: {
        backgroundColor: 'rgb(254, 243, 199)',
        color: 'rgb(113, 63, 18)',
        borderColor: 'rgb(234, 179, 8)',
      },
      low: {
        backgroundColor: 'rgb(254, 226, 226)',
        color: 'rgb(153, 27, 27)',
        borderColor: 'rgb(239, 68, 68)',
      },
    };
    
    const styles = badgeStyles[level] || badgeStyles.low;
    const label = level === 'high' ? 'Healthy' : level === 'medium' ? 'Needs Tweaking' : 'Needs Attention';
    
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '9999px',
          fontWeight: '600',
          fontSize: '12px',
          padding: '4px 8px',
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          border: `1px solid ${styles.borderColor}`,
        }}
      >
        {label}
      </span>
    );
  };

  const getColorClasses = (healthLevel) => {
    const colorClasses = {
      high: {
        bgStyle: {
          background: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(5, 150, 105, 0.2))',
        },
        borderColor: 'rgba(34, 197, 94, 0.5)',
        textColor: 'rgb(74, 222, 128)',
        progressColor: 'rgb(34, 197, 94)',
      },
      medium: {
        bgStyle: {
          background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.2), rgba(217, 119, 6, 0.2))',
        },
        borderColor: 'rgba(234, 179, 8, 0.5)',
        textColor: 'rgb(250, 204, 21)',
        progressColor: 'rgb(234, 179, 8)',
      },
      low: {
        bgStyle: {
          background: 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.2), rgba(225, 29, 72, 0.2))',
        },
        borderColor: 'rgba(239, 68, 68, 0.5)',
        textColor: 'rgb(248, 113, 113)',
        progressColor: 'rgb(239, 68, 68)',
      },
    };
    return colorClasses[healthLevel] || colorClasses.low;
  };

  return (
    <div
      id="pdf-report"
      style={{
        backgroundColor: 'rgb(255, 255, 255)',
        width: '210mm',
        minHeight: '297mm',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(to right, rgb(5, 150, 105), rgb(20, 184, 166), rgb(6, 182, 212))',
          padding: '48px 32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          <div style={{ flex: 1, width: '100%' }}>
            {/* Logo */}
            <div style={{ marginBottom: '24px' }}>
              <img
                src={companyLogo}
                alt="Company Logo"
                style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <h1
              style={{
                fontSize: '36px',
                fontWeight: '700',
                color: 'rgb(255, 255, 255)',
                marginBottom: '16px',
                lineHeight: '1.2',
              }}
            >
              Business Health Check Report
            </h1>
            <p
              style={{
                fontSize: '20px',
                color: 'rgb(209, 250, 229)',
                marginBottom: '24px',
              }}
            >
              Comprehensive analysis of your business performance across key areas
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '12px 24px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: 'rgb(209, 250, 229)',
                    marginBottom: '4px',
                  }}
                >
                  Overall Health Score
                </div>
                <div
                  style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    color: 'rgb(255, 255, 255)',
                  }}
                >
                  {overallHealth?.percentage || 0}%
                </div>
              </div>
              {overallHealth && getHealthLevelBadge(overallHealth.healthLevel)}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  color: 'rgb(209, 250, 229)',
                  marginBottom: '12px',
                }}
              >
                Assessment Date
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: 'rgb(255, 255, 255)',
                }}
              >
                {new Date().toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div
        style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          borderBottom: '1px solid rgb(55, 65, 81)',
          marginTop: '-32px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ padding: '64px 32px 24px 32px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '16px',
            }}
          >
            {categoryKeys.map((key) => {
              const analytics = enhancedScores[key];
              const categoryRange = CATEGORY_RANGES[key];
              if (!analytics || !categoryRange) return null;

              const colors = getColorClasses(analytics.healthLevel);

              return (
                <div
                  key={key}
                  style={{
                    position: 'relative',
                    textAlign: 'center',
                    padding: '20px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.borderColor}`,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    ...colors.bgStyle,
                  }}
                >
                  {/* Percentage Display */}
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        fontSize: '36px',
                        fontWeight: '800',
                        marginBottom: '4px',
                        color: colors.textColor,
                      }}
                    >
                      {analytics.percentage}%
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: 'rgb(209, 213, 219)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {categoryRange.label}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        backgroundColor: 'rgba(55, 65, 81, 0.5)',
                      }}
                    >
                      <div
                        style={{
                          height: '8px',
                          borderRadius: '9999px',
                          width: `${Math.min(100, analytics.percentage)}%`,
                          backgroundColor: colors.progressColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Health Badge */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    {getHealthLevelBadge(analytics.healthLevel)}
                  </div>

                  {/* Score Details */}
                  <div
                    style={{
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(75, 85, 99, 0.5)',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: 'rgb(156, 163, 175)' }}>
                      Score:{' '}
                      <span style={{ color: 'rgb(209, 213, 219)', fontWeight: '600' }}>
                        {analytics.rawScore}
                      </span>{' '}
                      /{' '}
                      <span style={{ color: 'rgb(209, 213, 219)', fontWeight: '600' }}>
                        {analytics.maxPossible}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Report Content */}
      <div style={{ padding: '32px' }}>
        {/* Executive Summary */}
        <section
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '32px',
            marginBottom: '32px',
          }}
        >
          <h2
            style={{
              fontSize: '30px',
              fontWeight: '700',
              color: 'rgb(17, 24, 39)',
              marginBottom: '16px',
            }}
          >
            Executive Summary
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'rgb(55, 65, 81)',
                  marginBottom: '8px',
                }}
              >
                Overall Business Health
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span
                  style={{
                    fontSize: '48px',
                    fontWeight: '800',
                    color: 'rgb(17, 24, 39)',
                  }}
                >
                  {overallHealth?.percentage || 0}%
                </span>
                {overallHealth && getHealthLevelBadge(overallHealth.healthLevel)}
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'rgb(55, 65, 81)',
                  marginBottom: '8px',
                }}
              >
                Assessment Overview
              </h3>
              <p style={{ color: 'rgb(75, 85, 99)', lineHeight: '1.6' }}>
                Your business has been evaluated across {categoryKeys.length} key performance
                areas. Review the detailed breakdown below to understand your strengths and areas
                for improvement.
              </p>
            </div>
          </div>
        </section>

        {/* Category Breakdown */}
        <section style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontSize: '30px',
              fontWeight: '700',
              color: 'rgb(17, 24, 39)',
              marginBottom: '24px',
            }}
          >
            Category-by-Category Breakdown
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
            }}
          >
            {categoryKeys.map((key) => {
              const analytics = enhancedScores[key];
              const categoryRange = CATEGORY_RANGES[key];
              const report = getCategoryReport(key, analytics.healthLevel);

              if (!analytics || !categoryRange) return null;

              const colors = getColorClasses(analytics.healthLevel);
              const progressBarColor =
                analytics.healthLevel === 'high'
                  ? 'rgb(34, 197, 94)'
                  : analytics.healthLevel === 'medium'
                  ? 'rgb(234, 179, 8)'
                  : 'rgb(239, 68, 68)';

              return (
                <div
                  key={key}
                  style={{
                    backgroundColor: 'rgb(255, 255, 255)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgb(229, 231, 235)',
                    padding: '24px',
                  }}
                >
                  {/* Header with percentage and badge side by side */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: '20px',
                          fontWeight: '700',
                          color: 'rgb(17, 24, 39)',
                          marginBottom: '8px',
                        }}
                      >
                        {categoryRange.label}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            fontSize: '30px',
                            fontWeight: '800',
                            color: 'rgb(17, 24, 39)',
                          }}
                        >
                          {analytics.percentage}%
                        </span>
                        {getHealthLevelBadge(analytics.healthLevel)}
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: 'rgb(249, 250, 251)',
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '14px',
                        color: 'rgb(75, 85, 99)',
                        marginBottom: '8px',
                      }}
                    >
                      <span>
                        Score: {analytics.rawScore} / {analytics.maxPossible}
                      </span>
                      <span style={{ fontWeight: '600' }}>{analytics.percentage}%</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        backgroundColor: 'rgb(229, 231, 235)',
                      }}
                    >
                      <div
                        style={{
                          height: '8px',
                          borderRadius: '9999px',
                          width: `${Math.min(100, analytics.percentage)}%`,
                          backgroundColor: progressBarColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Report Message - Detailed Analysis */}
                  <div style={{ marginBottom: '16px' }}>
                    <p
                      style={{
                        color: 'rgb(55, 65, 81)',
                        lineHeight: '1.6',
                        fontSize: '14px',
                      }}
                    >
                      {report.message}
                    </p>
                  </div>

                  {/* Resources */}
                  {report.resources && report.resources.length > 0 && (
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: '1px solid rgb(229, 231, 235)',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: 'rgb(17, 24, 39)',
                          marginBottom: '12px',
                        }}
                      >
                        Recommended Resources:
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {report.resources.slice(0, 3).map((resource, index) => (
                          <div
                            key={index}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid rgb(229, 231, 235)',
                            }}
                          >
                            <div style={{ flexShrink: 0, marginTop: '2px' }}>
                              <svg
                                style={{ width: '20px', height: '20px', color: 'rgb(156, 163, 175)' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                />
                              </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: '600',
                                  color: 'rgb(17, 24, 39)',
                                  fontSize: '14px',
                                }}
                              >
                                {resource.title}
                              </div>
                              {resource.description && (
                                <div
                                  style={{
                                    fontSize: '12px',
                                    color: 'rgb(75, 85, 99)',
                                    marginTop: '4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {resource.description}
                                </div>
                              )}
                              <div style={{ marginTop: '4px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    backgroundColor: 'rgb(209, 250, 231)',
                                    color: 'rgb(6, 78, 59)',
                                  }}
                                >
                                  {resource.type}
                                </span>
                              </div>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              <svg
                                style={{ width: '16px', height: '16px', color: 'rgb(156, 163, 175)' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Priority Action Items */}
        {actionItems.length > 0 && (
          <section
            style={{
              backgroundColor: 'rgb(255, 255, 255)',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              padding: '32px',
              marginBottom: '32px',
            }}
          >
            <h2
              style={{
                fontSize: '30px',
                fontWeight: '700',
                color: 'rgb(17, 24, 39)',
                marginBottom: '16px',
              }}
            >
              Priority Action Items
            </h2>
            <p style={{ color: 'rgb(75, 85, 99)', marginBottom: '24px' }}>
              Based on your assessment, here are the areas that need immediate attention:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {actionItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    backgroundColor: 'rgb(254, 242, 242)',
                    borderLeft: '4px solid rgb(239, 68, 68)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'rgb(239, 68, 68)',
                        color: 'rgb(255, 255, 255)',
                        borderRadius: '9999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                      }}
                    >
                      {index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <h4
                        style={{
                          fontWeight: '600',
                          color: 'rgb(17, 24, 39)',
                          marginBottom: '4px',
                        }}
                      >
                        {item.categoryLabel}
                      </h4>
                      <p
                        style={{
                          color: 'rgb(55, 65, 81)',
                          fontSize: '14px',
                          marginBottom: '8px',
                        }}
                      >
                        {item.message}
                      </p>
                      {item.resources && item.resources.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <p
                            style={{
                              fontSize: '12px',
                              fontWeight: '500',
                              color: 'rgb(75, 85, 99)',
                              marginBottom: '4px',
                            }}
                          >
                            Quick Actions:
                          </p>
                          <ul
                            style={{
                              listStyle: 'disc',
                              listStylePosition: 'inside',
                              fontSize: '12px',
                              color: 'rgb(75, 85, 99)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            {item.resources.map((resource, rIndex) => (
                              <li key={rIndex}>{resource.title}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Next Steps */}
        <section
          style={{
            background: 'linear-gradient(to right, rgb(16, 185, 129), rgb(20, 184, 166))',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '32px',
            color: 'rgb(255, 255, 255)',
          }}
        >
          <h2 style={{ fontSize: '30px', fontWeight: '700', marginBottom: '16px' }}>
            Next Steps
          </h2>
          <p style={{ marginBottom: '24px', color: 'rgb(209, 250, 229)' }}>
            Ready to take action? Schedule a consultation with one of our assessment strategists
            to develop a customized plan for your business growth.
          </p>
        </section>
      </div>
    </div>
  );
}
