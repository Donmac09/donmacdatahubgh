/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT:'#FFCC00', dark:'#B38F00' },
        mtn: { DEFAULT:'#FFCC00', text:'#4A3700' },
        telecel: { DEFAULT:'#E40521', text:'#fff' },
        airtel: { DEFAULT:'#1d4ed8', text:'#fff' },
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      animation: {
        'fade-in':'fadeIn 0.4s ease',
        'slide-up':'slideUp 0.35s ease',
        'slide-in-right':'slideInRight 0.3s ease',
        'pulse-glow':'pulseGlow 2s ease-in-out infinite',
        'float':'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:{ from:{opacity:0,transform:'translateY(8px)'}, to:{opacity:1,transform:'translateY(0)'} },
        slideUp:{ from:{opacity:0,transform:'translateY(20px)'}, to:{opacity:1,transform:'translateY(0)'} },
        slideInRight:{ from:{opacity:0,transform:'translateX(20px)'}, to:{opacity:1,transform:'translateX(0)'} },
        pulseGlow:{ '0%,100%':{boxShadow:'0 0 0 0 rgba(79,70,229,0)'}, '50%':{boxShadow:'0 0 20px 4px rgba(79,70,229,0.3)'} },
        float:{ '0%,100%':{transform:'translateY(0)'}, '50%':{transform:'translateY(-6px)'} },
      }
    }
  },
  plugins: []
}
