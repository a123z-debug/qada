/**
 * Judicial Print Helper for Moeen & Court Memos
 * Formats Saudi Administrative Court memorandums into standard official A4 pages
 */
export function printLegalMemo(
  content: string,
  title: string = 'محرر قضائي - أصول القضاء'
) {
  // Strip Markdown markers if needed for clean judicial printing
  const cleanContent = content
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1');

  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) {
    window.print();
    return;
  }

  const escapedContent = cleanContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const formattedHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@400;500;700&display=swap');
        @page {
          size: A4;
          margin: 20mm 15mm 20mm 15mm;
        }
        body {
          font-family: 'Amiri', 'Traditional Arabic', 'Tajawal', serif, sans-serif;
          font-size: 15pt;
          line-height: 1.85;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 28px;
        }
        .header {
          text-align: center;
          border-bottom: 2px double #334155;
          padding-bottom: 14px;
          margin-bottom: 28px;
        }
        .header .kingdom {
          font-size: 13pt;
          font-weight: bold;
          margin: 0 0 4px 0;
          color: #1e293b;
        }
        .header h1 {
          font-size: 18pt;
          margin: 0 0 6px 0;
          font-weight: bold;
          color: #0f172a;
        }
        .header .subtitle {
          margin: 2px 0;
          font-size: 11pt;
          color: #475569;
        }
        .header .date {
          font-size: 10pt;
          color: #64748b;
          margin-top: 4px;
        }
        .content {
          white-space: pre-wrap;
          word-break: break-word;
          text-align: justify;
          margin-bottom: 40px;
          font-size: 14pt;
        }
        .footer {
          margin-top: 40px;
          border-top: 1px solid #cbd5e1;
          padding-top: 12px;
          display: flex;
          justify-content: space-between;
          font-size: 10pt;
          color: #64748b;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="kingdom">المملكة العربية السعودية</div>
        <h1>أصول القضاء - منصة القضايا والدفوعات</h1>
        <div class="subtitle">محرر قضائي رسمي للمراجعة والطباعة</div>
        <div class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</div>
      </div>
      <div class="content">${escapedContent}</div>
      <div class="footer">
        <div>أصول القضاء - منصة القضايا والدفوعات</div>
        <div>صفحة طباعة معتمدة</div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(formattedHtml);
  printWindow.document.close();
}
