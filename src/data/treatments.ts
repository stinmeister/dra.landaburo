export interface Treatment {
  slug: string;
  title: string;
  shortTitle: string;
  category: 'facial' | 'corporal' | 'capilar';
  description: string;
  fullDescription: string;
  icon: string;
  heroImage: string;
}

export const treatments: Treatment[] = [
  {
    slug: 'toxina-botulinica',
    title: 'Toxina Botulínica',
    shortTitle: 'Toxina Botulínica',
    category: 'facial',
    icon: 'Sparkles',
    heroImage: '/images/cerrar-manos-dando-inyeccion-mujer-joven.jpg',
    description: 'Suaviza las líneas de expresión y devuelve frescura a la mirada, sin perder naturalidad ni gestos propios.',
    fullDescription: 'La toxina botulínica es uno de los tratamientos más elegidos para suavizar las líneas de expresión y devolverle frescura a la mirada, sin perder naturalidad ni gestos propios. En consulta, la Dra. Landaburo evalúa cada rostro de forma individual para definir dosis y zonas de aplicación, priorizando siempre un resultado sutil y armónico. Es un procedimiento ambulatorio, con tiempos de recuperación mínimos, pensado para acompañar la piel en las distintas etapas de la vida.',
  },
  {
    slug: 'acido-hialuronico',
    title: 'Ácido Hialurónico',
    shortTitle: 'Ác. Hialurónico',
    category: 'facial',
    icon: 'Droplets',
    heroImage: '/images/mujer-de-cerca-recibiendo-relleno-de-labios-en-la-clinica-scaled.jpg',
    description: 'Recupera volumen, define contornos y equilibra proporciones faciales de manera segura y reversible.',
    fullDescription: 'Los rellenos de ácido hialurónico permiten recuperar volumen, definir contornos y equilibrar proporciones faciales de manera segura y reversible. Se utilizan tanto para armonización facial como para hidratación profunda de la piel, siempre con un enfoque personalizado que respeta los rasgos naturales de cada paciente. La Dra. Landaburo trabaja con protocolos que buscan resultados elegantes y progresivos, evitando cualquier cambio abrupto.',
  },
  {
    slug: 'nordlys',
    title: 'Nordlys — Luz Pulsada',
    shortTitle: 'Nordlys',
    category: 'facial',
    icon: 'Sun',
    heroImage: '/images/especialista-en-procedimiento-facial-con-instrumento-scaled.jpg',
    description: 'Tecnología de última generación para tratar manchas, rojeces y textura irregular de la piel.',
    fullDescription: 'Nordlys es la tecnología de luz pulsada que utiliza el consultorio para tratar manchas, rojeces y textura irregular de la piel, mejorando su calidad general de forma no invasiva. Al ser un equipo de última generación, permite protocolos precisos y adaptados a cada tipo de piel, con sesiones cómodas y sin tiempos de inactividad prolongados. Es una opción frecuente dentro de los planes de rejuvenecimiento facial y corporal.',
  },
  {
    slug: 'hilos-tensores',
    title: 'Hilos Tensores',
    shortTitle: 'Hilos Tensores',
    category: 'facial',
    icon: 'ArrowUpRight',
    heroImage: '/images/anciana-sonriente-con-inyeccion-para-las-arrugas-de-sus-ojos-scaled.jpg',
    description: 'Alternativa mínimamente invasiva para mejorar la firmeza y definición del óvalo facial.',
    fullDescription: 'Los hilos tensores son una alternativa mínimamente invasiva para mejorar la firmeza y definición del óvalo facial, estimulando además la producción natural de colágeno. El procedimiento se realiza en consultorio, con anestesia local, y está indicado para quienes buscan un efecto lifting progresivo y natural, sin pasar por cirugía. Como en todos los tratamientos, la evaluación previa define la técnica y cantidad de hilos más adecuada para cada caso.',
  },
  {
    slug: 'biostimuladores',
    title: 'Biostimuladores de Colágeno',
    shortTitle: 'Biostimuladores',
    category: 'corporal',
    icon: 'Leaf',
    heroImage: '/images/Sculptra.webp',
    description: 'Tratamientos inyectables que promueven la regeneración natural de la piel con resultados graduales y duraderos.',
    fullDescription: 'Los biostimuladores de colágeno son tratamientos inyectables que promueven la regeneración natural de la piel, mejorando su firmeza, elasticidad y calidad general con el paso de las sesiones. Son especialmente recomendados como parte de protocolos de bienestar corporal y facial a mediano plazo, con resultados que se construyen de forma gradual y duradera. La Dra. Landaburo diseña el plan de sesiones según el objetivo y las características de la piel de cada paciente.',
  },
  {
    slug: 'mesoterapia',
    title: 'Mesoterapia',
    shortTitle: 'Mesoterapia',
    category: 'corporal',
    icon: 'Syringe',
    heroImage: '/images/preparacion-de-sangre-para-inyecciones-cosmetologo-pone-tubo-de-sangre-en-centrifuga-scaled.jpg',
    description: 'Microinyecciones con activos específicos para hidratar, nutrir y mejorar la calidad de la piel.',
    fullDescription: 'La mesoterapia consiste en la aplicación de microinyecciones con activos específicos para hidratar, nutrir y mejorar la calidad de la piel del rostro y del cuerpo. Es un tratamiento versátil, utilizado tanto para luminosidad facial como para el abordaje de flacidez y textura en distintas zonas corporales. Se trabaja siempre con protocolos personalizados, pensados para sumar en conjunto con otros tratamientos del plan de cada paciente.',
  },
  {
    slug: 'prp',
    title: 'Plasma Rico en Plaquetas (PRP)',
    shortTitle: 'PRP',
    category: 'facial',
    icon: 'Sparkles',
    heroImage: '/images/cerrar-mano-sujetando-la-jeringa-con-prp-scaled.jpg',
    description: '',
    fullDescription: '// TODO: Copy médico pendiente de aprobación',
  },
  {
    slug: 'carboxiterapia',
    title: 'Carboxiterapia',
    shortTitle: 'Carboxiterapia',
    category: 'corporal',
    icon: 'Activity',
    heroImage: '/images/Carboxiterapia.jpg',
    description: '',
    fullDescription: '// TODO: Copy médico pendiente de aprobación',
  },
  {
    slug: 'dermapen',
    title: 'Dermapen / Microagujas',
    shortTitle: 'Dermapen',
    category: 'facial',
    icon: 'Feather',
    heroImage: '/images/paciente-sometido-procedimiento-de-microagujas.jpg',
    description: '',
    fullDescription: '// TODO: Copy médico pendiente de aprobación',
  },
  {
    slug: 'tratamiento-capilar',
    title: 'Salud Capilar & Tratamientos Anticaída',
    shortTitle: 'Salud Capilar',
    category: 'capilar',
    icon: 'Sparkles',
    heroImage: '/images/hombre-dandose-un-masaje-en-el-cuero-cabelludo-2.webp',
    description: 'Protocolos médicos personalizados para frenar la caída, recuperar densidad y fortalecer la fibra capilar en hombres y mujeres.',
    fullDescription: 'La salud capilar requiere un diagnóstico médico preciso para abordar las causas reales del debilitamiento y la caída del cabello. En consulta, la Dra. Landaburo evalúa cada caso para diseñar un protocolo combinado que puede integrar Mesoterapia capilar con principios activos específicos, Plasma Rico en Plaquetas (PRP), Exosomas y tecnología láser. Tratamientos ambulatorios y seguros, orientados a revitalizar el folículo piloso, estimular la circulación del cuero cabelludo y promover un crecimiento fuerte y saludable.',
  },
  {
    slug: 'capilar-masculino',
    title: 'Salud Capilar & Tratamientos Anticaída',
    shortTitle: 'Salud Capilar',
    category: 'capilar',
    icon: 'Sparkles',
    heroImage: '/images/hombre-dandose-un-masaje-en-el-cuero-cabelludo-2.webp',
    description: 'Protocolos médicos personalizados para frenar la caída, recuperar densidad y fortalecer la fibra capilar en hombres y mujeres.',
    fullDescription: 'La salud capilar requiere un diagnóstico médico preciso para abordar las causas reales del debilitamiento y la caída del cabello. En consulta, la Dra. Landaburo evalúa cada caso para diseñar un protocolo combinado que puede integrar Mesoterapia capilar con principios activos específicos, Plasma Rico en Plaquetas (PRP), Exosomas y tecnología láser. Tratamientos ambulatorios y seguros, orientados a revitalizar el folículo piloso, estimular la circulación del cuero cabelludo y promover un crecimiento fuerte y saludable.',
  },
];

export function getTreatmentBySlug(slug: string): Treatment | undefined {
  return treatments.find((t) => t.slug === slug);
}

export function getTreatmentsByCategory(category: 'facial' | 'corporal' | 'capilar'): Treatment[] {
  return treatments.filter((t) => t.category === category);
}

