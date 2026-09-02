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
      'Toxina Botulínica',
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
    name: 'Mercedes',
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
  }
];
