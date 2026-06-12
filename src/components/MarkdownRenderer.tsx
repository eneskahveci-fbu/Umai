"use client";

// src/components/MarkdownRenderer.tsx — Markdown renderer (temel)

import { useMemo } from "react";

interface Props {
  content: string;
  className?: string;
}

// Basit markdown → HTML dönüştürücü (kütüphanesiz)
function simpleMarkdownToHTML(md: string): string {
  let html = md;

  // Code fence (```dil:yol\n kod \n```)
  html = html.replace(
    /```(\w+)?(?::([^\n]*))?\n([\s\S]*?)```/g,
    (_m, lang, path, code) => {
      const cleanCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const pathLabel = path
        ? `<div class="code-path">📄 ${path}</div>`
        : "";
      const langLabel = lang
        ? `<div class="code-lang">${lang}</div>`
        : "";
      return `<div class="code-block">${pathLabel}${langLabel}<pre><code>${cleanCode}</code></pre></div>`;
    },
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="inline-code">$1</code>',
  );

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold, italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Listeler (basit)
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(
    /((?:<li>.*<\/li>\n?)+)/g,
    "<ul>$1</ul>",
  );

  // Paragraflar
  html = html.replace(
    /^(?!<[hulci\]|<\/?[hulc])(.+)$/gm,
    "<p>$1</p>",
  );

  // Satır sonu
  html = html.replace(/\n/g, "<br/>");

  return html;
}

export function MarkdownRenderer({ content, className = "" }: Props) {
  const html = useMemo(() => simpleMarkdownToHTML(content), [content]);

  return (
    <div
      className={`markdown-body prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
