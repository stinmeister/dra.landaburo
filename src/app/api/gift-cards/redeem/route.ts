// POST /api/gift-cards/redeem
// Applies a partial or full redemption to a gift card.
// Business rules: if amount_to_redeem >= remaining_balance_ars → status=redeemed
//                 if amount_to_redeem < remaining_balance_ars  → status=partial
// Auth required: staff only (admin/medico/operativo/recepcionista).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Sin permisos para aplicar canjes.' }, { status: 403 });
  }

  let body: { code: string; amount_to_redeem: number; notes?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const { code, amount_to_redeem, notes } = body;
  if (!code?.trim()) return NextResponse.json({ error: 'Código requerido.' }, { status: 400 });
  if (!amount_to_redeem || amount_to_redeem <= 0) {
    return NextResponse.json({ error: 'El monto a canjear debe ser mayor a 0.' }, { status: 400 });
  }

  // Fetch current card state
  const { data: card, error: fetchError } = await supabase
    .from('gift_cards')
    .select('id, remaining_balance_ars, status, expiration_date')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();

  if (fetchError || !card) {
    return NextResponse.json({ error: 'Gift card no encontrada.' }, { status: 404 });
  }

  // Validate state
  if (!['active', 'partial'].includes(card.status)) {
    return NextResponse.json(
      { error: `Esta gift card no puede canjearse (estado: ${card.status}).` },
      { status: 422 }
    );
  }

  // Check expiration
  if (new Date(card.expiration_date) < new Date()) {
    // Expire it
    await supabase.from('gift_cards').update({ status: 'expired' }).eq('id', card.id);
    return NextResponse.json({ error: 'Esta gift card está vencida.' }, { status: 422 });
  }

  // Check balance
  if (amount_to_redeem > card.remaining_balance_ars) {
    return NextResponse.json(
      { error: `Saldo insuficiente. Disponible: $${card.remaining_balance_ars}.` },
      { status: 422 }
    );
  }

  const newBalance = card.remaining_balance_ars - amount_to_redeem;
  const newStatus = newBalance <= 0 ? 'redeemed' : 'partial';

  const { error: updateError } = await supabase
    .from('gift_cards')
    .update({
      remaining_balance_ars: newBalance,
      status: newStatus,
      redeemed_by: user.id,
      redeemed_at: newStatus === 'redeemed' ? new Date().toISOString() : undefined,
      redemption_notes: notes || null,
    })
    .eq('id', card.id);

  if (updateError) {
    console.error('[GiftCard/Redeem] Update error:', updateError);
    return NextResponse.json({ error: 'Error al aplicar el canje.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    remaining_balance_ars: newBalance,
    status: newStatus,
    message: newStatus === 'redeemed'
      ? 'Gift card canjeada en su totalidad.'
      : `Canje parcial aplicado. Saldo restante: $${newBalance}.`,
  });
}
