export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        void:     "#050507",
        surface:  "#0d0d12",
        elevated: "#13131a",
        border:   "#1e1e2a",
        accent:   "#6366f1",
        glow:     "#818cf8",
        muted:    "#3f3f52",
        subtle:   "#8b8ba7",
        txt:      "#e8e8f0",
      },
      keyframes: {
        fadeUp:   { "0%": { opacity: 0, transform: "translateY(14px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        fadeIn:   { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        blink:    { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
      },
      animation: {
        "fade-up":    "fadeUp 0.45s ease forwards",
        "fade-in":    "fadeIn 0.35s ease forwards",
        "shimmer":    "shimmer 2s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "blink":      "blink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};
