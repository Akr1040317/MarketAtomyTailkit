const path = require("path");
const fs = require("fs");

function loadTemplate(templateFileName) {
  const templatePath = path.join(__dirname, "..", "emails", "templates", templateFileName);
  return fs.readFileSync(templatePath, "utf8");
}

function renderTemplate(template, variables) {
  let out = template;
  Object.entries(variables || {}).forEach(([key, value]) => {
    const safe = value == null ? "" : String(value);
    out = out.replaceAll(`{{${key}}}`, safe);
  });
  return out;
}

module.exports = { loadTemplate, renderTemplate };

