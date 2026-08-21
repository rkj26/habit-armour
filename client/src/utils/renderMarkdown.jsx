import React from 'react';
import katex from 'katex';

/**
 * Safely render inline or block KaTeX math
 */
function renderKaTeX(latex, isBlock = false) {
  if (!latex || typeof latex !== 'string') return null;
  try {
    const html = katex.renderToString(latex.trim(), {
      displayMode: isBlock,
      throwOnError: false,
    });
    return (
      <span
        className={isBlock ? 'katex-block-wrapper' : 'katex-inline-wrapper'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <code className="katex-error">{latex}</code>;
  }
}

/**
 * Normalizes LaTeX delimiters, raw document preambles, and math blocks
 */
export function normalizeLatexText(text) {
  if (!text) return '';
  let s = typeof text === 'string' ? text.replace(/\\n/g, '\n') : String(text);

  // If text is a full LaTeX document with preamble, extract document body
  if (s.includes('\\begin{document}')) {
    const match = s.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    if (match) {
      s = match[1].trim();
    }
  }

  // Strip standalone LaTeX doc preambles
  s = s.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
  s = s.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  s = s.replace(/\\geometry\{[^}]*\}/g, '');
  s = s.replace(/\\maketitle/g, '');

  // Convert standard LaTeX display math \[ ... \] to $$ ... $$
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);

  // Convert standard LaTeX inline math \( ... \) to $ ... $
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // Auto-wrap bare LaTeX environments if not already inside $$...$$
  s = s.replace(
    /(\\begin\{(aligned|align\*?|equation\*?|gather\*?|cases|matrix|bmatrix|pmatrix)\}[\s\S]*?\\end\{\2\})/g,
    (match) => `\n$$\n${match.trim()}\n$$\n`
  );

  return s;
}

/**
 * Parses bold, italic, inline code, links, and inline math in text
 */
export function formatInlineText(str) {
  if (!str || typeof str !== 'string') return str;

  // Split by code, display math, inline math, bold, italic, and links
  const tokens = str.split(
    /(`[^`]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  );

  return tokens.map((token, idx) => {
    if (!token) return null;

    // Inline code: `code`
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={idx} className="md-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    // Display Math: $$ ... $$
    if (token.startsWith('$$') && token.endsWith('$$') && token.length >= 4) {
      return (
        <span key={idx} className="md-math-inline-block">
          {renderKaTeX(token.slice(2, -2).trim(), true)}
        </span>
      );
    }
    // Inline Math: $ ... $
    if (token.startsWith('$') && token.endsWith('$') && token.length >= 2) {
      return <React.Fragment key={idx}>{renderKaTeX(token.slice(1, -1).trim(), false)}</React.Fragment>;
    }
    // Bold: **text**
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={idx}>{formatInlineText(token.slice(2, -2))}</strong>;
    }
    // Italic: *text*
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return <em key={idx}>{formatInlineText(token.slice(1, -1))}</em>;
    }
    // Markdown link: [text](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // Auto-detect unwrapped LaTeX commands (e.g. \nabla_\theta, \mathbb{R}, \frac{a}{b})
    if (
      /\\[a-zA-Z]+/.test(token) &&
      /\\(mathbb|mathcal|mathbf|mathrm|nabla|frac|sum|prod|int|sqrt|partial|alpha|beta|gamma|delta|epsilon|theta|lambda|sigma|tau|phi|psi|omega|pi|infty|approx|times|cdot|le|ge|in|forall|exists|rightarrow|leftarrow)\b/.test(
        token
      )
    ) {
      return <React.Fragment key={idx}>{renderKaTeX(token.trim(), false)}</React.Fragment>;
    }

    return token;
  });
}

/**
 * Renders full markdown text into clean React elements with support for:
 * - Headings (h1, h2, h3, h4)
 * - Lists (bulleted, numbered)
 * - Blockquotes & Callouts
 * - Code & Math blocks ($$ ... $$, ```latex, ```math)
 * - Images ![alt](url)
 */
