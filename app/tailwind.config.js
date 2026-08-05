/** Same design DNA as pmcclb.com — the app must feel like the site's sibling. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0D0C0A",
        coal: "#171512",
        seam: "#2A2722",
        stone: "#C9BBA2",
        bone: "#EFE9DD",
        smoke: "#8F887C",
        pmcc: "#C8102E",
        tile: "#C05A2E",
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Georgia", "serif"],
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wideish: "0.18em",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },
    },
  },
  plugins: [],
};
