/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0D0C0A",       // page base — warm near-black
        coal: "#171512",      // raised surfaces
        seam: "#2A2722",      // hairlines on dark
        stone: "#C9BBA2",     // facade sandstone
        bone: "#EFE9DD",      // light "paper" sections
        smoke: "#8F887C",     // muted copy on dark
        pmcc: "#C8102E",      // brand red — CTAs and monogram only
        tile: "#C05A2E",      // terracotta — sparingly, from the roof
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Georgia", "serif"],
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.045em",
        wideish: "0.18em",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },
    },
  },
  plugins: [],
};
