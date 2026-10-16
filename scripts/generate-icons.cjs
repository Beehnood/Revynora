// Reproducible SVG sprite using the same ISC-licensed Lucide geometry as the UI.
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { writeFileSync } = require("node:fs");
const req = createRequire(resolve("apps/web/package.json"));
const React = req("react");
const { renderToStaticMarkup } = req("react-dom/server");
const icons = req("lucide-react");
const names = {
  maths: "Sigma",
  physics: "Atom",
  chemistry: "FlaskConical",
  biology: "Leaf",
  history: "BookOpen",
  geography: "Globe",
  languages: "Languages",
  code: "CodeXml",
  law: "Gavel",
  economics: "ChartColumn",
  other: "Ellipsis",
  student: "GraduationCap",
  teacher: "Users",
  admin: "ShieldCheck",
  success: "CheckCircle2",
  error: "AlertCircle",
  warning: "TriangleAlert",
  info: "Info",
  diagnostic: "ClipboardCheck",
  learning: "Lightbulb",
  revision: "Repeat2",
  progress: "ChartNoAxesCombined",
};
const symbols = Object.entries(names).map(([id, name]) => {
  const svg = renderToStaticMarkup(React.createElement(icons[name]));
  return `<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</symbol>`;
});
writeFileSync(
  "apps/web/public/brand/icons.svg",
  `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`,
);
