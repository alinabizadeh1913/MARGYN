<div align="center">

# MARGYN

**Read, don't count. Mindful reading with a writable margin.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-44-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sql.js.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

*An offline-first, privacy-focused desktop workspace designed for deep work and intentional reading.*

</div>

---

## 🧠 The Philosophy

In an era of endless distractions and obsessive tracking, **MARGYN** was built to cure the "numbers game" of digital reading. 

Most reading apps turn your progress into a stressful stream of statistics. MARGYN does the opposite. It encourages you to **stay in the present** by intentionally hiding your stats for 7 days, allowing you to focus purely on the content, your thoughts, and the flow state.

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🔒 The 7-Day Lock</h3>
      <p>To protect your mind from obsessive counting, your reading stats (pages read, session times) are encrypted and hidden for exactly 7 days. The truth is revealed only after a week has passed.</p>
    </td>
    <td width="50%">
      <h3>✍️ Writable Margin</h3>
      <p>A custom-built, high-performance vector canvas engine right next to your PDF. Draw, highlight text perfectly, create shapes, and connect ideas with smart arrows that snap to elements.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛡️ Local-First & Encrypted</h3>
      <p>Your data never leaves your device. All drawings, sessions, and project files are stored locally using SQLite (WASM) and secured with AES-GCM encryption via a per-install unique key.</p>
    </td>
    <td width="50%">
      <h3>🎯 Focus Sessions & Timer</h3>
      <p>Start a focus session, set a timer, and let MARGYN track your progress. The app prevents you from navigating backward during a session to ensure your recorded progress is always forward-moving.</p>
    </td>
  </tr>
</table>

## 🛠️ Tech Stack

MARGYN is built with a modern, robust, and secure technology stack:

- **Frontend Core:** [Next.js](https://nextjs.org/) (React), TypeScript, Tailwind CSS
- **Desktop Environment:** [Electron](https://www.electronjs.org/) with Context Isolation & SafeStorage
- **Database & ORM:** [SQLite](https://sql.js.org/) (compiled to WebAssembly) + [Drizzle ORM](https://orm.drizzle.team/)
- **PDF Rendering:** [PDF.js](https://mozilla.github.io/pdf.js/)
- **Ink Engine:** Custom-built canvas rendering engine utilizing vector geometry and pointer events.
- **Encryption:** Native Web Crypto API (AES-GCM)
