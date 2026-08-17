export const CATEGORY_LABELS = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Strength",
  salesMarketing: "Sales & Marketing",
  productService: "Product Viability",
  general: "Overall / General",
};

export function formatDate(value, withTime = false) {
  if (!value) return "N/A";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

export function initials(firstName = "", lastName = "", email = "") {
  const first = (firstName || "").charAt(0);
  const last = (lastName || "").charAt(0);
  const fallback = (email || "U").charAt(0);
  return `${first || fallback}${last}`.toUpperCase();
}

export function healthMeta(level) {
  if (level === "high") return { className: "healthy", label: "Healthy" };
  if (level === "medium") return { className: "tweak", label: "Needs Tweaking" };
  if (level === "low") return { className: "attention", label: "Needs Attention" };
  return { className: "neutral", label: "Pending" };
}

export function severityMeta(severity) {
  if (severity === "critical" || severity === "high") return { className: "attention", label: severity };
  if (severity === "medium") return { className: "tweak", label: severity };
  return { className: "info", label: severity || "n/a" };
}

export function statusMeta(status) {
  return status === "resolved"
    ? { className: "healthy", label: "Resolved" }
    : { className: "tweak", label: status || "open" };
}

export function mintQuestionId(sectionOrder, questions = []) {
  const used = new Set(questions.map((question) => question.id).filter(Boolean));
  let index = 0;
  while (index < 500) {
    const suffix = index < 26 ? String.fromCharCode(97 + index) : `_${index}`;
    const id = `q${sectionOrder}${suffix}`;
    if (!used.has(id)) return id;
    index += 1;
  }
  return `q${sectionOrder}_${Date.now()}`;
}
