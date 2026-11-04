const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('✅ Copied pdf.worker.min.mjs to public/');
} else {
  // Fallback for older versions that might use .js
  const srcJs = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
  const destJs = path.join(__dirname, '..', 'public', 'pdf.worker.min.js');
  if (fs.existsSync(srcJs)) {
    fs.copyFileSync(srcJs, destJs);
    console.log('✅ Copied pdf.worker.min.js to public/');
  } else {
    console.error('❌ Source pdf worker file not found in node_modules.');
  }
}