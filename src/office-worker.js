/* global importScripts */
'use strict';
self.onmessage = async ({ data }) => {
  try {
    const bytes = Uint8Array.from(atob(data.source), ch => ch.charCodeAt(0));
    if (data.type === 'excel') {
      importScripts('../node_modules/exceljs/dist/exceljs.min.js');
      importScripts('shared/spreadsheet.js');
      const book = new self.ExcelJS.Workbook(); await book.xlsx.load(bytes);
      const errors = self.mdSpreadsheet.recalculate(book);
      self.postMessage({ value:{ model:book.model, errors:[...errors] } });
    } else {
      importScripts('../node_modules/mammoth/mammoth.browser.min.js');
      const result = await self.mammoth.convertToHtml({ arrayBuffer:bytes.buffer }, data.options);
      self.postMessage({ value:{ value:result.value, messages:result.messages } });
    }
  } catch (error) { self.postMessage({ error:error.message }); }
};
