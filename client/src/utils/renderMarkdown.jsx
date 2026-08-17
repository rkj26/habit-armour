import React from 'react';

/**
 * Parses bold, italic, inline code, and inline math in text
 */
export function formatInlineText(str) {
  if (!str || typeof str !== 'string') return str;

  // Split by inline code, bold, math, and links
  const tokens = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\$[^$]+\$)/g);

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
      return (
        <span key={idx} className="md-math-inline">
          {token.slice(1, -1)}
        </span>
      );
    }
    return token;
  });
}

/**
 * Renders full markdown text into clean React elements with support for:
 * - Headings (h1, h2, h3, h4)
 * - Lists (bulleted, numbered)
 * - Blockquotes & Callouts
 * - Code & Math blocks
 * - Images ![alt](url)
 */
export function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';
  let inMathBlock = false;
  let mathBlockContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

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
        codeBlockLang = '';
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

    // Check for start/end of Math Block ($$)
    if (trimmed === '$$' || (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2)) {
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
        // Single line math block
        const mathContent = trimmed.slice(2, -2).trim();
        elements.push(
          <div key={`math-single-${i}`} className="md-math-block">
            {mathContent}
          </div>
        );
        continue;
      }
      if (inMathBlock) {
        elements.push(
          <div key={`math-${i}`} className="md-math-block">
            {mathBlockContent.join('\n')}
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

    // Images: ![alt](url)
    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      const altText = imageMatch[1] || 'Embedded Diagram';
      const imgUrl = imageMatch[2];
      elements.push(
        <div key={`img-${i}`} className="md-image-wrapper">
          <img src={imgUrl} alt={altText} className="md-embedded-image" />
          {altText && <span className="md-image-caption">{altText}</span>}
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('####')) {
      elements.push(
        <h5 key={`h5-${i}`} className="md-h4">
          {formatInlineText(trimmed.replace(/^####\s*/, ''))}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith('###')) {
      elements.push(
        <h4 key={`h4-${i}`} className="md-h4">
          {formatInlineText(trimmed.replace(/^###\s*/, ''))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('##')) {
      elements.push(
        <h3 key={`h3-${i}`} className="md-h3">
          {formatInlineText(trimmed.replace(/^##\s*/, ''))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('#')) {
      elements.push(
        <h2 key={`h2-${i}`} className="md-h2">
          {formatInlineText(trimmed.replace(/^#\s*/, ''))}
        </h2>
      );
      continue;
    }

    // Blockquote & Callouts
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote key={`quote-${i}`} className="md-blockquote">
          {formatInlineText(quoteContent)}
        </blockquote>
      );
      continue;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr-${i}`} className="md-hr" />);
      continue;
    }

    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <ul key={`ul-${i}`} className="md-ul">
          <li>{formatInlineText(itemText)}</li>
        </ul>
      );
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <ol key={`ol-${i}`} className="md-ol" start={parseInt(numMatch[1], 10)}>
          <li>{formatInlineText(numMatch[2])}</li>
        </ol>
      );
      continue;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={`spacer-${i}`} className="md-spacer" />);
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className="md-p">
        {formatInlineText(line)}
      </p>
    );
  }

  // Handle unclosed blocks
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="code-unclosed" className="md-pre-block">
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    );
  }
  if (inMathBlock && mathBlockContent.length > 0) {
    elements.push(
      <div key="math-unclosed" className="md-math-block">
        {mathBlockContent.join('\n')}
      </div>
    );
  }

  return elements;
}

export default renderMarkdown;
