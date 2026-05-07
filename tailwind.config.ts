import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // ═══ v2 brand colors ═══
        enf: {
          DEFAULT: "#06B6D4",
          hover: "#0891B2",
          deep: "#0E7490",
          soft: "#ECFEFF",
        },
        uti:    { DEFAULT: "#DC2626", soft: "#FEF2F2", text: "#B91C1C" },
        cc:     { DEFAULT: "#2563EB", soft: "#EFF6FF", text: "#1D4ED8" },
        ps:     { DEFAULT: "#EA580C", soft: "#FFF7ED", text: "#C2410C" },
        enfer:  { DEFAULT: "#059669", soft: "#ECFDF5", text: "#047857" },
        amb:    { DEFAULT: "#7C3AED", soft: "#F5F3FF", text: "#6D28D9" },
      },
      boxShadow: {
        "sm":       "0 1px 2px rgba(15, 23, 42, 0.04)",
        "md":       "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        "lg":       "0 4px 16px rgba(15, 23, 42, 0.08)",
        "enf-glow": "0 0 0 4px rgba(6, 182, 212, 0.18)",
      },
      backgroundImage: {
        "gradient-hv": "linear-gradient(90deg, #10E5B5 0%, #06B6D4 35%, #3B82F6 65%, #8B5CF6 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // v2: Inter é display + body. Fraunces removida 100% do produto.
        sans:    ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["Inter", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        popIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        sparkSpin: {
          "0%": { transform: "scale(0) rotate(0deg)", opacity: "0" },
          "50%": { transform: "scale(1.4) rotate(180deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(360deg)", opacity: "1" },
        },
        greenPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(34,197,94,0.5)", opacity: "1" },
          "100%": { boxShadow: "0 0 0 12px rgba(34,197,94,0)", opacity: "0" },
        },
        bounceScale: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.3)" },
          "60%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        voxPulse: {
          "0%":   { transform: "scale(1)",    opacity: "0.6" },
          "50%":  { transform: "scale(1.45)", opacity: "0" },
          "100%": { transform: "scale(1)",    opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "vox-pulse": "voxPulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
