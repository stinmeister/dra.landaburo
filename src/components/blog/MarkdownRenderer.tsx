import React from 'react';
import styles from './MarkdownRenderer.module.css';

interface Props {
  content: string;
}

/**
 * Parses inline markdown formatted text into safe React nodes.
 * Supports **bold**, *italic*, _italic_, `code`, and [links](url).
 * Raw HTML is NOT executed (all text is escaped / rendered via React strings).
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex to match:
  // 1. Links: [text](url)
  // 2. Bold: **text**
  // 3. Inline code: `code`
  // 4. Italic with *: *text*
  // 5. Italic with _: _text_
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Add text preceding the match
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    const [fullMatch, , linkText, linkUrl, boldText, codeText, italicStar, italicUnder] = match;

    if (linkText && linkUrl) {
      // Validate safe link url
      const trimmedUrl = linkUrl.trim();
      const isSafe =
        trimmedUrl.startsWith('http://') ||
        trimmedUrl.startsWith('https://') ||
        trimmedUrl.startsWith('/') ||
        trimmedUrl.startsWith('#') ||
        trimmedUrl.startsWith('mailto:');

      if (isSafe) {
        result.push(
          <a
            key={match.index}
            href={trimmedUrl}
            target={trimmedUrl.startsWith('http') ? '_blank' : undefined}
            rel={trimmedUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
            className={styles.link}
          >
            {parseInline(linkText)}
          </a>
        );
      } else {
        result.push(linkText);
      }
    } else if (boldText) {
      result.push(
        <strong key={match.index} className={styles.bold}>
          {parseInline(boldText)}
        </strong>
      );
    } else if (codeText) {
      result.push(
        <code key={match.index} className={styles.inlineCode}>
          {codeText}
        </code>
      );
    } else if (italicStar) {
      result.push(
        <em key={match.index} className={styles.italic}>
          {parseInline(italicStar)}
        </em>
      );
    } else if (italicUnder) {
      result.push(
        <em key={match.index} className={styles.italic}>
          {parseInline(italicUnder)}
        </em>
      );
    } else {
      result.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
}

type Block =
  | { type: 'h1'; content: string }
  | { type: 'h2'; content: string }
  | { type: 'h3'; content: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; content: string };

export default function MarkdownRenderer({ content }: Props) {
  if (!content || !content.trim()) {
    return <p className={styles.paragraph}>Este artículo aún no contiene texto.</p>;
  }

  const rawLines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i].trim();

    // Skip blank lines
    if (!line) {
      i++;
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4).trim() });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3).trim() });
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.slice(2).trim() });
      i++;
      continue;
    }

    // Blockquotes: lines starting with >
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // Unordered lists: starting with - or *
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^[-*]\s+/.test(rawLines[i].trim())) {
        items.push(rawLines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered lists: starting with 1. 2. etc.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
        items.push(rawLines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph: collect lines until a blank line or special block
    const paraLines: string[] = [line];
    i++;
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !rawLines[i].trim().startsWith('#') &&
      !rawLines[i].trim().startsWith('>') &&
      !/^[-*]\s+/.test(rawLines[i].trim()) &&
      !/^\d+\.\s+/.test(rawLines[i].trim()) &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(rawLines[i].trim())
    ) {
      paraLines.push(rawLines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', content: paraLines.join(' ') });
  }

  return (
    <div className={styles.markdownBody}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1 key={idx} className={styles.heading1}>
                {parseInline(block.content)}
              </h1>
            );
          case 'h2':
            return (
              <h2 key={idx} className={styles.heading2}>
                {parseInline(block.content)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={idx} className={styles.heading3}>
                {parseInline(block.content)}
              </h3>
            );
          case 'blockquote':
            return (
              <blockquote key={idx} className={styles.blockquote}>
                {block.lines.map((qLine, qIdx) => (
                  <p key={qIdx}>{parseInline(qLine)}</p>
                ))}
              </blockquote>
            );
          case 'hr':
            return <hr key={idx} className={styles.hr} />;
          case 'ul':
            return (
              <ul key={idx} className={styles.list}>
                {block.items.map((it, itIdx) => (
                  <li key={itIdx} className={styles.listItem}>
                    {parseInline(it)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className={styles.list}>
                {block.items.map((it, itIdx) => (
                  <li key={itIdx} className={styles.listItem}>
                    {parseInline(it)}
                  </li>
                ))}
              </ol>
            );
          case 'p':
          default:
            return (
              <p key={idx} className={styles.paragraph}>
                {parseInline(block.content)}
              </p>
            );
        }
      })}
    </div>
  );
}
