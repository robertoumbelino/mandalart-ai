import React from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SiteAnalytics } from './components/SiteAnalytics';
import './globals.css';

export const maxDuration = 180;

const poppins = localFont({
  src: [
    { path: './fonts/poppins-300.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/poppins-800.woff2', weight: '800', style: 'normal' },
    { path: './fonts/poppins-900.woff2', weight: '900', style: 'normal' },
    { path: './fonts/poppins-500-italic.woff2', weight: '500', style: 'italic' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mandalart - Transforme sonhos em planos de ação',
  description: 'Transforme seu objetivo em 8 caminhos e ações práticas, personalizados a partir das suas respostas. Experimente seu primeiro passo grátis.',
  applicationName: 'Mandalart',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
