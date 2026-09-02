export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Tratamientos',
    href: '/tratamientos',
    children: [
      { label: 'Toxina Botulínica', href: '/tratamientos/toxina-botulinica' },
      { label: 'Ácido Hialurónico', href: '/tratamientos/acido-hialuronico' },
      { label: 'Nordlys', href: '/tratamientos/nordlys' },
      { label: 'Hilos Tensores', href: '/tratamientos/hilos-tensores' },
      { label: 'Biostimuladores', href: '/tratamientos/biostimuladores' },
      { label: 'Mesoterapia', href: '/tratamientos/mesoterapia' },
    ],
  },
  { label: 'Tienda', href: '/tienda' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contacto', href: '/contacto' },
];

export const footerLinks = {
  main: [
    { label: 'Tratamientos', href: '/tratamientos' },
    { label: 'Sobre Mí', href: '/sobre-mi' },
    { label: 'Blog', href: '/blog' },
    { label: 'Tienda', href: '/tienda' },
    { label: 'Consentimientos', href: '/consentimientos' },
  ],
};
