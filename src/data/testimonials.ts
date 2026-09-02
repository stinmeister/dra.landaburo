export interface Testimonial {
  id: string;
  patient_name: string;
  treatment: string;
  rating: number;
  quote: string;
  source: 'Google Reviews' | 'Doctoralia' | 'Consultorio';
  date: string;
}

export const testimonials: Testimonial[] = [
  {
    id: '1',
    patient_name: 'María Eugenia R.',
    treatment: 'Armonización Facial & Labios',
    rating: 5,
    quote: 'La atención de la Dra. Paula es impecable. Buscaba un resultado muy natural y logró exactamente lo que quería sin perder mis facciones. Súper profesional y cálida.',
    source: 'Google Reviews',
    date: 'Febrero 2026'
  },
  {
    id: '2',
    patient_name: 'Ignacio M.',
    treatment: 'Toxina Botulínica en Maseteros',
    rating: 5,
    quote: 'Fui por bruxismo y tensión de mandíbula insoportable. En pocos días sentí un alivio enorme y dejé de levantarme con dolor de cabeza. Muy recomendable.',
    source: 'Google Reviews',
    date: 'Enero 2026'
  },
  {
    id: '3',
    patient_name: 'Camila S.',
    treatment: 'Limpieza Profunda + Total Glow (Mechi)',
    rating: 5,
    quote: 'Mercedes tiene unas manos increíbles. La piel me quedó luminosa, suave y sin marcas. El consultorio es hermoso y te hacen sentir súper cómoda.',
    source: 'Google Reviews',
    date: 'Febrero 2026'
  },
  {
    id: '4',
    patient_name: 'Sofía L.',
    treatment: 'Skinboosters & Hidratación Profunda',
    rating: 5,
    quote: 'Llegué con la piel opaca y me fui con una luminosidad increíble. La doctora te explica todo con detalle y uno se va muy tranquila. El equipo es de diez.',
    source: 'Google Reviews',
    date: 'Marzo 2026'
  },
  {
    id: '5',
    patient_name: 'Florencia T.',
    treatment: 'Botox Preventivo',
    rating: 5,
    quote: 'Vine recomendada y no me arrepiento para nada. El consultorio está hermoso, la atención es muy profesional y el resultado es súper natural. Totalmente recomendada.',
    source: 'Google Reviews',
    date: 'Abril 2026'
  }
];
