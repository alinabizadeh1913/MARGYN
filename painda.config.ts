import { defineConfig } from "@painda/wizard";

/* =========================================================
   LORIQEN — Custom Installer Configuration
   ---------------------------------------------------------
   Brand-aligned installer built with @painda/wizard.

   Design goals:
     - Match the obsidian dark UI of the application
     - Use the primary accent colour of the Dark theme
     - Provide a premium, cinematic install experience
     - Support per-user install (no admin required)
     - Preserve user data across reinstall / uninstall
========================================================= */

export default defineConfig({
  /* -------------------------------------------------------
     APPLICATION IDENTITY
  ------------------------------------------------------- */

  app: {
    id: "com.loriqen.app",
    name: "LORIQEN",
    version: "4.2.0",
    publisher: "Ali Nabizadeh",
  },

  /* -------------------------------------------------------
     BRANDING
     -------------------------------------------------------
     primaryColor: the exact primary accent from the Dark
                   theme palette (#7DD3FC — sky blue).

     theme:        "dark" — the application ships with an
                   obsidian-grade dark UI, so the installer
                   mirrors that identity from the first frame.

     logo:         a square PNG (≥ 256×256, transparent
                   background recommended) placed at
                   installer-assets/logo.png.
  ------------------------------------------------------- */

  branding: {
    primaryColor: "#7DD3FC",
    logo: "./installer-assets/logo.png",
    theme: "dark",
  },

  /* -------------------------------------------------------
     WIZARD PAGES
     -------------------------------------------------------
     welcome:  default hero page.
     options:  user picks the install directory and shortcuts.
               allowChangeInstallPath stays true so the user
               can override the default C:\Program Files\LORIQEN
               location if desired.
     finish:   offers to launch LORIQEN immediately after install.
  ------------------------------------------------------- */

  pages: {
    welcome: {},
    options: {
      allowChangeInstallPath: true,
      desktopShortcut: true,
      startMenuShortcut: true,
    },
    finish: { runApp: true },
  },

  /* -------------------------------------------------------
     PAYLOAD
     -------------------------------------------------------
     Points to the electron-builder --dir output. This is
     the unpacked application folder that @painda/wizard
     will bundle into the final installer.
  ------------------------------------------------------- */

  payload: {
    from: "release/4.2.0/win-unpacked",
    executable: "LORIQEN.exe",
  },

  /* -------------------------------------------------------
     OUTPUT
     -------------------------------------------------------
     Final installer artifact. The template uses painda's
     built-in variables ${name} and ${version}, which are
     replaced with "LORIQEN" and "1.1.0" respectively.
  ------------------------------------------------------- */

  output: {
    dir: "release/4.2.0/installer",
    filename: "${name}-Setup-${version}.exe",
  },
});
