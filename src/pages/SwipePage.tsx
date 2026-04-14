import { useAuth } from '@/hooks/use-auth';
import { AuthPage } from '@/components/AuthPage';
import { MobileSwipe } from '@/components/MobileSwipe';
import { Loader2 } from 'lucide-react';

export default function SwipePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <MobileSwipe />;
}
