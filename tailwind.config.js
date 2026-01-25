/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'accent-red': 'var(--accent-red)',
                'accent-green': 'var(--accent-green)', // Dynamic variable
                'accent-burgundy': '#4a0404',
                'paper-cream': '#f2efe9',
                'bg-dark': '#080808',
                'bg-forest': '#022c22', // Emerald 950
                // Keep some legacy for safety during transition
                'void': '#080808',
                'cream': '#f2efe9',
            },
            fontFamily: {
                'grotesk': ['"Space Grotesk"', 'sans-serif'],
                'serif-custom': ['"Crimson Text"', 'serif'],
                'marker': ['"Permanent Marker"', 'cursive'],
                // Map to standard tailwind classes for easier usage
                sans: ['"Space Grotesk"', 'sans-serif'],
                serif: ['"Crimson Text"', 'serif'],
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 3s infinite',
                'ticker': 'ticker 10s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px) rotate(var(--r, 0deg))' },
                    '50%': { transform: 'translateY(-10px) rotate(var(--r, 0deg))' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 10px rgba(185, 28, 28, 0.3)' },
                    '50%': { boxShadow: '0 0 25px rgba(185, 28, 28, 0.6)' },
                },
                'pulse-green': {
                    '0%, 100%': { boxShadow: '0 0 10px rgba(52, 211, 153, 0.3)' },
                    '50%': { boxShadow: '0 0 25px rgba(52, 211, 153, 0.6)' },
                },
                ticker: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                marquee: {
                    '0%': { transform: 'translateX(100%)' },
                    '100%': { transform: 'translateX(-100%)' },
                }
            },
            animation: {
                'ticker': 'ticker 20s linear infinite',
                'marquee': 'marquee 8s linear infinite',
                'spin': 'spin 3s linear infinite',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
            }
        },
    },
    plugins: [],
}
