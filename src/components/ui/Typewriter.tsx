'use client';

import { useState, useEffect } from 'react';

interface Props {
  words: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseMs?: number;
}

export default function Typewriter({
  words,
  className,
  typingSpeed = 60,
  deletingSpeed = 35,
  pauseMs = 2000,
}: Props) {
  const [displayed, setDisplayed] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayed === current) {
      timeout = setTimeout(() => setIsDeleting(true), pauseMs);
    } else if (isDeleting && displayed === '') {
      setIsDeleting(false);
      setWordIndex((i) => (i + 1) % words.length);
    } else {
      timeout = setTimeout(() => {
        setDisplayed(
          isDeleting ? current.slice(0, displayed.length - 1) : current.slice(0, displayed.length + 1)
        );
      }, isDeleting ? deletingSpeed : typingSpeed);
    }

    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseMs]);

  return (
    <span className={className}>
      {displayed}
      <span style={{ borderRight: '2px solid currentColor', marginLeft: '1px', animation: 'blink 1s step-end infinite' }} />
    </span>
  );
}
