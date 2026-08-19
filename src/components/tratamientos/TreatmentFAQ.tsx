'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import styles from './TreatmentFAQ.module.css';

interface FAQItem {
  question: string;
  answer: string;
}

const defaultFAQs: FAQItem[] = [
  {
    question: '¿Cuánto dura el procedimiento?',
    answer:
      'La duración varía según el tratamiento y el plan personalizado de cada paciente. En la consulta inicial la Dra. Landaburo te informa los tiempos exactos involucrados en cada etapa.',
  },
  {
    question: '¿Es doloroso?',
    answer:
      'La mayoría de los procedimientos se realizan con anestesia local o cremas anestésicas cuando resulta necesario. El nivel de incomodidad es mínimo y manejable. Tu bienestar durante cada sesión es una prioridad.',
  },
  {
    question: '¿Cuándo se ven los resultados?',
    answer:
      'Depende del tratamiento. Algunos ofrecen resultados inmediatos, mientras que otros —como biostimuladores o Nordlys— muestran mejoras progresivas durante semanas o meses. En todos los casos se trabaja con un enfoque gradual y natural.',
  },
  {
    question: '¿Cuánto tiempo de recuperación necesito?',
    answer:
      'La gran mayoría de los tratamientos permiten retomar la actividad habitual el mismo día. En la consulta previa te indicamos los cuidados específicos post-procedimiento para optimizar el resultado.',
  },
  {
    question: '¿Cuántas sesiones necesito?',
    answer:
      'El número de sesiones se define según el objetivo y las características de tu piel. La Dra. Landaburo diseña un plan personalizado en la consulta inicial, sin protocolos genéricos.',
  },
];

interface Props {
  faqs?: FAQItem[];
}

export default function TreatmentFAQ({ faqs = defaultFAQs }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Preguntas frecuentes</h2>
      <div className={styles.list}>
        {faqs.map((item, i) => (
          <div key={i} className={`${styles.item} ${openIndex === i ? styles.open : ''}`}>
            <button
              className={styles.trigger}
              onClick={() => toggle(i)}
              aria-expanded={openIndex === i}
            >
              <span className={styles.question}>{item.question}</span>
              <span className={styles.icon}>
                {openIndex === i ? <Minus size={18} /> : <Plus size={18} />}
              </span>
            </button>
            <div className={styles.panel}>
              <p className={styles.answer}>{item.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
