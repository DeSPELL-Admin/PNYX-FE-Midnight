import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 * 
 * This configuration centralizes all theme colors for the mini app.
 * To change the app's color scheme, simply update the 'primary' color value below.
 * 
 * Example theme changes:
 * - Blue theme: primary: "#3182CE"
 * - Green theme: primary: "#059669" 
 * - Red theme: primary: "#DC2626"
 * - Orange theme: primary: "#EA580C"
 */
export default {
    darkMode: "media",
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
      fontFamily: {
        sans: ['var(--font-pretendard)', 'sans-serif'],
        albert: ['var(--font-albert)'],
        pretendard: ['var(--font-pretendard)'],
        roboto: ['var(--font-roboto)'],
      },
  		colors: {
  			// Main theme color - change this to update the entire app's color scheme
  			primary: "#191919", // Main brand color
  			"primary-light": "#ECEAE7", // For hover states
  			"primary-dark": "#CFC7BC", // For active states

            // New Brand Palettes (Available for use)
            "brand-primary": {
                50: "#F8F8F8",
                100: "#F4F4F4",
                200: "#E5E5E5",
                300: "#D5D5D5",
                400: "#B1B1B1",
                500: "#909090",
                600: "#6C6C6C",
                700: "#464646",
                800: "#222222",
                900: "#191919",
                950: "#000000",
            },
            "brand-secondary": {
                50: "#f5f3ff",
                100: "#ede9fe",
                200: "#ddd6fe",
                300: "#ECEAE7",
                400: "#E0DDD9",
                500: "#D5D1CB",
                600: "#CFC7BC",
                700: "#B7AFA3",
                800: "#918981",
                900: "#756C5F",
                950: "#3D3831",
            },
  			
  			// Secondary colors for backgrounds and text
  			secondary: "#D5D1CB", // Light backgrounds
  			"secondary-dark": "#334155", // Dark backgrounds
  			
            // Point Color
            "point-yellow": "#FCF4B3",
            "point-green" :  "#969169",

  			// Legacy CSS variables for backward compatibility
  			background: 'var(--background)',
  			foreground: 'var(--foreground)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		// Custom spacing for consistent layout
  		spacing: {
  			'18': '4.5rem',
  			'88': '22rem',
  		},
  		// Custom container sizes
  		maxWidth: {
  			'xs': '20rem',
  			'sm': '24rem',
  			'md': '28rem',
  			'lg': '32rem',
  			'xl': '36rem',
  			'2xl': '42rem',
  		},
  		// 다음 라운드 카드 그룹이 푸터(아래)에서 통째로 올라오는 진입 애니메이션
  		keyframes: {
  			'rise-from-footer': {
  				from: { transform: 'translateY(100%)' },
  				to: { transform: 'translateY(0)' },
  			},
  		},
  		animation: {
  			'rise-from-footer': 'rise-from-footer 450ms cubic-bezier(0.16, 1, 0.3, 1) both',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
