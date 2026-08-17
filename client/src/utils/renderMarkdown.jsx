import React from 'react';
import katex from 'katex';

/**
 * Safely render inline or block KaTeX math
 */
function renderKaTeX(latex, isBlock = false) {
  try {
    const html = katex.renderToString(latex, {
      displayMode: isBlock,
      throwOnError: false,
    });
    return (
      <span
        className={isBlock ? 'katex-block-wrapper' : 'katex-inline-wrapper'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    return <code className="katex-error">{latex}</code>;
  }
}

/**
 * Parses bold, italic, inline code, links, and inline math in text
 */
export function formatInlineText(str) {
  if (!str || typeof str !== 'string') return str;

  // Split by inline code, bold, math, and links
  const tokens = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\$[^\$]+?\$)/g);

  return tokens.map((token, idx) => {
    if (!token) return null;

    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={idx} className="md-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={idx}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return <em key={idx}>{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('$') && token.endsWith('$') && token.length >= 2) {
      return <React.Fragment key={idx}>{renderKaTeX(token.slice(1, -1), false)}</React.Fragment>;
    }
    return token;
  });
}

/**
 * Renders full markdown text into clean React elements with support for:
 * - Headings (h1, h2, h3, h4)
 * - Lists (bulleted, numbered)
 * - Blockquotes & Callouts
 * - Code & Math blocks ($$ ... $$)
 * - Images ![alt](url)
 */
export function renderMarkdown(text) {
  if (!text) return null;

  const normalized = typeof text === 'string' ? text.replace(/\\n/g, '\n') : String(text);
  const lines = normalized.split('\n');
  const elements = [];
  let inCodeBlock = false;
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
          <div key={`math-${i}`} className="md-math-block">
            {renderKaTeX(mathContent, true)}
          </div>
        );
        continue;
      }

      if (inMathBlock) {
        elements.push(
          <div key={`math-${i}`} className="md-math-block">
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
        elements.push(
          <pre key={`code-${i}`} className="md-pre-block">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={`spacer-${i}`} className="md-spacer" />);
      continue;
    }

    // Images: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      elements.push(
        <div key={`img-${i}`} className="md-image-container">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="md-rendered-image" />
          {imgMatch[1] && <div className="md-image-caption">{imgMatch[1]}</div>}
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h3-${i}`} className="md-h4">{formatInlineText(trimmed.slice(4))}</h4>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={`h2-${i}`} className="md-h3">{formatInlineText(trimmed.slice(3))}</h3>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={`h1-${i}`} className="md-h2">{formatInlineText(trimmed.slice(2))}</h2>);
      continue;
    }

    // Blockquotes & Callouts
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={`quote-${i}`} className="md-blockquote">
          {formatInlineText(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Numbered lists: 1. item
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div key={`ol-${i}`} className="md-list-item md-ol-item">
          <span className="md-list-num">{numberedMatch[1]}.</span>
          <span className="md-list-body">{formatInlineText(numberedMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet lists: - item or * item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`ul-${i}`} className="md-list-item md-ul-item">
          <span className="md-list-bullet">•</span>
          <span className="md-list-body">{formatInlineText(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className="md-p">
        {formatInlineText(trimmed)}
      </p>
    );
  }

  return <div className="markdown-rendered-tree">{elements}</div>;
}
