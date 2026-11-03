# LORIQEN — Study Command Center

> **Where Study Becomes Strategy, Triumph Is Born.**

**Version 4.2.0** · © 2026 Ali Nabizadeh. All Rights Reserved.

LORIQEN is a desktop-first study management ecosystem designed for serious learners —
students preparing for university entrance exams, professional certifications, courses,
or long-term skill development. It unifies subjects, planning, focus sessions,
assessments, spaced review, mistake tracking, notes, analytics, and personal goals
into a single, cohesive workspace.

Built with an obsidian-grade dark UI, five seasonal themes, a persistent SQLite
database, a native audio engine, and a security-hardened Electron runtime, LORIQEN
turns daily study habits into measurable, strategic progress.

---

## ✦ Core Capabilities

### 📚 Subjects & Curriculum
- **Page-based subjects** (books, PDFs) with total/completed page tracking
- **Video-based subjects** (lectures, courses) with hourly progress
- Custom progress step per subject (pages or minutes per click)
- Chapters as first-class entities linked to assessments, notes, reviews, and mistakes

### 📅 Study Planner
- Weekly calendar strip with per-day session counts and completion ratios
- Session types: Study · Review · Test · Video · Focus
- Priority levels (Low / Medium / High), start time, and duration
- Daily statistics: planned minutes, completed minutes, session count, progress %
- "Upcoming" sidebar for sessions scheduled on other days

### ⏱ Focus Timer
- Six preset modes: Sprint (25m), Standard (40m), Deep Focus (50m),
  Extended (90m), Marathon (120m), Custom
- Custom mode with hour / minute / second precision
- Persistent across page navigation, reloads, and app restarts via `localStorage`
  + wall-clock timestamps
- Subject + chapter linking — every session is recorded against its learning context
- Automatic session commit on completion; manual finish with elapsed-time recording

### 📝 Assessment Center
- Chapter-level assessment aggregates: total questions, correct, wrong, unanswered
- **Normal scoring** and **Negative marking (1/3)** side-by-side
- Real-time percentage recalculation across both systems
- Inline stat editing with draft buffering (changes commit on blur)
- Search, expand/collapse, and per-chapter performance rings

### 🔄 Review System
- Chapter-based review rounds — a subject's completed round = the lowest chapter
  review count
- Add / remove individual reviews with full history modal
- "Up-to-date", "Needs review", and "Not reviewed" statuses
- Filter by All / Needs Review / Completed

### ⚠️ Mistake Intelligence
- Log mistakes by subject, chapter, kind (Incorrect / Careless / Unanswered), cause,
  difficulty, and personal note
- **Priority scoring algorithm** weighing occurrences, difficulty, status, kind, and
  recency
- Weakness analysis (dominant cause breakdown)
- Review history per mistake, status transitions (Open → Reviewing → Mastered)
- Sort by Priority / Recent / Most Repeated / Difficulty

### 🗒 Notes Knowledge Base
- Rich note editor with title, content, subject/chapter linking, and tags
- Pin and favorite flags
- Split-pane workspace: note list on the left, full detail on the right
- Word count, created/updated timestamps, and search across content, tags, and chapters

### 🎯 Goals
- Seven goal types: Study Hours, Questions, Chapters, Subjects, Accuracy, Reviews, Custom
- Step-based progress adjustment (`+` / `−` by configurable step)
- Deadlines with countdown, priority levels, pause / complete / reset lifecycle
- Overall momentum banner and due-soon statistics
- Optional subject linking

### 📊 Analytics
- Period selection: 7D / 30D / 90D / ALL
- KPI cards: Study Time, Sessions, Questions, Accuracy with trend computation
- Daily study activity line chart (SVG, theme-reactive)
- Consistency score (active days + rhythm regularity)
- Focus intelligence (completion rate, average session, focused time)
- Planner adherence (planned vs. completed)
- Subject performance ranking
- Study Intelligence panel: strongest area, needs attention, next move

### 🔮 Forecast
- Projected completion dates based on historical velocity
- Per-subject trajectory modelling
- Goal-reach prediction windows

### 🏠 Dashboard
- Mode-driven hero copy (Study / Courses / Job Exam / University Entrance /
  Skill Development)
- **Three-state avatar**: User icon → Initials → Uploaded image
- Today command bar: study time, questions, reviews, streak
- Global stats: subjects, pages, video hours, overall progress
- Review queue (bottleneck chapters only), mistake highlights
- Weekly study chart, dynamic assessment accuracy, learning balance
- Quick action grid

### 🧭 Discipline Engine
- **Full-width 365-day heatmap** with five-star efficiency colouring
  (Weak → Fair → Good → Strong → Outstanding) plus a "Fully Wasted" override
- Daily start / end alarm windows with dedicated modals and repeating alert sound
- Auto-reset across midnight, per-day fired-flag persistence in `localStorage`
- Active day / ended day lifecycle with streak tracking

### 🔊 Sound & Ambience
- **Native audio engine** via `@thesusheer/node-miniaudio` in the Electron main
  process (startup chime · timer start · repeating timer-end alarm)
- **Web Audio fallback** with lazy `AudioContext`, eager buffer preloading, and a
  keep-alive oscillator so Chrome / Electron never suspend the context
- **Ambient Engine** — real-time synthesized rain, waves, and fire using filtered
  noise (no audio files required)
- Generation-counter driven `stopTimerEnd()` guarantees the repeating alarm can
  never leak a stray source

