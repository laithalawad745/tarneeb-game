import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'تركس 3D | لعبة الشدة أونلاين',
  description: 'العب تركس مع أصحابك أونلاين بتجربة 3D مميزة',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
