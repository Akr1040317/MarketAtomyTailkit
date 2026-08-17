import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const csvPath = path.join(
  root,
  "src/assets/healthPdfs/BHC Section Range Definition Rev 01.csv"
);
const logoPath = path.join(root, "src/assets/MarketAtomy-HOR-300x92.png");
const outDir = path.join(root, "docs");
const htmlPath = path.join(outDir, "MarketAtomy_BHC_Redesign_Brief.html");
const pdfPath = path.join(outDir, "MarketAtomy_BHC_Redesign_Brief.pdf");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseSections(rows) {
  const sections = [];
  let current = null;
  for (const r of rows) {
    const c0 = (r[0] || "").trim();
    const c1 = (r[1] || "").trim();
    const sectionMatch =
      c0.match(/^Section\s+(\d+)\s*[-–]?\s*(.+)/i) ||
      c1.match(/^Section\s+(\d+)\s*[-–]?\s*(.+)/i);
    if (sectionMatch && !/summary/i.test(`${c0} ${c1}`)) {
      if (current) sections.push(current);
      current = {
        number: Number(sectionMatch[1]),
        title: sectionMatch[2]
        .replace(/Section\s+\d+\s*[-–]\s*/gi, "")
        .replace(/,+$/, "")
        .trim(),
        questions: [],
      };
      continue;
    }
    if (!current) {
      if (!sections.length) {
        current = {
          number: 1,
          title: "Company Profile / Business Intake",
          questions: [],
        };
      }
    }
    const qNum = c0.replace(/[^0-9]/g, "");
    const qText = c1.replace(/^Section\s+\d+\s*[-–]\s*/i, "").trim();
    const qType = (r[2] || "").trim();
    const low = (r[3] || "").trim();
    const high = (r[4] || "").trim();
    if (!qText || /summary|grand total|section title|submission id|submission date/i.test(qText)) continue;
    if (!qNum && !qType) continue;
    if (/^(IP|Category|Low|High)$/i.test(qText) && !qNum) continue;
    current.questions.push({
      number: qNum || "—",
      text: qText,
      type: qType || "Profile",
      low,
      high,
    });
  }
  if (current) sections.push(current);
  return sections.filter((s) => s.questions.length);
}

const typeMap = {
  "Yes/No": "multipleChoice (typically Yes/No with weights)",
  YesNo: "multipleChoice",
  Single: "multipleChoice (single select)",
  Multiple: "multipleSelect (select all that apply; weights are summed)",
  single: "multipleChoice (single select)",
  Profile: "text / intake field (no score weight)",
};

