/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        exam: {
          green: "#10B981",
          red: "#EF4444",
          purple: "#8B5CF6",
          gray: "#9CA3AF"
        }
      }
    },
  },
  plugins: [],
}
