'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { trackWhatsAppClick } from '@/lib/tracking';
import styles from './WhatsAppButton.module.css';

export default function WhatsAppButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <a 
      href="https://wa.me/5491169684062" 
      target="_blank" 
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick('floating_button')}
      className={`${styles.whatsappBtn} ${isVisible ? styles.visible : ''}`}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={32} />
    </a>
  );
}
