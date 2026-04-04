import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function AdminPage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center animate-fade-in">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Dashboard Admin
        </h1>
        <p className="mt-2 text-muted-foreground">Em construção</p>
        <Button variant="outline" className="mt-6" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
