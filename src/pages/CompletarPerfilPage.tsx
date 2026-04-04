import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, UserCircle } from 'lucide-react';

export default function CompletarPerfilPage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <UserCircle className="h-8 w-8 text-accent-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Complete seu perfil
        </h1>
        <p className="mt-3 text-muted-foreground">
          Para acessar o sistema, você precisa preencher seus dados profissionais.
          Esta funcionalidade será disponibilizada em breve.
        </p>
        <Button variant="outline" className="mt-6" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
