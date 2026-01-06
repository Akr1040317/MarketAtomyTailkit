import { getHealthLevelLabel } from '../../utils/analytics';

/**
 * Health Level Badge Component
 * Displays a badge indicating the health level (Low/Medium/High)
 */
export default function HealthLevelBadge({ level, size = 'md' }) {
  const healthLabel = getHealthLevelLabel(level);

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${healthLabel.bgColor} ${healthLabel.textColor} ${healthLabel.borderColor} border ${sizeClasses[size]}`}
    >
      {healthLabel.label}
    </span>
  );
}

