import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const healthPdfsDir = path.join(__dirname, 'src', 'assets', 'healthPdfs');

async function convertDocxToPdf(docxPath, pdfPath) {
  try {
    console.log(`Converting ${path.basename(docxPath)} to PDF...`);
    
    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ path: docxPath });
    const html = result.value;
    
    // Create a full HTML document
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              line-height: 1.6;
            }
            p { margin: 10px 0; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            table, th, td { border: 1px solid #ddd; }
            th, td { padding: 8px; text-align: left; }
            h1, h2, h3, h4, h5, h6 { margin-top: 20px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
    
    // Convert HTML to PDF using Puppeteer
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000); // 60 second timeout
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    await browser.close();
    
    console.log(`✓ Created ${path.basename(pdfPath)}`);
  } catch (error) {
    console.error(`Error converting ${path.basename(docxPath)}:`, error.message);
  }
}

function convertXlsxToCsv(xlsxPath, csvPath) {
  try {
    console.log(`Converting ${path.basename(xlsxPath)} to CSV...`);
    
    // Read the Excel file
    const workbook = XLSX.readFile(xlsxPath);
    
    // Get the first sheet name
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to CSV
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    // Write CSV file
    fs.writeFileSync(csvPath, csv, 'utf8');
    
    console.log(`✓ Created ${path.basename(csvPath)}`);
    
    // If there are multiple sheets, convert them too
    if (workbook.SheetNames.length > 1) {
      workbook.SheetNames.forEach((sheet, index) => {
        if (index === 0) return; // Skip first sheet (already converted)
        const sheetCsv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheet]);
        const sheetCsvPath = csvPath.replace('.csv', `_${sheet}.csv`);
        fs.writeFileSync(sheetCsvPath, sheetCsv, 'utf8');
        console.log(`✓ Created ${path.basename(sheetCsvPath)}`);
      });
    }
  } catch (error) {
    console.error(`Error converting ${path.basename(xlsxPath)}:`, error.message);
  }
}

async function convertAllFiles() {
  console.log('Starting file conversion...\n');
  
  const files = fs.readdirSync(healthPdfsDir);
  const conversionPromises = [];
  
  for (const file of files) {
    const filePath = path.join(healthPdfsDir, file);
    const ext = path.extname(file).toLowerCase();
    
    if (ext === '.docx') {
      const pdfPath = filePath.replace('.docx', '.pdf');
      // Only convert if PDF doesn't already exist
      if (!fs.existsSync(pdfPath)) {
        conversionPromises.push(convertDocxToPdf(filePath, pdfPath));
      } else {
        console.log(`Skipping ${file} - PDF already exists`);
      }
    } else if (ext === '.xlsx') {
      const csvPath = filePath.replace('.xlsx', '.csv');
      // Only convert if CSV doesn't already exist
      if (!fs.existsSync(csvPath)) {
        convertXlsxToCsv(filePath, csvPath);
      } else {
        console.log(`Skipping ${file} - CSV already exists`);
      }
    } else if (ext === '.pptx') {
      console.log(`⚠ Skipping ${file} - PPTX conversion requires LibreOffice or specialized tools`);
    } else if (ext === '.pdf') {
      console.log(`✓ ${file} is already a PDF`);
    }
  }
  
  // Wait for all PDF conversions to complete
  await Promise.all(conversionPromises);
  
  console.log('\n✓ Conversion complete!');
}

// Run the conversion
convertAllFiles().catch(console.error);