export function renderMarkdown(text) {
  if (!text) return null;

  const normalized = normalizeLatexText(text);
  const lines = normalized.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = [];
  let inMathBlock = false;
  let mathBlockContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for start/end of Math Block ($$)
    if (trimmed === '$$' || (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2)) {
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2 && !inMathBlock) {
        // Single-line block math $$ e = mc^2 $$
        const mathContent = trimmed.slice(2, -2).trim();
        elements.push(
          <div key={`math-${i}`} className="md-math-block my-3 overflow-x-auto text-center">
            {renderKaTeX(mathContent, true)}
          </div>
        );
        continue;
      }

      if (inMathBlock) {
        elements.push(
          <div key={`math-${i}`} className="md-math-block my-3 overflow-x-auto text-center">
            {renderKaTeX(mathBlockContent.join('\n'), true)}
          </div>
        );
        mathBlockContent = [];
        inMathBlock = false;
      } else {
        inMathBlock = true;
      }
      continue;
    }

    if (inMathBlock) {
      mathBlockContent.push(line);
      continue;
    }

    // Check for start/end of Code Block
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Check if code block is explicitly LaTeX / math
        if (['latex', 'math', 'tex'].includes(codeBlockLang.toLowerCase())) {
          elements.push(
            <div key={`math-block-${i}`} className="md-math-block my-3 overflow-x-auto text-center">
              {renderKaTeX(codeBlockContent.join('\n'), true)}
            </div>
          );
        } else {
          elements.push(
            <pre key={`code-${i}`} className="md-pre-block bg-muted/60 my-2 overflow-x-auto rounded-md p-3 font-mono text-xs">
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          );
        }
        codeBlockContent = [];
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={`spacer-${i}`} className="md-spacer h-2" />);
      continue;
    }

    // Images: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      elements.push(
        <div key={`img-${i}`} className="md-image-container my-3">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="md-rendered-image max-h-96 rounded-md border" />
          {imgMatch[1] && <div className="md-image-caption text-muted-foreground mt-1 text-xs">{imgMatch[1]}</div>}
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      elements.push(<h5 key={`h4-${i}`} className="md-h4 text-sm font-semibold tracking-tight mt-3 mb-1">{formatInlineText(trimmed.slice(5))}</h5>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h3-${i}`} className="md-h3 text-base font-semibold tracking-tight mt-4 mb-1">{formatInlineText(trimmed.slice(4))}</h4>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={`h2-${i}`} className="md-h2 text-lg font-bold tracking-tight mt-5 mb-2">{formatInlineText(trimmed.slice(3))}</h3>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={`h1-${i}`} className="md-h1 text-xl font-bold tracking-tight mt-6 mb-2">{formatInlineText(trimmed.slice(2))}</h2>);
      continue;
    }

    // Blockquotes & Callouts
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={`quote-${i}`} className="md-blockquote border-primary/40 bg-muted/30 my-2 border-l-2 pl-3 italic">
          {formatInlineText(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Numbered lists: 1. item
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div key={`ol-${i}`} className="md-list-item md-ol-item flex items-start gap-2 text-sm leading-relaxed">
          <span className="md-list-num text-muted-foreground font-mono font-medium">{numberedMatch[1]}.</span>
          <span className="md-list-body flex-1">{formatInlineText(numberedMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet lists: - item or * item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`ul-${i}`} className="md-list-item md-ul-item flex items-start gap-2 text-sm leading-relaxed">
          <span className="md-list-bullet text-muted-foreground">•</span>
          <span className="md-list-body flex-1">{formatInlineText(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className="md-p text-sm leading-relaxed">
        {formatInlineText(trimmed)}
      </p>
    );
  }

  return <div className="markdown-rendered-tree flex flex-col gap-1.5">{elements}</div>;
}
