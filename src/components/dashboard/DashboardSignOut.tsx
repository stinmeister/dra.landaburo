'use client';
// Tiny Client Component just for the sign-out button inside the dashboard
// sidebar. Sign-out must be client-side (calls the Supabase browser client).
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './DashboardSignOut.module.css';

export default function DashboardSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className={styles.btn}>
      Cerrar sesión
    </button>
  );
}
