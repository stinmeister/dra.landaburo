// GET /api/gift-cards/lookup?code=DL-XXXX-XXXX
// Returns gift card data for dashboard validation. Auth required (staff only).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Código requerido.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowedRoles = ['admin', 'medico', 'operativo', 'recepcionista'];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
  }

  const { data: card, error } = await supabase
    .from('gift_cards')
    .select('id, code, amount_ars, remaining_balance_ars, status, expiration_date, sender_name, sender_email, recipient_name, dedication')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('[GiftCard/Lookup] DB error:', error);
    return NextResponse.json({ error: 'Error al buscar.' }, { status: 500 });
  }
  if (!card) {
    return NextResponse.json({ error: 'No se encontró ninguna gift card con ese código.' }, { status: 404 });
  }

  return NextResponse.json(card);
}
