# Antigravity Agent Guidelines & Rules

## 1. UI & Icon Styling Rules (Strict: No Emojis)
- **DO NOT USE EMOJIS** anywhere in the project or conversation:
  - **No emojis in UI components**: Web pages, desktop apps, buttons, headers, tabs, badges, cards, toasts, or notifications (never use ⚙️, 🚀, 💡, 📡, 🤖, ✅, ❌, ⚠️, 📊, ⚡, etc.).
  - **Always use modern, professional SVG icon libraries**: For React / Next.js / Electron, use Lucide React (e.g. `<Settings />`, `<Cpu />`, `<Activity />`, `<MapPin />`, `<Sliders />`, `<ShieldCheck />`, `<CheckCircle2 />`, `<AlertTriangle />`, `<Sparkles />`, `<Bot />`, `<Server />`, `<Key />`, `<Download />`, `<FileDown />`, `<Copy />`, `<Check />`) or clean inline SVGs.
  - **Clean technical logging**: In terminal logs, daemon console outputs, and backend messages, use clean bracketed prefixes (e.g. `[INFO]`, `[SUCCESS]`, `[WARN]`, `[ERROR]`, `[CONFIG]`, `[TELEMETRY]`, `[INFERENCE]`, `[CONNECTING]`) instead of emojis.
  - **Clean communication**: In chat responses to the USER, keep the tone professional, structured, and technical without emojis.

## 2. Code Quality & Architecture Standards
- Maintain strict typing and zero build errors across Next.js, Go microservices, and Electron/Python workers.
- Format all file and symbol references as clickable markdown links using the `file://` scheme with forward slashes.

