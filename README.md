<p align="center">
  <img src="public/logo.png" alt="Keshi Pomodoro Logo" width="80" />
</p>

<h1 align="center">🍅 Keshi Pomodoro</h1>

<p align="center">
  <strong>A beautifully crafted Pomodoro timer with a dreamy, artistic aesthetic</strong>
</p>

<p align="center">
  <a href="https://keshi-pomodoro.vercel.app/">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-keshi--pomodoro.vercel.app-b91c1c?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Framer_Motion-✨-FF0055?logo=framer&logoColor=white" alt="Framer Motion" />
</p>

---

## ✨ Demo

<p align="center">
  <img src="assets/demo.webp" alt="Keshi Pomodoro Demo" width="100%" />
</p>

---

## 🎨 Features

### 🎭 Dual Mode Experience

Switch seamlessly between **Focus** and **Relax** modes with smooth color transitions.

<table>
  <tr>
    <td align="center"><strong>🔴 Focus Mode</strong></td>
    <td align="center"><strong>🟢 Relax Mode</strong></td>
  </tr>
  <tr>
    <td><img src="assets/focus_mode.png" alt="Focus Mode" width="100%" /></td>
    <td><img src="assets/relax_mode.png" alt="Relax Mode" width="100%" /></td>
  </tr>
</table>

---

### 🎬 Cinematic Entrance Animations

Every element enters the screen with carefully orchestrated animations:

| Element | Animation | Timing |
|---------|-----------|--------|
| 📍 Navigation | Slide down | 100ms |
| 🏷️ Badge | Pop in with rotation | 300ms |
| 🔤 Ransom Letters | Staggered scatter | 400ms |
| ⏱️ Timer | Elastic scale | 600ms |
| 🎛️ Controls | Staggered fade | 800ms |
| 💬 Quote | Slide up | 900ms |
| 🖼️ Collage | Toss-in effect | 1000ms |
| 📻 Radio | Slide from right | 1200ms |

---

### 🖼️ Living Collage Background

Floating polaroid-style images with:
- **Slow, dreamy movement** — Multi-axis floating animation
- **Interactive hover effects** — Scale and rotation on interaction
- **Torn paper aesthetics** — Custom clip-paths for authentic look
- **Realistic tape & pushpins** — Vision board details

---

### 📻 Lo-Fi Radio Widget

Built-in cassette tape-styled music player with:
- 🎵 4 YouTube live streams (Lofi Girl, Chillhop, etc.)
- 🎚️ Volume control
- 🔄 Station switching
- 📊 Audio visualization bars

---

### 🎯 Core Functionality

- ⏱️ **Customizable timers** — Set your own focus/break durations
- 📜 **Session history** — Track your completed sessions
- 🔔 **Sound notifications** — Audio alerts on timer completion
- ⌨️ **Keyboard shortcuts** — Space/Enter to start/pause
- 💾 **Local storage** — Settings persist across sessions

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 7
- **Styling:** TailwindCSS 3.4
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Deployment:** Vercel

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/pomodoro-keshi.git

# Navigate to project
cd pomodoro-keshi

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Background.tsx    # Collage images & decorative elements
│   ├── CustomCursor.tsx  # Custom cursor with trail effect
│   ├── Modals.tsx        # Settings & History modals
│   ├── RadioWidget.tsx   # Lo-fi music player
│   └── TimerRing.tsx     # SVG progress ring
├── utils/
│   └── animations.ts     # Framer Motion variants & delays
├── App.tsx               # Main application component
└── index.css             # Global styles & custom classes
```

---

## 🎨 Design Philosophy

Inspired by:
- **Keshi's aesthetic** — Dreamy, nostalgic, lo-fi vibes
- **Vision boards** — Magazine clippings, polaroids, tape
- **Ransom notes** — Cut-out letter typography
- **Analog textures** — Grain overlay, paper cream tones

---

## 📝 License

MIT © 2024

---

<p align="center">
  <strong>Made with 🍅 and ☕</strong>
</p>

<p align="center">
  <em>"I only show you the best of me."</em>
</p>
