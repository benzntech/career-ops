#!/usr/bin/env node

/**
 * generate-pdf.mjs — HTML CV → PDF via agent-browser-stealth (abs)
 *
 * Usage:
 *   node generate-pdf.mjs <input.html> <output.pdf>
 *   BROWSER_CLI=agent-browser node generate-pdf.mjs ...   # use agent-browser instead
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync, statSync } from 'fs';

const BROWSER_CLI = process.env.BROWSER_CLI || 'agent-browser-stealth';

function ab(args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(BROWSER_CLI, args, { timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout)); }
        catch { resolve({ success: true }); }
      } else {
        reject(new Error(stderr || `${BROWSER_CLI} exited ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

function normalizeTextForATS(html) {
  const replacements = {};
  const bump = (key, n) => { replacements[key] = (replacements[key] || 0) + n; };
  const masks = [];
  const masked = html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
    masks.push(m);
    return `\u0000MASK${masks.length - 1}\u0000`;
  });
  let out = '';
  for (let i = 0; i < masked.length; ) {
    const lt = masked.indexOf('<', i);
    if (lt === -1) { out += sanitize(masked.slice(i)); break; }
    out += sanitize(masked.slice(i, lt));
    const gt = masked.indexOf('>', lt);
    if (gt === -1) { out += masked.slice(lt); break; }
    out += masked.slice(lt, gt + 1);
    i = gt + 1;
  }
  return {
    html: out.replace(/\u0000MASK(\d+)\u0000/g, (_, n) => masks[n]),
    replacements
  };

  function sanitize(text) {
    if (!text) return text;
    return text
      .replace(/\u2014/g, () => { bump('em-dash', 1); return '-'; })
      .replace(/\u2013/g, () => { bump('en-dash', 1); return '-'; })
      .replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote', 1); return '"'; })
      .replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote', 1); return "'"; })
      .replace(/\u2026/g, () => { bump('ellipsis', 1); return '...'; })
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width', 1); return ''; })
      .replace(/\u00A0/g, () => { bump('nbsp', 1); return ' '; });
  }
}

async function generatePDF() {
  const args = process.argv.slice(2);
  let inputPath, outputPath;
  for (const arg of args) {
    if (!inputPath) inputPath = arg;
    else outputPath = arg;
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: node generate-pdf.mjs <input.html> <output.pdf>');
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`🌐 Browser: ${BROWSER_CLI}`);

  let html = await readFile(inputPath, 'utf-8');
  const { html: normalized, replacements } = normalizeTextForATS(html);
  html = normalized;
  const total = Object.values(replacements).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const breakdown = Object.entries(replacements).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`🧹 ATS normalization: ${total} replacements (${breakdown})`);
  }

  // Write normalized HTML to temp file
  const tmpPath = outputPath + '.tmp.html';
  await writeFile(tmpPath, html, 'utf-8');

  try {
    await ab(['--launch', 'open', `file://${tmpPath}`]);
    await ab(['wait', '--load', 'networkidle', '--timeout', '10000']);
    await ab(['eval', 'document.fonts.ready']);
    await ab(['pdf', outputPath]);
  } finally {
    await unlink(tmpPath).catch(() => {});
    try { await ab(['close']); } catch { /* ignore */ }
  }

  if (!existsSync(outputPath)) {
    throw new Error(`${BROWSER_CLI} failed to produce PDF`);
  }

  const size = statSync(outputPath).size;
  const pdfString = await readFile(outputPath, 'latin1');
  const pageCount = (pdfString.match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`✅ PDF generated: ${outputPath}`);
  console.log(`📊 Pages: ${pageCount} | 📦 ${(size / 1024).toFixed(1)} KB`);
}

generatePDF().catch(err => { console.error('❌ PDF generation failed:', err.message); process.exit(1); });
