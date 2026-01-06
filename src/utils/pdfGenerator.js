import jsPDF from 'jspdf';
import { getCategoryReport } from './reportContent';
import { CATEGORY_RANGES } from './scoreRanges';
import { generateActionItems } from './reportContent';
import companyLogo from '../assets/companyLogo.png';

/**
 * Generate professional business PDF report
 * Simple, clean black and white design suitable for professional use
 */
export async function generatePDFReport(enhancedScores, userData = {}) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18; // Reduced margin
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  // Helper to check if we need a new page
  const checkNewPage = async (requiredHeight) => {
    if (currentY + requiredHeight > pageHeight - margin - 12) { // Reduced footer space
      pdf.addPage();
      currentY = margin;
      // Add header to new page
      await addPageHeader();
      return true;
    }
    return false;
  };

  // Helper to sanitize text for PDF (preserve line breaks but normalize)
  const sanitizeText = (text) => {
    if (!text) return '';
    // Convert to string and normalize whitespace but preserve intentional breaks
    return String(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();
  };

  // Helper to add text with proper wrapping and adequate line spacing
  const addText = (text, x, y, maxWidth, fontSize = 10, bold = false, lineHeight = null) => {
    if (!text) return 0;
    
    pdf.setFontSize(fontSize);
    pdf.setFont(undefined, bold ? 'bold' : 'normal');
    pdf.setTextColor(0, 0, 0); // Black text
    
    // Sanitize text
    const cleanText = sanitizeText(text);
    if (!cleanText) return 0;
    
    try {
      // Split text into lines that fit within maxWidth
      const lines = pdf.splitTextToSize(cleanText, maxWidth);
      if (!lines || lines.length === 0) return 0;
      
      // Use compact line spacing - 1.2x font size for better page usage
      const lineSpacing = lineHeight || (fontSize * 1.2);
      const lineHeightFactor = lineSpacing / fontSize;
      
      // Render text with proper line spacing
      pdf.text(lines, x, y, { lineHeightFactor: lineHeightFactor });
      
      // Return the actual height used
      return lines.length * lineSpacing;
    } catch (e) {
      console.warn('Text rendering error:', e);
      // Fallback: render as single line (truncated if needed)
      try {
        const safeText = cleanText.substring(0, Math.floor(maxWidth / (fontSize * 0.6))).trim();
        if (safeText) {
          pdf.text(safeText, x, y);
          return fontSize * 1.5;
        }
      } catch (e2) {
        console.warn('Fallback text rendering failed:', e2);
      }
      return fontSize * 1.5;
    }
  };

  // Helper to draw a horizontal line
  const drawLine = (x, y, width, lineWidth = 0.5) => {
    pdf.setDrawColor(0, 0, 0); // Black
    pdf.setLineWidth(lineWidth);
    pdf.line(x, y, x + width, y);
  };

  // Helper to get health level text
  const getHealthLevelText = (level) => {
    if (level === 'high') return 'Healthy';
    if (level === 'medium') return 'Needs Tweaking';
    return 'Needs Attention';
  };

  // Helper to get health level colors
  const getHealthColor = (level) => {
    if (level === 'high') return [34, 197, 94]; // Green
    if (level === 'medium') return [234, 179, 8]; // Yellow/Amber
    return [239, 68, 68]; // Red
  };

  // Add page header (logo and report info)
  const addPageHeader = async () => {
    // Try to add logo (only on first page, and try to load it quickly)
    if (pdf.internal.pages.length === 1) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = companyLogo;
        
        // If image is already loaded, use it immediately
        if (img.complete && img.naturalWidth > 0) {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imgData = canvas.toDataURL('image/png');
            
            const logoWidth = 40;
            const logoHeight = (img.height / img.width) * logoWidth;
            pdf.addImage(imgData, 'PNG', margin, currentY, logoWidth, logoHeight);
          } catch (e) {
            // Logo conversion failed, continue without it
          }
        } else {
          // Try to load it with a short timeout
          await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 500);
            img.onload = () => {
              clearTimeout(timeout);
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/png');
                
                const logoWidth = 40;
                const logoHeight = (img.height / img.width) * logoWidth;
                pdf.addImage(imgData, 'PNG', margin, currentY, logoWidth, logoHeight);
              } catch (e) {
                // Logo conversion failed, continue without it
              }
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              resolve();
            };
          });
        }
      } catch (e) {
        // Logo failed, continue without it
      }
    }

    // Report title and date (right aligned)
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Business Health Check Report', pageWidth - margin, currentY + 5, { align: 'right' });
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      pageWidth - margin,
      currentY + 10,
      { align: 'right' }
    );
    
    // Header line
    drawLine(margin, currentY + 12, contentWidth, 0.5);
    currentY += 15; // Reduced header spacing
  };

  const overallHealth = enhancedScores.overallHealth;
  const categoryKeys = Object.keys(enhancedScores).filter(
    (key) => key !== 'overallHealth'
  );
  const actionItems = generateActionItems(enhancedScores);

  // Add first page header
  await addPageHeader();

  // Overall Health Score Section
  await checkNewPage(30);
  
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Overall Health Score', margin, currentY);
  
  currentY += 10; // Reduced padding above percentage
  
  // Score display with color
  const healthLevel = overallHealth?.healthLevel || 'low';
  const healthColor = getHealthColor(healthLevel);
  pdf.setFontSize(36);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(healthColor[0], healthColor[1], healthColor[2]);
  pdf.text(`${overallHealth?.percentage || 0}%`, margin, currentY);
  
  // Health level indicator with color
  const healthText = getHealthLevelText(healthLevel);
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(healthColor[0], healthColor[1], healthColor[2]);
  pdf.text(`Status: ${healthText}`, margin + 50, currentY - 10);
  
  // Reset to black
  pdf.setTextColor(0, 0, 0);
  currentY += 15; // Reduced spacing

  // Category Performance Overview Table
  await checkNewPage(25);
  
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.text('Category Performance Overview', margin, currentY);
  
  currentY += 8; // Reduced spacing
  
  // Table header
  drawLine(margin, currentY, contentWidth, 0.5);
  currentY += 6; // Reduced spacing
  
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'bold');
  pdf.text('Category', margin, currentY);
  pdf.text('Score', margin + 80, currentY);
  pdf.text('Status', margin + 120, currentY);
  
  currentY += 6; // Reduced spacing
  drawLine(margin, currentY, contentWidth, 0.5);
  currentY += 6; // Reduced spacing
  
  // Category rows
  for (const key of categoryKeys) {
    await checkNewPage(7);
    
    const analytics = enhancedScores[key];
    const categoryRange = CATEGORY_RANGES[key];
    if (!analytics || !categoryRange) continue;

    const statusText = getHealthLevelText(analytics.healthLevel);
    const categoryColor = getHealthColor(analytics.healthLevel);
    
    // Category name
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(categoryRange.label, margin, currentY);
    
    // Score with color
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2]);
    pdf.text(`${analytics.percentage}%`, margin + 80, currentY);
    
    // Status with color
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2]);
    pdf.text(statusText, margin + 120, currentY);
    
    // Reset to black
    pdf.setTextColor(0, 0, 0);
    
    currentY += 6; // Reduced spacing
  }
  
  currentY += 5; // Reduced spacing
  drawLine(margin, currentY, contentWidth, 0.5);
  currentY += 10; // Reduced spacing

  // Executive Summary
  await checkNewPage(25);
  
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.text('Executive Summary', margin, currentY);
  
  currentY += 7; // Reduced spacing
  
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(0, 0, 0);
  const summaryText = `This comprehensive assessment evaluates your business across ${categoryKeys.length} key performance areas. Your overall health score is ${overallHealth?.percentage || 0}% (${getHealthLevelText(healthLevel)}). The detailed analysis below provides insights into each category, identifying strengths and areas requiring attention to support strategic growth and operational excellence.`;
  const summaryHeight = addText(summaryText, margin, currentY, contentWidth, 10, false);
  currentY += summaryHeight + 8; // Reduced spacing

  // Detailed Category Analysis
  await checkNewPage(10);
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Detailed Category Analysis', margin, currentY);
  
  currentY += 6; // Reduced padding

  for (const key of categoryKeys) {
    const analytics = enhancedScores[key];
    const categoryRange = CATEGORY_RANGES[key];
    const report = getCategoryReport(key, analytics.healthLevel);
    
    if (!analytics || !categoryRange) continue;

    await checkNewPage(50);
    
    // Category header
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(categoryRange.label, margin, currentY);
    
    // Score and status on same line with color
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const statusText = getHealthLevelText(analytics.healthLevel);
    const categoryColor = getHealthColor(analytics.healthLevel);
    pdf.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2]);
    pdf.text(`Score: ${analytics.percentage}% (${statusText})`, pageWidth - margin, currentY, { align: 'right' });
    
    // Reset to black
    pdf.setTextColor(0, 0, 0);
    currentY += 7; // Reduced spacing
    
    // Score details
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    const rawScoreText = `Raw Score: ${analytics.rawScore} / ${analytics.maxPossible}`;
    pdf.text(rawScoreText, margin, currentY);
    
    currentY += 6; // Reduced spacing
    
    // Simple progress bar (black and white)
    const barWidth = contentWidth;
    const barHeight = 3;
    const progressWidth = (analytics.percentage / 100) * barWidth;
    
    // Background bar
    pdf.setDrawColor(200, 200, 200); // Light gray border
    pdf.setFillColor(240, 240, 240); // Light gray fill
    pdf.rect(margin, currentY, barWidth, barHeight, 'FD');
    
    // Progress fill (black)
    pdf.setFillColor(0, 0, 0); // Black
    pdf.rect(margin, currentY, progressWidth, barHeight, 'F');
    
    currentY += 7; // Reduced spacing
    
    // Analysis text
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(0, 0, 0);
    const messageText = report.message || '';
    const messageHeight = addText(
      messageText,
      margin,
      currentY,
      contentWidth,
      10,
      false
    );
    currentY += messageHeight + 3; // Reduced padding after analysis
    
    // Resources (if any)
    if (report.resources && report.resources.length > 0) {
      currentY += 2; // Reduced padding before resources
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Recommended Resources:', margin, currentY);
      currentY += 5; // Reduced padding
      
      for (const resource of report.resources) {
        await checkNewPage(8);
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(0, 0, 0);
        const resourceTitle = resource.title || '';
        pdf.text(`• ${resourceTitle}`, margin + 3, currentY);
        if (resource.description) {
          currentY += 4; // Reduced padding
          const descText = resource.description || '';
          const descHeight = addText(
            descText,
            margin + 6,
            currentY,
            contentWidth - 6,
            8,
            false
          );
          currentY += descHeight + 1; // Reduced padding
        } else {
          currentY += 4; // Reduced padding
        }
      }
    }
    
    currentY += 4; // Reduced space between categories
    drawLine(margin, currentY, contentWidth, 0.3);
    currentY += 5; // Reduced padding after divider
  }

  // Priority Action Items
  if (actionItems.length > 0) {
    await checkNewPage(25);
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('Priority Action Items', margin, currentY);
    
    currentY += 7; // Reduced spacing
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text('Based on your assessment, here are the areas that need immediate attention:', margin, currentY);
    currentY += 7; // Reduced spacing
    
    for (let index = 0; index < actionItems.length; index++) {
      const item = actionItems[index];
      await checkNewPage(35);
      
      // Item number and category label
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.text(`${index + 1}. ${item.categoryLabel}`, margin, currentY);
      
      currentY += 6; // Reduced spacing
      
      // Message
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      const itemMessage = item.message || '';
      const itemHeight = addText(
        itemMessage,
        margin,
        currentY,
        contentWidth,
        10,
        false
      );
      currentY += itemHeight + 4; // Reduced spacing
      
      // Resources if available
      if (item.resources && item.resources.length > 0) {
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.text('Quick Actions:', margin, currentY);
        currentY += 5; // Reduced spacing
        
        item.resources.forEach((resource) => {
          pdf.setFontSize(9);
          pdf.setFont(undefined, 'normal');
          const resourceTitle = resource.title || '';
          pdf.text(`• ${resourceTitle}`, margin + 3, currentY);
          currentY += 5; // Reduced spacing
        });
      }
      
      currentY += 6; // Reduced spacing
    }
  }

  // Next Steps
  await checkNewPage(20);
  
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.text('Next Steps', margin, currentY);
  
  currentY += 7; // Reduced spacing
  
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  const nextStepsText = 'Schedule a consultation with one of our assessment strategists to develop a customized plan for your business growth.';
  addText(nextStepsText, margin, currentY, contentWidth, 10, false);

  // Footer on all pages
  const pageCount = pdf.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    
    // Footer line
    drawLine(margin, pageHeight - 12, contentWidth, 0.3);
    
    // Footer text
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100, 100, 100); // Dark gray
    
    // Left: Company/Report info
    pdf.text('Business Health Check Assessment', margin, pageHeight - 8);
    
    // Right: Page number
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return pdf;
}

/**
 * Download PDF report
 */
export async function downloadPDFReport(enhancedScores, userData = {}) {
  try {
    const pdf = await generatePDFReport(enhancedScores, userData);
    const filename = `BHC_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF report:', error);
    alert('Error generating PDF report. Please try again.');
  }
}