### ⚙️ Settings
- Profile: first name, last name, target statement (100-char limit)
- Avatar picker (seed catalog, SQLite-persisted by ID)
- Application mode selector (5 modes with slogans)
- Five seasonal themes: **Dark** (default), **Spring**, **Summer**, **Autumn**,
  **Winter**
- Theme applied instantly via CSS variables + `data-theme` attribute
- Password-protected App Lock with PBKDF2-SHA256 (100,000 iterations)
- Recovery email with one-time-password (OTP) delivery via system Gmail account
- Reset everything — restores defaults and returns to Dark
- Bottom sticky action bar with save/reset state indicators

---

## ✦ Design System

| Layer | Details |
|---|---|
| **Typography** | Semantic roles: `display`, `pageTitle`, `sectionTitle`, `cardTitle`, `body`, `bodyMedium`, `label`, `caption`, `metadata`, `eyebrow`, `button`, `stat`, `statSmall`, `tiny`, `chip`, `microLabel`, `timerDisplay` |
| **Icon Box** | Unified container with 8 sizes (`xs` → `4xl`), 7 accents, soft/solid appearances |
| **MenuSelect** | Portal-aware dropdown with viewport clamping, keyboard nav, and smart drop-up |
| **NumberInput** | Custom `+`/`−` controls, no native spinners, nullable values, blur-clamping |
| **EmptyState** | Two variants: `no-data` (onboarding) and `no-match` (filtered empty) |
| **Toast System** | Portal-rendered, top-right stack, per-variant accents, progress bar for undo toasts |
| **Theme Engine** | Five seasons, CSS custom properties, instant switching, DB + localStorage persistence |

---

## ✦ Security & Infrastructure

| Layer | Details |
|---|---|
| **Password Hashing** | PBKDF2-SHA256 · 100 000 iterations · 16-byte salt · constant-time verification |
| **Recovery OTP** | 6-digit code · 5-minute TTL · 60-second resend cooldown · SMTP-delivered via system account |
| **Email HTML** | Fully offline-safe · embedded base64 logo · escaped user content |
| **App Lock** | Optional per-install password gate on the lock screen |
| **Window Hardening** | DevTools disabled · F12 / Ctrl+Shift+I blocked · zoom locked · `context-menu` suppressed |
| **Protocol** | Custom privileged `app://` scheme with CORS, CSP bypass, and directory traversal protection |
| **Data Backup** | Automatic mirror to `Documents/LORIQEN-Backup` after every write |
| **JSON Export / Import** | Native save/open dialogs for portable snapshots |
| **Persistence** | SQLite via `sql.js` · every successful mutation auto-flushes to disk |
| **UV Thread Pool** | Raised to 16 threads for smoother native module I/O |

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) + React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 3.4 + CSS custom properties |
| **Database** | SQLite via `sql.js` + Drizzle ORM |
| **State** | React hooks + TanStack Query 5 |
| **Drag & Drop** | `@dnd-kit/core` · `@dnd-kit/sortable` |
| **Desktop** | Electron 44 + electron-builder 26 |
| **Native Audio** | `@thesusheer/node-miniaudio` |
| **Email** | Nodemailer (Gmail SMTP · system account) |
| **Installer** | `@painda/wizard` + custom NSIS configuration |
| **Fonts** | Poppins (primary) · JetBrains Mono (monospace) |

---

## ✦ Project Structure (high-level)


---

## ✦ Author

**Ali Nabizadeh**

> *Software Engineer | Frontend & Desktop App Developer | AI Integration &
> Prompt Engineering | UI/UX-Aware | IT Fundamentals*

Designer and developer of LORIQEN — from architecture and database schema,
through every component, theming engine, native audio pipeline, security
hardening, and cross-platform desktop packaging.

- 🌐 **LinkedIn** — [ali-nabizadeh-884866280](https://www.linkedin.com/in/ali-nabizadeh-884866280/)
- 💻 **GitHub** — [@alinabizadeh1913](https://github.com/alinabizadeh1913)
- ✉️ **Email** — [alinabizadeh1913@gmail.com](mailto:alinabizadeh1913@gmail.com)

---

## ✦ Copyright & License

**LORIQEN** and its source code, design system, visual identity, branding,
documentation, and all associated assets are the exclusive intellectual
property of **Ali Nabizadeh**.

### ⚠️ All Rights Reserved

This software is **proprietary and confidential**. No part of this project
may be:

- ❌ Copied, reproduced, or duplicated in any form
- ❌ Modified, adapted, or derived into other works
- ❌ Distributed, published, or shared publicly or privately
- ❌ Sold, sublicensed, or used for commercial purposes
- ❌ Reverse-engineered or decompiled

without the **explicit prior written permission** of the copyright holder.

### 📜 Legal Notice

Unauthorized use, reproduction, or distribution of this software, in whole
or in part, is strictly prohibited and may result in severe civil and
criminal penalties under applicable copyright laws.

Any violation will be pursued to the fullest extent permitted by law.

### 📩 Licensing Inquiries

For licensing, partnership, or commercial use inquiries:

**Ali Nabizadeh** — Software Engineer

- ✉️ [alinabizadeh1913@gmail.com](mailto:alinabizadeh1913@gmail.com)
- 🌐 [linkedin.com/in/ali-nabizadeh-884866280](https://www.linkedin.com/in/ali-nabizadeh-884866280/)
- 💻 [github.com/alinabizadeh1913](https://github.com/alinabizadeh1913)

---

> *LORIQEN was built with dedication, discipline, and an obsession with
> clean design. Respect the craft. Respect the copyright.*

**LORIQEN v4.2.0** · © 2026 Ali Nabizadeh · All Rights Reserved.