const sections = parseSections(parseCsv(fs.readFileSync(csvPath, "utf8")));
const logoData = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const questionsHtml = sections
  .map((s) => {
    const rows = s.questions
      .map(
        (q) => `<tr>
      <td>${escapeHtml(q.number)}</td>
      <td>${escapeHtml(q.text)}</td>
      <td>${escapeHtml(typeMap[q.type] || q.type)}</td>
      <td>${escapeHtml(q.low)}</td>
      <td>${escapeHtml(q.high)}</td>
    </tr>`
      )
      .join("");
    return `<h3>Section ${s.number}: ${escapeHtml(s.title)}</h3>
    <p class="muted">${s.questions.length} items. Exact option labels and per-option weights live in Firestore <code>BHC_Assessment</code> and must be preserved.</p>
    <table>
      <thead><tr><th>#</th><th>Question</th><th>Input type</th><th>Low</th><th>High</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>MarketAtomy Business Health Check — Full Product &amp; Redesign Brief</title>
<style>
  :root {
    --navy: #0B1F4A;
    --navy-2: #101B31;
    --royal: #2E6BB0;
    --cyan: #2BB3C7;
    --yellow: #F5C400;
    --orange: #F26522;
    --magenta: #E23B6A;
    --ink: #102033;
    --muted: #5B6B80;
    --paper: #F7F4EC;
    --card: #FFFFFF;
    --line: #E4DCC8;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, "Segoe UI", Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: var(--paper);
    line-height: 1.55;
    font-size: 11.5pt;
  }
  .page { padding: 36px 48px; }
  h1, h2, h3, h4 { color: var(--navy); page-break-after: avoid; }
  h1 { font-size: 28pt; line-height: 1.15; margin: 0 0 8px; }
  h2 {
    font-size: 16pt;
    margin: 36px 0 12px;
    padding-bottom: 6px;
    border-bottom: 3px solid var(--yellow);
  }
  h3 { font-size: 13pt; margin: 22px 0 8px; color: var(--royal); }
  h4 { font-size: 11.5pt; margin: 16px 0 6px; }
  p { margin: 0 0 10px; }
  .muted { color: var(--muted); }
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(160deg, #050B18 0%, #0B1F4A 55%, #14284F 100%);
    color: white;
    padding: 64px 56px;
    page-break-after: always;
  }
  .cover img { height: 56px; background: white; padding: 8px 14px; border-radius: 8px; }
  .cover h1 { color: white; font-size: 34pt; max-width: 16ch; }
  .cover .tag {
    display: inline-block;
    background: linear-gradient(90deg, var(--yellow), var(--orange), var(--magenta));
    color: #111;
    font-weight: 800;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 10pt;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .cover .meta { color: #C9D6EA; font-size: 11pt; }
  .swatches { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 18px; }
  .swatch {
    width: 108px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); background: white;
  }
  .swatch .chip { height: 42px; }
  .swatch .lab { padding: 6px 8px; font-size: 8.5pt; }
  ul, ol { margin: 0 0 12px; padding-left: 20px; }
  li { margin: 0 0 5px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 18px; font-size: 9.5pt; }
  th, td { border: 1px solid var(--line); padding: 6px 8px; vertical-align: top; }
  th { background: var(--navy); color: white; text-align: left; }
  tr:nth-child(even) td { background: #FFFDF7; }
  code, .k { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5pt; background: #EEE8D6; padding: 1px 5px; border-radius: 4px; }
  .callout {
    background: white;
    border-left: 6px solid var(--orange);
    padding: 12px 14px;
    margin: 12px 0 18px;
    border-radius: 0 10px 10px 0;
  }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .card { background: white; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9pt; font-weight: 700; }
  .low { background: #FDE8E8; color: #B42318; }
  .med { background: #FEF4C7; color: #854D0E; }
  .high { background: #DCFCE7; color: #166534; }
  .toc a { color: var(--royal); text-decoration: none; }
  .toc li { margin-bottom: 4px; }
  .keep { background: #FFF6D6; padding: 10px 12px; border-radius: 8px; margin: 10px 0 16px; }
  @page { size: Letter; margin: 0.55in 0.55in 0.7in; }
  @media print {
    .cover { min-height: 10.2in; }
    h2 { page-break-before: always; }
    h2:first-of-type { page-break-before: avoid; }
    table, .card, .callout { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<section class="cover">
  <div>
    <img src="${logoData}" alt="MarketAtomy" />
    <p style="margin-top:28px"><span class="tag">Claude Design Brief</span></p>
    <h1>Business Health Check Assessment</h1>
    <p style="font-size:16pt; max-width: 36ch; color:#E8EEF8">Complete product, UX, scoring, Firebase, and redesign specification for every public page, client view, admin view, and onboarding walkthrough.</p>
  </div>
  <div class="meta">
    <p>Prepared for a full visual and UX redesign of the MarketAtomy BHC web app.</p>
    <p>Product: MarketAtomy LLC · App: businesshealthassessment · Date: August 17, 2026</p>
    <p>Constraint: Redesign UI/UX only. Preserve Firebase collections, field names, scoring math, and question IDs.</p>
  </div>
</section>

<div class="page">

<h2>1. How to use this document</h2>
<p>This brief is the source of truth for remaking the entire website. Rebuild every screen, empty state, modal, and flow. Do not invent a new scoring model. Do not rename Firestore collections or break existing documents.</p>
<div class="callout"><strong>Primary instruction for Claude Design:</strong> Produce a premium, brand-true MarketAtomy experience for two modes — Client View and Admin View — with a guided first-run walkthrough. Keep all current capabilities. Elevate visual design, information architecture, onboarding, and interaction quality. Use the logo colors below, not generic Tailwind gray/emerald.</div>
<ol>
  <li>Match MarketAtomy brand colors, logo, and tone.</li>
  <li>Cover every page listed in Section 5.</li>
  <li>Preserve Firebase document logic in Section 11.</li>
  <li>Preserve scoring and category math in Section 10.</li>
  <li>Add the onboarding / walkthrough specified in Section 8.</li>
  <li>Do not require payment to use the product yet. $297 is marketing copy only; there is no Stripe checkout in this app.</li>
</ol>

<h2>2. Product overview</h2>
<p>MarketAtomy is a business-growth consulting firm. The Business Health Check (BHC) is a scored diagnostic that evaluates a company across 21 sections / ~20 KPIs, grouped into five interdependent systems. After the client answers section by section, the app computes category scores, health levels, a written report, recommended resources, and a growth roadmap.</p>
<div class="grid2">
  <div class="card">
    <h4>Mission</h4>
    <p>“Focus on the DREAM… Trust the PROCESS!” MarketAtomy prepares owners through cognitive awareness, focused education, and strategic collaboration.</p>
  </div>
  <div class="card">
    <h4>Promise of the assessment</h4>
    <p>If you don’t know what you don’t know, you can’t know what to fix. The BHC shows gaps that cause high cost and failure: poor management, undercapitalization, and incorrect pricing.</p>
  </div>
</div>
<p><strong>Positioning stats used on the landing page:</strong> 400,000+ new businesses start annually; 70% fail within 24 months; 20 critical areas evaluated. Price shown: <strong>$297</strong> (not collected in-app).</p>
<p><strong>Live app:</strong> Firebase project <code>businesshealthassessment</code>, hosting default <code>https://businesshealthassessment.web.app</code>. Stack: React 19, Vite, React Router, Tailwind 4, Firebase Auth + Firestore, Cloud Functions, Recharts, jsPDF / @react-pdf/renderer.</p>

<h2>3. Brand, colors, type, and assets</h2>
<p>The current UI is a generic dark Tailwind kit (gray-900 + emerald). That is wrong for MarketAtomy. Rebuild using the logo system.</p>
<img src="${logoData}" alt="MarketAtomy logo" style="height:48px;background:#000;padding:10px 16px;border-radius:8px;margin:8px 0 16px" />
<h3>Logo construction</h3>
<ul>
  <li>Circular yellow ring with a jagged rising “M” chart that breaks the circle as an upward arrow.</li>
  <li>Chart fill is a vertical gradient: yellow → orange → reddish magenta.</li>
  <li>Wordmark: “Market” in dark navy italic sans, “Atomy” in royal/medium blue. The A is an upward arrow with a yellow tip.</li>
  <li>Never recolor the logo mark. Place it on navy, black, or white. On dark backgrounds, give it a light plate or use the existing horizontal PNG.</li>
</ul>
<h3>Color tokens (required)</h3>
<div class="swatches">
  ${[
    ["#0B1F4A", "Navy / Market"],
    ["#101B31", "App navy"],
    ["#2E6BB0", "Royal / Atomy"],
    ["#2BB3C7", "Cyan accent"],
    ["#F5C400", "Brand yellow"],
    ["#F26522", "Brand orange"],
    ["#E23B6A", "Magenta"],
    ["#050B18", "True black"],
    ["#F7F4EC", "Warm paper"],
    ["#166534", "Healthy"],
    ["#854D0E", "Needs tweaking"],
    ["#B42318", "Needs attention"],
  ]
    .map(
      ([hex, name]) =>
        `<div class="swatch"><div class="chip" style="background:${hex}"></div><div class="lab"><strong>${hex}</strong><br/>${name}</div></div>`
    )
    .join("")}
</div>
<ul>
  <li><strong>Primary CTA:</strong> orange → yellow gradient, white text, bold. Used today for “Get Started / Start Assessment”.</li>
  <li><strong>Secondary CTA:</strong> navy or royal outline on dark; white fill on light.</li>
  <li><strong>Health colors:</strong> keep semantic meaning. High/Healthy = green, Medium/Needs Tweaking = gold/yellow, Low/Needs Attention = red. Do not use emerald as the brand color.</li>
  <li><strong>Surfaces:</strong> dark navy shells for app chrome; warm off-white cards for reports, forms, and data tables (reports are currently white cards on dark — keep that contrast, refine it).</li>
  <li><strong>Type:</strong> Inter is already the app font. Pair a confident italic/oblique display for headlines if needed, but stay professional. No playful startup fonts.</li>
  <li><strong>Voice:</strong> direct, coach-like, slightly urgent, never cute. MarketAtomy speaks to owners who are overwhelmed. Use “working ON the business vs IN the business.”</li>
</ul>
<h3>Assets to keep using</h3>
<table>
  <thead><tr><th>File</th><th>Use</th></tr></thead>
  <tbody>
    <tr><td><code>src/assets/MarketAtomy-HOR-300x92.png</code></td><td>Primary logo in nav, sidebar, emails, PDF reports, onboarding</td></tr>
    <tr><td><code>src/assets/companyLogo.png</code></td><td>Alternate/full logo if needed</td></tr>
    <tr><td><code>src/assets/poweredBy.png</code></td><td>Login/signup footer lockup</td></tr>
    <tr><td><code>src/assets/google.png</code></td><td>Google sign-in button</td></tr>
    <tr><td>marketatomy.com resource PDFs / videos / Calendly</td><td>Recommended resources (do not invent fake URLs)</td></tr>
  </tbody>
</table>

<h2>4. Roles and modes</h2>
<table>
  <thead><tr><th>Role</th><th>Who</th><th>What they see</th></tr></thead>
  <tbody>
    <tr><td><code>tier1</code></td><td>Default for every new signup</td><td>Client View: dashboard, assessment, reports, feedback, bug report</td></tr>
    <tr><td><code>admin</code></td><td>Staff; also email <code>dannaolivo@gmail.com</code> is hard-coded into admin mode</td><td>Admin Dashboard, Assessment Management, all user data</td></tr>
    <tr><td><code>tier2</code> / <code>tier3</code></td><td>Named in comments / admin dropdowns, not functionally gated</td><td>Treat as future paid tiers. Do not block features yet.</td></tr>
  </tbody>
</table>
<p>Danna’s account has an <strong>Admin / Client toggle</strong> in the header so she can demo both modes. Keep this. Admins who are not Danna stay in admin unless you add a similar preview toggle.</p>
<p>There is <strong>no paywall</strong>. Signup creates <code>role: "tier1"</code> and routes to <code>/dashboard</code>. Do not add a blocking checkout unless explicitly designed as an optional later step.</p>

<h2>5. Current information architecture</h2>
<h3>Routes</h3>
<table>
  <thead><tr><th>URL</th><th>Screen</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td><code>/</code></td><td>Marketing landing</td><td>Hero, stats, 5 systems, why assess, about, CTA</td></tr>
    <tr><td><code>/login</code></td><td>Login (same LandingPage shell)</td><td>Email/password + Google</td></tr>
    <tr><td><code>/signup</code></td><td>Signup (same LandingPage shell)</td><td>First, last, username, email, password, Google</td></tr>
    <tr><td><code>/dashboard</code></td><td>Authenticated app shell</td><td>All logged-in views are state tabs inside this route, not separate URLs</td></tr>
    <tr><td><code>/home</code></td><td>Unused Tailkit starter</td><td>Do not redesign; remove or ignore</td></tr>
  </tbody>
</table>
<div class="keep"><strong>IA recommendation for the redesign:</strong> Give real URLs to major views (<code>/assessment</code>, <code>/report</code>, <code>/admin/users</code>, etc.) so onboarding, emails, and deep links work. Keep Firebase auth gate on all app routes.</div>

<h3>Authenticated shell (sidebar)</h3>
<p>Both modes share a left navy sidebar, top bar (“Welcome to the BHC (Client View | Admin View)”), user name, logout, Give Feedback, Report a Bug.</p>
<div class="grid2">
  <div class="card">
    <h4>Client sidebar</h4>
    <ul>
      <li>Dashboard</li>
      <li>Assessment</li>
      <li>Reports (opened from dashboard CTA today; should be a first-class nav item)</li>
      <li>Give Feedback</li>
      <li>Report a Bug</li>
      <li>Logout</li>
    </ul>
  </div>
  <div class="card">
    <h4>Admin sidebar</h4>
    <ul>
      <li>Admin Dashboard (users / analytics / content / monitoring tabs)</li>
      <li>Assessment Management (edit questions)</li>
      <li>Give Feedback / Report a Bug / Logout</li>
      <li>Admin/Client preview toggle for Danna</li>
    </ul>
  </div>
</div>

<h2>6. Public website pages to redesign</h2>
<h3>6.1 Landing page</h3>
<p>Must keep the story, not the generic dark-kit look.</p>
<ul>
  <li>Sticky nav: logo, Features, Assessment, About, Login, Get Started</li>
  <li>Hero: “Business Health Check Assessment”, 20 critical performance areas, $297, Start Assessment, Sign In, privacy line (no spam)</li>
  <li>Visual: four sample health score cards (Foundational, Financial, Sales &amp; Marketing, Product Viability)</li>
  <li>Stats: 400,000+ / 70% / 20</li>
  <li>The 5 Business Health Systems with area chips</li>
  <li>What you’ll receive: PDF report, category scores, health indicators, action items, resources, roadmap, progress tracking, recommendations</li>
  <li>Why take it + the line “If you don’t know what you don’t know…”</li>
  <li>About MarketAtomy + mission + link to marketatomy.com</li>
  <li>Final CTA repeating $297</li>
  <li>Footer © MarketAtomy LLC</li>
</ul>
<h3>6.2 Login</h3>
<ul>
  <li>Email, password, show/hide, Sign in, Google popup, link to signup, forgot password exists as a component (<code>ForgotPassword.jsx</code>) but is not clearly routed — include it in the redesign</li>
  <li>On success: if no <code>users/{uid}</code> doc, create a basic one, then go to dashboard</li>
</ul>
<h3>6.3 Signup</h3>
<ul>
  <li>Required: first name, last name, username, email, password, confirm password</li>
  <li>Live username availability check against <code>usernames/{lowercase}</code> (this read is public on purpose)</li>
  <li>Google signup may omit username</li>
  <li>Creates Auth user, <code>users/{uid}</code> with <code>role: "tier1"</code>, and username doc</li>
  <li>Then dashboard. Welcome email is sent by Cloud Function</li>
</ul>

<h2>7. Client view — every screen and behavior</h2>
<h3>7.1 Client Dashboard</h3>
<p>Home after login. Purpose: status, scores, next action.</p>
<ul>
  <li>Intro: what the BHC is (21 KPIs / 5 systems)</li>
  <li>Completion badge: In Progress (n%) or Completed</li>
  <li>Last updated date from <code>users.overallHealth.lastCalculated</code></li>
  <li>Continue Assessment → assessment view</li>
  <li>Five score cards with percentage, health badge, progress bar: Foundational Structure, Financial Strength, Sales &amp; Marketing, Product Viability, Overall Health</li>
  <li>View Full Report / Print Full Report (PDF download)</li>
  <li>Detailed Insights copy that changes if incomplete vs complete vs all-healthy</li>
  <li>Next Steps list generated from scores</li>
  <li>Growth Roadmap: Assessment → Analysis → Strategy → Implementation → Growth (steps 1–3 light up based on completion / low scores)</li>
  <li>Recommended resources (title, description, type chip, optional URL)</li>
</ul>
<h3>7.2 Assessment (client)</h3>
<p>This is the core product. Left: section list + progress bar. Right: one section at a time.</p>
<ul>
  <li>Load sections from <code>BHC_Assessment</code> ordered by <code>order</code></li>
  <li>Mark a section complete if a <code>sectionResults</code> doc exists for that user + <code>sectionName</code></li>
  <li>Clicking a section loads prior answers if present (view mode) with an edit action</li>
  <li>Question types:
    <ul>
      <li><code>multipleChoice</code> — radio; score = selected option.weight</li>
      <li><code>multipleSelect</code> — checkboxes; score = sum of selected weights (can be negative)</li>
      <li>text — stored, weight 0</li>
    </ul>
  </li>
  <li>Optional <code>beginningText</code> / <code>endingText</code> per section</li>
  <li>Must answer all visible questions to submit</li>
  <li>Submit writes/updates <code>sectionResults</code> and recomputes <code>users.computedScores</code> + <code>overallHealth</code></li>
  <li><strong>Section 19 Production gate:</strong> first question “Are you a manufacturing company?”. If No, skip remaining production questions, mark section N/A, reduce Product/Service <code>maxPossible</code> by that section’s max, then auto-advance to next section</li>
  <li>When every section is complete, show assessment feedback form once (not if already in <code>assessmentFeedback</code>)</li>
</ul>
<h3>7.3 Assessment feedback form (post-completion)</h3>
<p>Fields: overallRating, clarityRating, relevanceRating, length (just_right / too_short / too_long), recommendScore, mostValuableSections[], confusingQuestions, missingTopics. Store on <code>assessmentFeedback</code>.</p>
<h3>7.4 Comprehensive report</h3>
<ul>
  <li>Executive summary with overall % and health badge</li>
  <li>One card per category: raw score vs max, %, health level, narrative from report content, resources</li>
  <li>Priority action items for low categories</li>
  <li>PDF export of the same report</li>
  <li>Empty state if no scores yet, with Start Assessment CTA</li>
</ul>
<h3>7.5 Resources</h3>
<p><code>Resources.jsx</code> exists. Promote it in nav. Show recommended resources by category/health, with real URLs (Calendly, PDFs, academy, videos).</p>
<h3>7.6 Feedback modal and bug report modal</h3>
<p>Available from every authenticated page.</p>
<ul>
  <li>Feedback → <code>feedback</code>: rating, feedback, suggestions, userId, userEmail, submittedAt, type</li>
  <li>Bug report → <code>bugReports</code>: title, description, steps, expected, actual, severity, status: open</li>
</ul>
<h3>7.7 Emails the client receives (keep copy, redesign templates if touching email)</h3>
<ul>
  <li>Welcome on <code>users/{uid}</code> create → start assessment</li>
  <li>Reminders if incomplete: first after 2 days, then every 3 days, max 5</li>
  <li>Completion congratulations when all sections are done</li>
</ul>

<h2>8. Required new onboarding and guided walkthrough</h2>
<p>There is currently no onboarding. Add it. Persist <code>users.onboarding</code> so it does not repeat.</p>
<h3>Client walkthrough (first login)</h3>
<ol>
  <li><strong>Welcome:</strong> “You’re about to diagnose 5 business systems.” Logo, 60-second why, estimated time (can complete in sessions).</li>
  <li><strong>How scoring works:</strong> honest answers, some questions have negative weights, health is Needs Attention / Needs Tweaking / Healthy — not a school grade.</li>
  <li><strong>How to take it:</strong> 21 sections, save per section, come back anytime, manufacturing skip on Production.</li>
  <li><strong>What you get:</strong> dashboard scores, full report, PDF, resources, optional coach debrief (Calendly).</li>
  <li><strong>Profile check:</strong> confirm name; optionally collect business name if Section 1 / user profile supports it.</li>
  <li><strong>Start first section</strong> CTA. Secondary: “Explore dashboard first.”</li>
</ol>
<h3>In-product coaching (ongoing)</h3>
<ul>
  <li>Dashboard tooltip pointing at Continue Assessment until first section is done</li>
  <li>After 3 sections: “You’re building a baseline. Finish a category to unlock a richer score.”</li>
  <li>When a category first becomes scorable: brief explanation of that system</li>
  <li>On completion: confetti-free, premium “report ready” moment → report page → book debrief</li>
  <li>Checklist widget: Create account ✓ / Complete intake / Finish all sections / Read report / Book debrief / Download a resource</li>
</ul>
<h3>Admin walkthrough (first admin login)</h3>
<ol>
  <li>User Management: search, role, export, inspect answers</li>
  <li>Analytics: how to read health distribution and drop-off</li>
  <li>Content: editing report narratives and resources</li>
  <li>Assessment Management: warning — changing option weights changes everyone’s future scores; never recycle question IDs</li>
  <li>Monitoring: bugs and feedback queue</li>
</ol>
<p>Each tour step should have Skip, Back, Next, and “Don’t show again.” Store <code>users.onboarding.clientCompleted</code> and <code>users.onboarding.adminCompleted</code>.</p>

<h2>9. Admin view — every screen and behavior</h2>
<h3>9.1 Admin Dashboard tabs</h3>
<p>Gate: <code>users.role === "admin"</code> (Danna also forced into admin UI). Non-admins redirect to client dashboard.</p>
<h4>User Management</h4>
<ul>
  <li>Table of all <code>users</code>, sort by createdAt, name, email, role, assessment progress</li>
  <li>Filters: search (email/name/username), role (admin/tier1), completed vs incomplete, date range</li>
  <li>Change role dropdown (admin can set admin/tier1)</li>
  <li>User detail modal: profile, scores, health, section completion</li>
  <li>Answers modal: pick a section, see that user’s stored answers/weights</li>
  <li>Export users CSV and per-user PDF snapshot</li>
</ul>
<h4>Analytics &amp; Reports</h4>
<p>Tabs: Overview, Section Stats, Question Analysis, Category Breakdown, Time Analytics, Engagement, Predictive Insights. Filters: date, category, section, role, completion. Charts: pie health distribution, bars, lines, radar. CSV/PDF export. Includes at-risk users, drop-off points, average completion time, activity by day/hour, lowest-scoring questions, most skipped.</p>
<h4>Content Management</h4>
<p>Edit <code>reportContent/main</code>: per category × health level (healthy / needsTweaking / unhealthy) — narrative message + resource list (title, description, type, url). Save to Firestore; fallback to code defaults.</p>
<h4>System Monitoring</h4>
<p>Bug reports (filter status/severity, mark resolved) and product feedback (filter rating). Detail modals.</p>
<h3>9.2 Assessment Management</h3>
<p>This is the CMS for the instrument itself. Load/save <code>BHC_Assessment/{id}</code>.</p>
<ul>
  <li>Edit title, order, beginningText, endingText</li>
  <li>Edit question text, type (multipleChoice / multipleSelect / text), options (label + numeric weight, including negatives)</li>
  <li>Add/delete/reorder questions. IDs auto-rebuild as <code>q{order}{letter}</code> e.g. <code>q2a</code>, <code>q2b</code></li>
  <li>Saving overwrites the section document. Warn that ID changes can orphan old <code>sectionResults.answers</code> keys</li>
</ul>
<h3>9.3 ReportsInsights component</h3>
<p>A second analytics report UI exists in code. Fold it into Admin Analytics rather than leaving a hidden duplicate. Same data, cleaner information design.</p>

<h2>10. Scoring and calculations (do not change the math)</h2>
<h3>Per-question</h3>
<p>Score contribution is the weight of the chosen option(s). Multiple select sums. Text is 0. Negative weights are valid (especially Personal Assessment and General).</p>
<h3>Per-section</h3>
<p><code>sectionScore</code> = sum of question contributions in that section. Stored on <code>sectionResults</code>.</p>
<h3>Category mapping (section numbers → category)</h3>
<table>
  <thead><tr><th>Category key</th><th>UI label</th><th>Sections</th><th>formLow</th><th>maxPossible</th><th>Low top</th><th>Med top</th></tr></thead>
  <tbody>
    <tr><td>foundationalStructure</td><td>Foundational Structure</td><td>2, 3, 5, 6, 7</td><td>7.75</td><td>135</td><td>44</td><td>90</td></tr>
    <tr><td>financialPosition</td><td>Financial Strength / Position</td><td>4, 8, 11, 12, 16, 17, 18</td><td>13</td><td>169</td><td>33</td><td>120</td></tr>
    <tr><td>salesMarketing</td><td>Sales &amp; Marketing</td><td>10, 12, 13, 14, 15</td><td>12</td><td>138</td><td>44</td><td>100</td></tr>
    <tr><td>productService</td><td>Product Viability / Product-Service</td><td>8, 9, 19</td><td>-1</td><td>64</td><td>25</td><td>56</td></tr>
    <tr><td>general</td><td>Overall / General Health</td><td>20, 21</td><td>-18</td><td>29</td><td>-10</td><td>20</td></tr>
  </tbody>
</table>
<p>Note: Section 12 counts in both Financial and Sales. Section 8 counts in both Financial and Product. This overlap is intentional.</p>
<h3>Category totals</h3>
<p>For each category, <code>computedScores[category].sections[sectionNumber] = sectionScore</code>, then <code>total = sum(section scores)</code>. Section 1 (intake) is not scored into these five.</p>
<h3>Health levels (raw score, not percentage)</h3>
<ul>
  <li>raw ≤ lowRangeTop → <span class="badge low">low / Needs Attention</span> (report key: unhealthy)</li>
  <li>lowRangeTop+1 to medRangeTop → <span class="badge med">medium / Needs Tweaking</span></li>
  <li>above medRangeTop → <span class="badge high">high / Healthy</span></li>
</ul>
<h3>Percentage display</h3>
<p><code>percentage = clamp(raw / maxPossible * 100, 0, 100)</code>, one decimal. If non-manufacturing, Product/Service may store a reduced <code>maxPossible</code> override.</p>
<h3>Overall health</h3>
<p>Average of the five category percentages. ≥70 high, ≥40 medium, else low. Stored as <code>users.overallHealth</code> with lastCalculated timestamp.</p>
<h3>Action items</h3>
<p>Priority list = categories with healthLevel low (plus a top-3 lowest helper). Each pulls narrative + top resources from report content.</p>
<h3>Report content mapping</h3>
<p>low→unhealthy, medium→needsTweaking, high→healthy. Messages and resources are in <code>src/utils/reportContent.js</code> and optionally overridden by Firestore <code>reportContent/main</code>.</p>
<div class="keep">Claude Design may restyle score cards, gauges, and badges. It may not change thresholds, category membership, overlap, or weight math.</div>

<h3>Category narratives (keep this copy)</h3>
<h4>Foundational Structure</h4>
<p><strong>Healthy:</strong> Congratulations! You have obviously put in the time and effort to ensure that you have built an infrastructure for growth… staying abreast of technology and economic changes.</p>
<p><strong>Needs Tweaking:</strong> You’re doing Great! Although your business appears to have a structured foundation that needs a little update… meeting with an assessment strategist will help identify issues.</p>
<p><strong>Needs Attention:</strong> The foundational/organizational structure appears to have gaps… unclear roles, diminishing bottom line, trouble attracting or retaining customers. Strategists pinpoint gaps and build a sequencing plan.</p>
<h4>Financial Position</h4>
<p><strong>Healthy:</strong> Good handle on financial infrastructure; next stage may be new product, geographic expansion, merger, or equity investment.</p>
<p><strong>Needs Tweaking:</strong> Fairly good handle, but cash flow is holding back growth. Time to work ON the business.</p>
<p><strong>Needs Attention:</strong> Stressed, chasing cash, sluggish revenue, personal reserves tapped. Options exist regardless of credit. Need a financial strategy.</p>
<h4>Sales &amp; Marketing</h4>
<p><strong>Healthy:</strong> Solid sales/marketing; stay current; customer journey, data-mining, predictive analysis.</p>
<p><strong>Needs Tweaking:</strong> Brand and sales exist but cycle fails to grow advocates. Experience determines referral vs deterrent.</p>
<p><strong>Needs Attention:</strong> Struggling to find, attract, convert, and grow customers. Message, audience, or trust may be wrong.</p>
<h4>Product / Service</h4>
<p><strong>Healthy:</strong> Finger on the pulse; customers will pay; stay ahead with SWOT and competitive analysis.</p>
<p><strong>Needs Tweaking:</strong> Needed in market but sales not robust; usually multiple infrastructure gaps, not “just marketing.”</p>
<p><strong>Needs Attention:</strong> Unclear fit; messaging or market may be wrong; problem may not be worth paying to solve. Research before more spend.</p>
<h4>General / Work-life</h4>
<p><strong>Healthy:</strong> Healthy work/life and outlook. Don’t get trapped working only IN the business.</p>
<p><strong>Needs Tweaking:</strong> Attempts at balance exist; watch external threats/opportunities so growth isn’t interrupted.</p>
<p><strong>Needs Attention:</strong> OPA — Overwhelm, Paralysis, Avoidance. Don’t go alone; coach/mentor; Vision Clarification.</p>

<h3>Canonical resource destinations</h3>
<ul>
  <li>Discovery: https://calendly.com/dannaolivo/discovery</li>
  <li>BHC 1:1 debrief: https://calendly.com/dannaolivo/bhc-1-on-1-consult</li>
  <li>Financial consult: https://calendly.com/dannaolivo/bhc-financial-expert-consultation</li>
  <li>Academy: https://marketatomy.academy</li>
  <li>OPA video, SWOT, cashflow, credit 101, marketing worksheets, etc. are hosted on marketatomy.com wp-content uploads (see reportContent.js RESOURCE_OVERRIDES)</li>
</ul>

<h2>11. Firebase document logic (must keep)</h2>
<p>Project ID: <code>businesshealthassessment</code>. Auth: email/password + Google popup. Firestore is the database. Cloud Functions use Admin SDK and bypass rules.</p>
<h3>Collection: users / {uid}</h3>
<pre style="background:#111;color:#F5C400;padding:12px;border-radius:8px;font-size:9pt;white-space:pre-wrap">userId, firstName, lastName, username, email, verified, signupMethod,
role: "tier1" | "admin",
createdAt, lastLoggedOn, lastLoggedOff,
computedScores: {
  foundationalStructure: { sections: { "2": n, ... }, total, maxPossible?, percentage?, healthLevel? },
  financialPosition, salesMarketing, productService, general
},
overallHealth: { percentage, healthLevel, healthLabel, categoryCount, lastCalculated },
emailPreferences: {
  welcomeEmailSent, welcomeEmailSentAt, reminderCount, lastReminderSentAt,
  completionEmailSent, unsubscribed
}
// Redesign may ADD: onboarding { clientCompleted, adminCompleted, step },
// businessName, lastActiveView — do not rename existing fields.</pre>
<h3>Collection: usernames / {lowercaseUsername}</h3>
<p><code>{ userId, username, email, createdAt }</code>. Public get for availability. Create on signup.</p>
<h3>Collection: BHC_Assessment / {sectionId}</h3>
<pre style="background:#111;color:#F5C400;padding:12px;border-radius:8px;font-size:9pt;white-space:pre-wrap">title, order, beginningText, endingText,
questions: [{
  id: "q2a",
  text: "...",
  type: "multipleChoice" | "multipleSelect" | "text",
  options: [{ label: "Yes", weight: 2 }, ...]
}]</pre>
<p>Client reads all sections. Only admin writes. Order is the section number used in scoring maps.</p>
<h3>Collection: sectionResults / {autoId}</h3>
<pre style="background:#111;color:#F5C400;padding:12px;border-radius:8px;font-size:9pt;white-space:pre-wrap">userId, userEmail, submittedAt, sectionName, sectionScore, notApplicable?,
answers: {
  q2a: { answer: "Yes", weight: 2 },          // multipleChoice
  q2c: [{ answer: "Cash", weight: 1 }, ...]     // multipleSelect
}</pre>
<p>One logical result per user per section (code updates the first matching doc). Queries: <code>where userId == uid</code>, and <code>where userId == uid && sectionName == title</code>. Admin lists all, ordered by submittedAt.</p>
<h3>Other collections</h3>
<table>
  <thead><tr><th>Collection</th><th>Write</th><th>Shape</th></tr></thead>
  <tbody>
    <tr><td>assessmentFeedback</td><td>client create</td><td>userId, userEmail, createdAt, assessmentCompleted, responses{}</td></tr>
    <tr><td>feedback</td><td>client create</td><td>userId, userEmail, rating, feedback, suggestions, submittedAt, type</td></tr>
    <tr><td>bugReports</td><td>client create; admin update status</td><td>title, description, steps, expected, actual, severity, status open|resolved</td></tr>
    <tr><td>reportContent/main</td><td>admin</td><td>category → healthy|needsTweaking|unhealthy → {label, message, resources[]}</td></tr>
    <tr><td>mail</td><td>functions / email extension only</td><td>queued emails</td></tr>
    <tr><td>carts, orders, pendingOrders</td><td>legacy academy/commerce on same project</td><td>Do not delete rules; this BHC app does not UI them</td></tr>
  </tbody>
</table>
<h3>Security rules (already deployed)</h3>
<ul>
  <li>Signed-in users read BHC_Assessment and their own user doc / sectionResults / assessmentFeedback</li>
  <li>Users cannot change their own <code>role</code> or wallet/stripe fields</li>
  <li>Admins (role admin or Danna’s email) can list users, all results, bugs, feedback, and edit assessment/content</li>
  <li>Username get is public; list is admin</li>
</ul>
<h3>Cloud Functions to keep working</h3>
<ul>
  <li><code>onUserCreated</code> — users/{uid} create → welcome email</li>
  <li><code>checkIncompleteAssessments</code> — daily 09:00 reminders</li>
  <li><code>onAssessmentComplete</code> — sectionResults create → if all sections done, completion email</li>
</ul>
<p>Progress helper treats a section complete when <code>sectionResults.sectionName</code> matches a <code>BHC_Assessment.title</code>. Renaming titles without migrating results will break completion. Prefer stable titles.</p>

<h2>12. End-to-end flows to redesign</h2>
<h3>New client</h3>
<ol>
  <li>Landing → Get Started → Signup (or Google) → user + username docs → welcome email → onboarding tour → dashboard empty state → start Section 2 (or 1 if present) → save section → scores update → continue until complete → feedback form → report + PDF → resource / Calendly</li>
</ol>
<h3>Returning client</h3>
<ol>
  <li>Login → dashboard with partial progress → continue incomplete section → edit a completed section (recompute scores) → logout</li>
</ol>
<h3>Admin</h3>
<ol>
  <li>Login as admin → admin home → inspect a user → view answers → export CSV → tweak a report resource → edit a question weight (with warning) → resolve a bug</li>
</ol>
<h3>Demo (Danna)</h3>
<ol>
  <li>Toggle Admin vs Client without logging out. Client toggle should show the real client dashboard, not a mock.</li>
</ol>

<h2>13. Feature matrix</h2>
<table>
  <thead><tr><th>Feature</th><th>Client</th><th>Admin</th><th>Redesign notes</th></tr></thead>
  <tbody>
    <tr><td>Marketing landing</td><td>✓</td><td></td><td>Brand-true, still $297 CTA to signup</td></tr>
    <tr><td>Auth email + Google</td><td>✓</td><td>✓</td><td>Include forgot password</td></tr>
    <tr><td>Onboarding tour</td><td>NEW</td><td>NEW</td><td>Required</td></tr>
    <tr><td>Health dashboard</td><td>✓</td><td>preview</td><td>Gauges, not generic cards only</td></tr>
    <tr><td>Take / edit assessment</td><td>✓</td><td></td><td>Clear progress, autosave feel, gate on §19</td></tr>
    <tr><td>Edit instrument</td><td></td><td>✓</td><td>Safer editor, confirm on save</td></tr>
    <tr><td>Personal report + PDF</td><td>✓</td><td>per user</td><td>Print-quality, logo, health colors</td></tr>
    <tr><td>Resources / Calendly</td><td>✓</td><td>edit copy</td><td>First-class page</td></tr>
    <tr><td>Feedback + bugs</td><td>✓</td><td>triage</td><td>Keep both</td></tr>
    <tr><td>User directory / roles</td><td></td><td>✓</td><td></td></tr>
    <tr><td>Platform analytics</td><td></td><td>✓</td><td>Unify Analytics + ReportsInsights</td></tr>
    <tr><td>Emails</td><td>receive</td><td></td><td>Keep triggers</td></tr>
    <tr><td>Payments</td><td>not built</td><td></td><td>Design a future checkout screen as optional, not blocking</td></tr>
  </tbody>
</table>

<h2>14. UX quality bar for the redesign</h2>
<ul>
  <li>Mobile: assessment must be one-column, large tap targets, sticky submit, section drawer</li>
  <li>Desktop: app-like shell, not a marketing page inside the product</li>
  <li>Replace native <code>alert()</code> with toasts / dialogs</li>
  <li>Empty, loading, error, permission-denied, and offline states for every data view</li>
  <li>Accessibility: contrast on navy, visible focus, labeled inputs, don’t rely on color alone for health</li>
  <li>Motion: restrained. Yellow/orange energy in CTAs and charts, not constant animation</li>
  <li>Do not use Tailkit leftover “Get Started / Tailkit” patterns</li>
  <li>Do not switch the product into a generic SaaS purple/indigo look</li>
</ul>

<h2>15. Pages Claude Design must produce</h2>
<ol>
  <li>Landing</li>
  <li>Login</li>
  <li>Signup</li>
  <li>Forgot password</li>
  <li>Client onboarding (multi-step)</li>
  <li>Client dashboard</li>
  <li>Assessment — section list + question runner + completed/edit + manufacturing skip + completion celebration</li>
  <li>Post-assessment feedback</li>
  <li>Full report</li>
  <li>PDF report template</li>
  <li>Resources library</li>
  <li>Feedback modal</li>
  <li>Bug report modal</li>
  <li>Admin onboarding</li>
  <li>Admin home / users</li>
  <li>Admin user detail + answers inspector</li>
  <li>Admin analytics (all subviews)</li>
  <li>Admin content editor</li>
  <li>Admin monitoring</li>
  <li>Admin assessment CMS</li>
  <li>Optional future: checkout / $297 paywall interstitial (visual only unless wired)</li>
</ol>

<h2>16. Appendix A — Full assessment inventory</h2>
<p>Source: official BHC Section Range Definition. Live option labels and weights are in Firestore and override this table if they differ. Do not drop questions. Section 1 is company intake; scoring categories begin at Section 2.</p>
${questionsHtml}

<h2>17. Appendix B — Implementation constraints checklist</h2>
<ul>
  <li>Keep Firebase project and web config.</li>
  <li>Keep collection names: users, usernames, BHC_Assessment, sectionResults, assessmentFeedback, feedback, bugReports, reportContent, mail.</li>
  <li>Keep question <code>id</code>, <code>type</code>, <code>options[].label</code>, <code>options[].weight</code> unless an admin edits them in CMS.</li>
  <li>Keep category keys exactly: foundationalStructure, financialPosition, salesMarketing, productService, general.</li>
  <li>Keep healthLevel values: low | medium | high.</li>
  <li>Keep Danna admin/client toggle.</li>
  <li>Keep Google + email auth.</li>
  <li>New fields are additive.</li>
  <li>Visual language: navy, royal blue, gold, orange, magenta chart gradient.</li>
</ul>
<p class="muted">End of brief. Rebuild every view. Preserve the diagnostic engine.</p>
</div>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(htmlPath, html);
console.log("Wrote", htmlPath);

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  headless: true,
  executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
await page.pdf({
  path: pdfPath,
  format: "Letter",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `
    <div style="font-size:8px;color:#5B6B80;width:100%;padding:0 24px;display:flex;justify-content:space-between;font-family:Inter,Helvetica,sans-serif;">
      <span>MarketAtomy Business Health Check — Redesign Brief</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`,
  margin: { top: "0.5in", bottom: "0.7in", left: "0.5in", right: "0.5in" },
});
await browser.close();
console.log("Wrote", pdfPath);