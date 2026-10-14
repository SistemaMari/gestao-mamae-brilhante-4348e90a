import type React from 'react';

/** Card das telas de perfil (Meu perfil das profissionais e dos gestores). */
export function PerfilCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function PerfilCardTitle({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
      {Icon && <Icon className="h-5 w-5 text-primary" />}
      {children}
    </h2>
  );
}
