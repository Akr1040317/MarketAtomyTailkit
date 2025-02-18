// tailwind.config.js
module.exports = {
  darkMode: "class", // Enable class-based dark mode
  content: [
    "./index.html",
    "**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
