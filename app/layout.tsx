import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mandalart.AI - Transforme sonhos em planos de ação',
  description: 'Sua estratégia começa aqui. Transforme sonhos vagos em planos de ação concretos com IA.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
