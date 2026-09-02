import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dralandaburo.com',
      },
    ],
  },
  async redirects() {
    return [
      // 1. WordPress Treatments URLs (with date pattern)
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/toxina-botulinica/:path*',
        destination: '/tratamientos/toxina-botulinica',
        permanent: true,
      },
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/acido-hialuronico/:path*',
        destination: '/tratamientos/acido-hialuronico',
        permanent: true,
      },
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/bioestimuladores-de-colageno/:path*',
        destination: '/tratamientos/biostimuladores',
        permanent: true,
      },
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/luz-pulsada-nordlys/:path*',
        destination: '/tratamientos/nordlys',
        permanent: true,
      },
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/hilos-tensores/:path*',
        destination: '/tratamientos/hilos-tensores',
        permanent: true,
      },
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/mesoterapia/:path*',
        destination: '/tratamientos/mesoterapia',
        permanent: true,
      },
      // 2. Generic WordPress date posts -> /blog
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:slug',
        destination: '/blog',
        permanent: true,
      },
      // 3. WordPress Legacy Pages
      {
        source: '/about-us',
        destination: '/sobre-mi',
        permanent: true,
      },
      {
        source: '/our-doctors',
        destination: '/sobre-mi',
        permanent: true,
      },
      {
        source: '/contacts',
        destination: '/contacto',
        permanent: true,
      },
      {
        source: '/appointment',
        destination: '/contacto',
        permanent: true,
      },
      {
        source: '/shop',
        destination: '/tienda',
        permanent: true,
      },
      {
        source: '/cart',
        destination: '/tienda/carrito',
        permanent: true,
      },
      {
        source: '/checkout',
        destination: '/tienda/carrito',
        permanent: true,
      },
      {
        source: '/my-account',
        destination: '/login',
        permanent: true,
      },
      {
        source: '/blog-page',
        destination: '/blog',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
