/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk Variable"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0a0a0f",
          950: "#06070b",
          900: "#0a0c12",
          800: "#11141d",
          700: "#1a1e2b",
        },
        pitch: "#0b6e4f",
        grass: "#22c55e",
        gold: "#ffd166",
      },
      boxShadow: {
        glow: "0 0 50px -12px rgba(34,197,94,0.55)",
        gold: "0 0 40px -10px rgba(255,209,102,0.55)",
        card: "0 18px 50px -20px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "spotlight":
          "radial-gradient(120% 80% at 50% -10%, rgba(34,197,94,0.18) 0%, rgba(11,110,79,0.10) 30%, rgba(10,10,15,0) 65%)",
        "gold-grass": "linear-gradient(110deg, #22c55e 0%, #ffd166 100%)",
        "grain":
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.7)", opacity: "0" },
          "100%": { opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pan": {
          "0%,100%": { transform: "translate(-5%, -5%)" },
          "50%": { transform: "translate(5%, 5%)" },
        },
        "live-border": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.45)" },
          "50%": { boxShadow: "0 0 0 3px rgba(239,68,68,0.12)" },
        },
        "float-up": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(-28px)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.3,1) infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin 16s linear infinite",
        shimmer: "shimmer 3s linear infinite",
        "glow-pan": "glow-pan 14s ease-in-out infinite",
        "live-border": "live-border 2s ease-in-out infinite",
        "float-up": "float-up 1.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};
