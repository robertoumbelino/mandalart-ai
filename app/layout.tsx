import React from 'react';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const maxDuration = 180;

export const metadata: Metadata = {
  title: 'Mandalart.AI - Transforme sonhos em planos de ação',
  description: 'Sua estratégia começa aqui. Transforme sonhos vagos em planos de ação concretos com IA.',
  applicationName: 'Mandalart.AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
