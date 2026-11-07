<div align="center">

# MARGYN

**Read, don't count. Mindful reading with a writable margin.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-44-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sql.js.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#)
[![Version](https://img.shields.io/badge/Version-1.0.0-38bdf8?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-Free%20%26%20Open-10b981?style=for-the-badge)](#)

*An offline-first, privacy-focused desktop workspace designed for deep work and intentional reading.*

</div>

---

## 🧠 The Philosophy

In an era of endless distractions and obsessive tracking, **MARGYN** was built to cure the "numbers game" of digital reading.

Most reading apps turn your progress into a stressful stream of statistics. MARGYN does the opposite. It encourages you to **stay in the present** by intentionally hiding your stats for 7 days, allowing you to focus purely on the content, your thoughts, and the flow state.

MARGYN is not just a PDF reader — it is a **writing surface for your mind**. Every page becomes a space where reading, drawing, and thinking live side by side, and every session is a small ritual of attention.

---

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🔒 The 7-Day Lock</h3>
      <p>To protect your mind from obsessive counting, your reading stats (pages read, session times) are hidden for exactly 7 days. The truth is revealed only after a week has passed — calmly, not compulsively.</p>
    </td>
    <td width="50%">
      <h3>✍️ Writable Margin</h3>
      <p>A custom-built, high-performance vector canvas engine right next to your PDF. Draw, highlight text perfectly, create shapes, and connect ideas with smart arrows that snap to elements.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📖 Any PDF, Any Length</h3>
      <p>Open any PDF file and annotate it directly on the page. Every stroke, highlight, note, and page position is saved automatically — so you always come back to exactly where you left off.</p>
    </td>
    <td width="50%">
      <h3>🗒️ Per-Page Notes</h3>
      <p>Attach rich text notes to any page and return to them anytime. Notes are stored alongside your ink and travel with the document when you export a project.</p>
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
  <tr>
    <td width="50%">
      <h3>🎨 Infinite Canvas & Blank Pages</h3>
      <p>Beyond PDFs — create blank pages or an infinite canvas for freeform thinking, sketching, and note-taking, all with the same ink engine and export support.</p>
    </td>
    <td width="50%">
      <h3>💾 Portable <code>.margyn</code> Projects</h3>
      <p>Export your entire workspace as a single encrypted <code>.margyn</code> file — drawings, notes, sessions, and the original PDF included. Import it anywhere, and it just works.</p>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

MARGYN is built with a modern, robust, and secure technology stack:

- **Frontend Core:** [Next.js](https://nextjs.org/) (React), TypeScript, Tailwind CSS
- **Desktop Environment:** [Electron](https://www.electronjs.org/) with Context Isolation & SafeStorage
- **Database & ORM:** [SQLite](https://sql.js.org/) (compiled to WebAssembly) + [Drizzle ORM](https://orm.drizzle.team/)
- **PDF Rendering:** [PDF.js](https://mozilla.github.io/pdf.js/)
- **PDF Export:** [pdf-lib](https://pdf-lib.js.org/)
- **Ink Engine:** Custom-built canvas rendering engine utilizing vector geometry and pointer events
- **Encryption:** Native Web Crypto API (AES-GCM)
- **Audio Engine:** Custom-built Web Audio API synthesis (no external sample files)

---

## 📋 Prerequisites

Before building MARGYN from source, make sure you have the following installed:

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | `18.17+` (LTS recommended) | [Download](https://nodejs.org/) |
| **npm** | `9+` | Comes with Node.js |
| **Git** | Latest | [Download](https://git-scm.com/) |
| **Windows** | `10` or `11` (64-bit) | Required to build the Windows installer |
| **PowerShell** | `5.1+` | Recommended terminal on Windows |

> 💡 **Tip:** If you're on Windows and new to this, install Node.js via the official installer and enable the "Add to PATH" option during setup.

---

## 🚀 Build & Install

There are two ways to get MARGYN running:

### Option 1 — Download the Installer (Recommended for Users)

If you just want to use MARGYN without building it, download the latest `.exe` installer from the **[Releases page](https://github.com/alinabizadeh1913/MARGYN/releases)**.

> The latest release is **v1.0.0** — for Windows. Simply run the installer and MARGYN will be ready to use.

### Option 2 — Build From Source (Recommended for Developers)

Follow these steps to clone the repository and build MARGYN yourself.

#### 1. Clone the Repository

Open **PowerShell** (or your preferred terminal) and run:

```bash
git clone https://github.com/alinabizadeh1913/MARGYN.git
cd MARGYN
```

This will download the entire project into a folder named MARGYN on your machine.

#### 2. Install Dependencies
Inside the project folder, install all required npm packages:

```bash
npm install
```

This may take a few minutes. It downloads every library MARGYN needs — from React and Next.js, to Electron and the SQLite engine.

>💡 Note: If you encounter issues, make sure you're running a recent Node.js version (node --version), and try again.

#### 3. Build the Windows Installer
Once dependencies are installed, run:

```bash
npm run desktop:win
```

This command will:

1. Compile the Next.js frontend into production assets.
2. Package the Electron application.
3. Generate the standalone **Windows installer** — a `.exe` file.

The build process may take 5–15 minutes depending on your machine, as Electron packages a full Chromium runtime into the installer.

#### 4. Locate and Run the Installer
When the build finishes successfully, navigate to the release/ directory in the project root:

```text
MARGYN/
├── release/
│   ├── MARGYN Setup x.x.x.exe   ← Your installer
│   └── win-unpacked/             ← Portable build (optional)
```

Run the .exe file to install MARGYN on your Windows system.

> ✅ That's it — MARGYN is now installed and ready to use.

## 🧪 Running in Development Mode
If you're modifying the source code and want hot-reload during development:

```bash
npm run dev
```

Then in a separate terminal (or via the same command if configured):

```bash
npm run electron:dev
```

This launches MARGYN in a live-reload Electron window, where changes to the frontend are reflected instantly.

> ⚠️ Development mode is intended for contributors and testing. For daily use, build the production installer (Option 2 above) or download the release.

## 📖 Usage Guide
Once MARGYN is running, here's how to get started:

### Opening a Document

- Click **Open PDF** in the header, or **drag & drop** a PDF anywhere in the reader.
- Alternatively, load a `.margyn` project from the **Library** view.

### Reading & Annotating
Use the toolbar to switch tools: Pen, Highlighter, Eraser, Shapes, Line, Arrow, Select.

Draw directly on the PDF page, or open the writable margin beside it for freeform thinking.

Attach per-page notes using the note icon on the right side.

### Starting a Focus Session
Click Start Session in the header.

Optionally set a timer for your session length.

Your stats will be recorded but hidden for 7 days.

### Ending a Session
Click End Session and type the confirmation phrase.

Your progress is saved, and your stats begin their 7-day wait.

### Viewing Your History
Open the History tab.

Select any day from the calendar to see its sessions — or see the countdown if it's still locked.

### Exporting Your Work
Export PDF — generates a flat PDF with all ink baked in.

Export .margyn — saves your entire workspace (PDF + ink + notes + sessions) as one encrypted file.

## 📂 Project Structure
A quick overview of the codebase:

```text
MARGYN/
├── src/
│   ├── app/               # Next.js App Router (pages, layout)
│   ├── components/        # UI components (reader, history, library, …)
│   │   ├── main/          # AppContent, AppShell, AppHeader
│   │   ├── reader/        # PdfViewer, MarginCanvas, toolbar, ink engine
│   │   └── …
│   ├── db/                # SQLite (sql.js) + Drizzle schema & helpers
│   ├── lib/               # audio, crypto, pdf export, utilities
│   ├── providers/         # Time, Session, Tool, Shortcut, ContextMenu
│   └── typography/        # Semantic typography system
├── electron/              # Electron main & preload scripts
├── public/                # Static assets (logo, fonts, icons)
├── package.json
└── README.md
```

## 🤝 Contributing
MARGYN is a personal project shared with the community. Contributions, feedback, and ideas are always welcome:

1. **Fork** the repository.
2. Create a feature branch: `git checkout -b feature/my-idea`.
3. Commit your changes: `git commit -m "Add my idea"`.
4. Push the branch: `git push origin feature/my-idea`.
5. Open a **Pull Request**.

If you spot a bug or have a suggestion, feel free to open an Issue.

## 📄 License
MARGYN is free and open — released for personal and educational use. If you'd like to use it in a commercial product, please reach out first.

<div align="center">
Built quietly, with care — for readers who want to slow down a little. 🌿

<p> <a href="https://github.com/alinabizadeh1913/MARGYN">GitHub</a> • <a href="mailto:alinabizadeh1913@gmail.com">Email</a> • <a href="http://instagram.com/ali.nabizadeh.79">Instagram</a> </p><p><b>Ali Nabizadeh</b> — Software Engineer & Creator of MARGYN</p><p>© 2026 MARGYN · Version 1.0.0</p></div>
