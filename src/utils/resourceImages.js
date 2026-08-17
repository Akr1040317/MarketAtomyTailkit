const svg = (body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420">${body}</svg>`)}`;

const COVERS = {
  finance: svg('<rect width="800" height="420" fill="#0B1F4A"/><circle cx="640" cy="90" r="120" fill="#2BB3C7" opacity=".2"/><rect x="120" y="250" width="28" height="90" rx="6" fill="#2BB3C7"/><rect x="180" y="190" width="28" height="150" rx="6" fill="#F5C400"/><circle cx="620" cy="250" r="70" fill="#F26522"/><text x="620" y="265" text-anchor="middle" fill="#fff" font-size="48" font-family="Manrope,sans-serif">$</text>'),
  marketing: svg('<rect width="800" height="420" fill="#142D51"/><path d="M180 210l210-70v160L180 230z" fill="#F26522"/><path d="M390 170c70 20 110 50 150 110" stroke="#2BB3C7" stroke-width="10" fill="none"/><circle cx="640" cy="250" r="54" fill="#2BB3C7"/>'),
  product: svg('<rect width="800" height="420" fill="#0C2748"/><path d="M400 70l170 80v150L400 380 230 300V150z" fill="#2E6BB0"/><path d="M400 70l170 80-170 80L230 150z" fill="#2BB3C7"/><circle cx="400" cy="210" r="28" fill="#F5C400"/>'),
  foundation: svg('<rect width="800" height="420" fill="#101B31"/><rect x="160" y="150" width="70" height="180" rx="8" fill="#2E6BB0"/><rect x="270" y="110" width="70" height="220" rx="8" fill="#2BB3C7"/><rect x="380" y="80" width="70" height="250" rx="8" fill="#F26522"/>'),
  consult: svg('<rect width="800" height="420" fill="#0B1F4A"/><circle cx="310" cy="168" r="42" fill="#F5C400"/><circle cx="490" cy="158" r="42" fill="#fff"/><rect x="330" y="300" width="140" height="16" rx="8" fill="#F26522"/>'),
  academy: svg('<rect width="800" height="420" fill="#0B1F4A"/><path d="M400 80l260 90-260 90L140 170z" fill="#2BB3C7"/><path d="M168 286c40 22 90 34 232 34s192-12 232-34" stroke="#F26522" stroke-width="10" fill="none"/>'),
  podcast: svg('<rect width="800" height="420" fill="#101B31"/><rect x="362" y="110" width="76" height="130" rx="38" fill="#F5C400"/><path d="M330 200c0 40 32 72 70 72s70-32 70-72" stroke="#2BB3C7" stroke-width="10" fill="none"/>'),
  video: svg('<rect width="800" height="420" fill="#0B1F4A"/><rect x="170" y="80" width="460" height="260" rx="28" fill="#142D51" stroke="#2BB3C7" stroke-width="6"/><circle cx="400" cy="210" r="58" fill="#F26522"/><path d="M386 180l52 30-52 30z" fill="#fff"/>'),
  download: svg('<rect width="800" height="420" fill="#14233A"/><rect x="250" y="70" width="300" height="280" rx="18" fill="#fff"/><circle cx="400" cy="280" r="42" fill="#F26522"/><path d="M400 258v36M384 278l16 16 16-16" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
  general: svg('<rect width="800" height="420" fill="#0B1F4A"/><circle cx="400" cy="210" r="110" fill="none" stroke="#F5C400" stroke-width="14"/><circle cx="400" cy="210" r="58" fill="#fff"/><circle cx="400" cy="210" r="22" fill="#F26522"/>'),
};

const TYPE_IMAGES = {
  podcast: COVERS.podcast,
  video: COVERS.video,
  download: COVERS.download,
  session: COVERS.consult,
  program: COVERS.academy,
  consultation: COVERS.consult,
  academy: COVERS.academy,
};

const CATEGORY_IMAGES = {
  financialPosition: COVERS.finance,
  salesMarketing: COVERS.marketing,
  productService: COVERS.product,
  foundationalStructure: COVERS.foundation,
  general: COVERS.general,
};

export function getResourceCoverImage({ title = "", description = "", type = "", category = "", image = "" } = {}) {
  if (image) return image;

  const hay = `${title} ${description}`.toLowerCase();
  const normalizedType = String(type || "").toLowerCase();

  if (TYPE_IMAGES[normalizedType]) return TYPE_IMAGES[normalizedType];
  if (CATEGORY_IMAGES[category]) return CATEGORY_IMAGES[category];

  if (hay.includes("calendly") || hay.includes("consult") || hay.includes("debrief") || hay.includes("discovery")) {
    return COVERS.consult;
  }
  if (hay.includes("academy") || hay.includes("course") || hay.includes("program")) return COVERS.academy;
  if (hay.includes("podcast")) return COVERS.podcast;
  if (hay.includes("video") || hay.includes("webinar")) return COVERS.video;
  if (hay.includes("worksheet") || hay.includes("download") || hay.includes("guide") || hay.includes("checklist")) {
    return COVERS.download;
  }
  if (hay.includes("financial") || hay.includes("finance") || hay.includes("cash")) return COVERS.finance;
  if (hay.includes("marketing") || hay.includes("sales")) return COVERS.marketing;
  if (hay.includes("product") || hay.includes("service")) return COVERS.product;
  if (hay.includes("foundation") || hay.includes("structure") || hay.includes("operations")) return COVERS.foundation;

  return COVERS.general;
}
