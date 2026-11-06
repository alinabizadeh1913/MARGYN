import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

function hexToRgb(hex: string) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(r, g, b);
}

// تبدیل مختصات کانواس (Catmull-Rom) به مسیر SVG برای PDF
function tracePenSvg(
  p: number[],
  map: (x: number, y: number) => [number, number],
): string {
  const n = p.length >> 1;
  if (!n) return "";

  const [sx, sy] = map(p[0], p[1]);
  let d = `M ${sx} ${sy} `;

  if (n === 1) {
    d += `L ${sx + 0.1} ${sy}`;
    return d;
  }

  for (let k = 0; k < n - 1; k++) {
    const i0 = Math.max(0, k - 1) * 2;
    const i1 = k * 2;
    const i2 = (k + 1) * 2;
    const i3 = Math.min(n - 1, k + 2) * 2;

    const p0x = p[i0],
      p0y = p[i0 + 1];
    const p1x = p[i1],
      p1y = p[i1 + 1];
    const p2x = p[i2],
      p2y = p[i2 + 1];
    const p3x = p[i3],
      p3y = p[i3 + 1];

    const c1x = p1x + (p2x - p0x) / 6;
    const c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6;
    const c2y = p2y - (p3y - p1y) / 6;

    const [cx1, cy1] = map(c1x, c1y);
    const [cx2, cy2] = map(c2x, c2y);
    const [px2, py2] = map(p2x, p2y);

    d += `C ${cx1} ${cy1}, ${cx2} ${cy2}, ${px2} ${py2} `;
  }
  return d;
}

export async function generateFlatPdf(
  originalPdfData: Uint8Array | null,
  isBlank: boolean,
  totalPages: number,
  drawingsData: any[],
) {
  let pdfDoc: PDFDocument;

  if (isBlank || !originalPdfData || originalPdfData.length === 0) {
    pdfDoc = await PDFDocument.create();
    for (let i = 0; i < totalPages; i++) {
      pdfDoc.addPage([800, 1131]); // ابعاد A4
    }
  } else {
    // ✅ اضافه کردن ignoreEncryption برای جلوگیری از خطای فایل‌های قفل شده
    pdfDoc = await PDFDocument.load(originalPdfData, {
      ignoreEncryption: true,
    });
  }

  const pages = pdfDoc.getPages();

  // گروه‌بندی نقاشی‌ها بر اساس شماره صفحه
  const drawingsByPage: Record<number, any[]> = {};
  drawingsData.forEach((d) => {
    if (d.target === "pdf") {
      if (!drawingsByPage[d.pageNumber]) drawingsByPage[d.pageNumber] = [];
      try {
        const parsed = JSON.parse(d.data);
        if (Array.isArray(parsed)) {
          drawingsByPage[d.pageNumber].push(...parsed);
        }
      } catch (e) {}
    }
  });

  for (const [pageNumStr, strokes] of Object.entries(drawingsByPage)) {
    const pageNum = parseInt(pageNumStr, 10);
    const page = pages[pageNum - 1];
    if (!page) continue;

    const { width, height } = page.getSize();

    // مپر تبدیل مختصات نرمالایز شده به مختصات واقعی PDF (Y معکوس است)
    const map = (x: number, y: number): [number, number] => [
      x * width,
      height - y * height,
    ];

    for (const stroke of strokes) {
      const color = hexToRgb(stroke.color || "#000000");
      const tool = stroke.tool || (stroke.isEraser ? "eraser" : "pen");
      if (tool === "eraser") continue;

      const p = stroke.points.flat(); // تبدیل آرایه دوبعدی به یک‌بعدی
      const size = stroke.size || 2;

      try {
        if (tool === "pen") {
          const d = tracePenSvg(p, map);
          if (d) {
            page.drawSvgPath(d, {
              borderColor: color,
              borderWidth: size,
            });
          }
        } else if (tool === "highlight-rect") {
          for (let i = 0; i + 3 < p.length; i += 4) {
            // محاسبه مختصات پایین-چپ برای pdf-lib
            const [x0, y0] = map(
              Math.min(p[i], p[i + 2]),
              Math.max(p[i + 1], p[i + 3]),
            );
            const w = Math.abs(p[i] - p[i + 2]) * width;
            const h = Math.abs(p[i + 1] - p[i + 3]) * height;
            page.drawRectangle({
              x: x0,
              y: y0,
              width: w,
              height: h,
              color: color,
              opacity: 0.4,
            });
          }
        } else if (tool === "rectangle") {
          const [x0, y0] = map(Math.min(p[0], p[2]), Math.max(p[1], p[3]));
          const w = Math.abs(p[0] - p[2]) * width;
          const h = Math.abs(p[1] - p[3]) * height;
          page.drawRectangle({
            x: x0,
            y: y0,
            width: w,
            height: h,
            borderColor: color,
            borderWidth: size,
          });
        } else if (tool === "circle") {
          const [cx, cy] = map((p[0] + p[2]) / 2, (p[1] + p[3]) / 2);
          const rx = (Math.abs(p[0] - p[2]) / 2) * width;
          const ry = (Math.abs(p[1] - p[3]) / 2) * height;
          page.drawEllipse({
            x: cx,
            y: cy,
            xScale: rx,
            yScale: ry,
            borderColor: color,
            borderWidth: size,
          });
        } else if (tool === "line") {
          const [x0, y0] = map(p[0], p[1]);
          const [x1, y1] = map(p[2], p[3]);
          page.drawLine({
            start: { x: x0, y: y0 },
            end: { x: x1, y: y1 },
            thickness: size,
            color: color,
          });
        } else if (tool === "arrow") {
          const [x0, y0] = map(p[0], p[1]);
          const [x1, y1] = map(p[2], p[3]);

          // رسم خط اصلی
          page.drawLine({
            start: { x: x0, y: y0 },
            end: { x: x1, y: y1 },
            thickness: size,
            color: color,
          });

          // رسم سر پیکان
          const angle = Math.atan2(y1 - y0, x1 - x0);
          const headLen = Math.max(10, size * 3.2);
          const headAngle = Math.PI / 6; // 30 درجه

          const ax1 = x1 - headLen * Math.cos(angle - headAngle);
          const ay1 = y1 - headLen * Math.sin(angle - headAngle);
          const ax2 = x1 - headLen * Math.cos(angle + headAngle);
          const ay2 = y1 - headLen * Math.sin(angle + headAngle);

          const dHead = `M ${x1} ${y1} L ${ax1} ${ay1} L ${ax2} ${ay2} Z`;
          page.drawSvgPath(dHead, {
            color: color,
            borderColor: color,
            borderWidth: 1,
          });
        }
      } catch (err) {
        console.warn("Failed to draw stroke on PDF:", err);
      }
    }
  }

  return await pdfDoc.save();
}
