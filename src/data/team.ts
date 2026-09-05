export interface TeamMember {
  id: string;
  name: string;
  role: string;
  category: 'medica' | 'cosmetologa' | 'asistente';
  badge: string;
  bio: string;
  specialties: string[];
  image: string;
  socialLinks?: {
    instagram?: string;
    linkedin?: string;
  };
}

export const teamMembers: TeamMember[] = [
  {
    id: 'dra-paula-landaburo',
    name: 'Dra. Paula Landaburo',
    role: 'Directora Médica & Especialista en Dermatología',
    category: 'medica',
    badge: 'DIRECCIÓN MÉDICA',
    bio: 'Médica especialista en medicina estética de precisión y armonización facial natural. Formada en las técnicas más avanzadas de toxina botulínica, rellenos, bioestimulación y tecnología láser. Su filosofía combina seguridad anatómica con elegancia y resultados naturales.',
    specialties: [
      'Toxina Botulínica & Maseteros',
      'Ácido Hialurónico & Labios Signature',
      'Láser Nordlys & Tecnología Lumínica',
      'Bioestimulación & Medicina Regenerativa',
      'Tratamientos Capilares Médicos'
    ],
    image: '/images/Dra.Landaburo.png',
    socialLinks: {
      instagram: 'https://www.instagram.com/dra_landaburo/'
    }
  },
  {
    id: 'mercedes-mechi',
    name: 'Mercedes Pasquet',
    role: 'Especialista en Cosmiatría & Cuidado Facial Integral',
    category: 'cosmetologa',
    badge: 'COSMIATRÍA AVANZADA',
    bio: 'Profesional a cargo de los protocolos de preparación dérmica, higiene facial profunda, peelings químicos y aparatología de bioestimulación no invasiva. Con dedicación y calidez, acompaña a cada paciente en su proceso de renovación cutánea.',
    specialties: [
      'Limpiezas Faciales Profundas',
      'Dermaplaning & Microdermoabrasión',
      'Peelings Químicos & Renovación Celular',
      'Radiofrecuencia & Total Glow',
      'Protocolos de Hidratación y Masajes'
    ],
    image: '/images/Dra.Landaburo.png',
    socialLinks: {
      instagram: 'https://www.instagram.com/mechiesteticapasquet/'
    }
  },
  {
    id: 'cecilia-morel',
    name: 'Cecilia Morel',
    role: 'Técnica Universitaria en Administración — Recepción y Coordinación',
    category: 'asistente',
    badge: 'COORDINACIÓN & GESTIÓN',
    bio: 'Técnica Universitaria en Administración, a cargo de la recepción y coordinación del consultorio. Es el primer contacto de los pacientes con el equipo: organiza la agenda, resuelve dudas y asegura que cada visita comience con calidez y fluidez.',
    specialties: [
      'Coordinación de Turnos y Agenda',
      'Recepción y Admisión Personalizada',
      'Acompañamiento del Paciente'
    ],
    image: '/images/Dra.Landaburo.png',
  },
  {
    id: 'laura-dzuryk',
    name: 'María Laura Dzuryk',
    role: 'Atención y Comunicación al Paciente',
    category: 'asistente',
    badge: 'ATENCIÓN AL PACIENTE',
    bio: 'Acompaña a cada paciente en la comunicación diaria del consultorio, desde la primera consulta por canales digitales y WhatsApp hasta el seguimiento posterior a cada tratamiento, garantizando una atención ágil, humana y continua.',
    specialties: [
      'Atención Directa vía WhatsApp',
      'Seguimiento Post-Tratamiento',
      'Gestión de Consultas y Cuidados'
    ],
    image: '/images/Dra.Landaburo.png',
  },
  {
    id: 'dra-noelia-luque',
    name: 'Dra. Noelia Luque',
    role: 'Especialista en Clínica Médica y Terapia Intensiva',
    category: 'medica',
    badge: 'CUERPO MÉDICO',
    bio: 'Especialista en Clínica Médica y Terapia Intensiva, con formación en medicina del estilo de vida, medicina ortomolecular y sueroterapia. Con más de una década de trayectoria clínica —incluyendo su paso por el Hospital Clínic de Barcelona— se incorpora al equipo para acompañar a los pacientes desde un abordaje que combina rigor médico con bienestar celular e integral.',
    specialties: [
      'Sueroterapia & Nutrientes Endovenosos',
      'Medicina del Estilo de Vida',
      'Medicina Ortomolecular & Regenerativa',
      'Evaluación Clínica de Bienestar'
    ],
    image: '/images/Dra.Landaburo.png',
  }
];
