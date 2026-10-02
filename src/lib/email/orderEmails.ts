import { createClient } from '@supabase/supabase-js';

export interface OrderItemDetail {
  product_name: string;
  quantity: number;
  unit_price_ars: number;
  subtotal_ars?: number;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  total_ars: number;
  delivery_method: 'retiro' | 'envio' | string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_postal_code: string | null;
  delivery_notes: string | null;
}

export interface StoreConfigDetail {
  pickup_address: string;
  pickup_hours: string;
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

export async function sendOrderEmails({
  order,
  items,
  storeConfig,
}: {
  order: OrderDetail;
  items: OrderItemDetail[];
  storeConfig: StoreConfigDetail;
}): Promise<{
  buyerSuccess: boolean;
  buyerError: string | null;
  staffSuccess: boolean;
  staffError: string | null;
}> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || 'Consultorio Dra. Landaburo <consultas@dralandaburo.com>';
  const staffRecipient = process.env.STORE_NOTIFICATION_EMAIL || 'dralandaburo@gmail.com';

  let buyerSuccess = false;
  let buyerError: string | null = null;
  let staffSuccess = false;
  let staffError: string | null = null;

  if (!resendApiKey) {
    const noKeyMsg = 'RESEND_API_KEY no está configurada en las variables de entorno.';
    console.error(`[OrderEmails] Error: ${noKeyMsg}`);
    buyerError = noKeyMsg;
    staffError = noKeyMsg;
    await updateOrderEmailStatus(order.id, {
      buyer_email_sent: false,
      buyer_email_error: buyerError,
      staff_email_sent: false,
      staff_email_error: staffError,
    });
    return { buyerSuccess, buyerError, staffSuccess, staffError };
  }

  // Armar tabla de items para ambos correos
  const itemsRowsHtml = items
    .map(
      (item) => `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 10px 0; color: #1C1C1C; font-weight: 500;">${item.product_name}</td>
          <td style="padding: 10px 0; text-align: center; color: #666666;">${item.quantity}</td>
          <td style="padding: 10px 0; text-align: right; color: #1C1C1C;">${formatARS(item.unit_price_ars)}</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #1C1C1C;">${formatARS(
            item.unit_price_ars * item.quantity
          )}</td>
        </tr>
      `
    )
    .join('');

  // 1. Email a la Compradora
  try {
    const isRetiro = order.delivery_method === 'retiro';

    const deliveryBlockHtml = isRetiro
      ? `
        <div style="background: #faf7f2; border: 1px solid #C5A47E; border-radius: 6px; padding: 18px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #1C1C1C; font-size: 16px; font-weight: 600;">📍 Retiro en consultorio</h3>
          <p style="margin: 6px 0; font-size: 14px; color: #333333;">
            <strong>Dirección:</strong> ${storeConfig.pickup_address}
          </p>
          <p style="margin: 6px 0; font-size: 14px; color: #333333;">
            <strong>Horarios de atención:</strong> ${storeConfig.pickup_hours}
          </p>
          <p style="margin: 12px 0 0; font-size: 13px; color: #666666;">
            Te avisaremos por WhatsApp o email en cuanto tu pedido esté listo para retirar.
          </p>
        </div>
      `
      : `
        <div style="background: #faf7f2; border: 1px solid #C5A47E; border-radius: 6px; padding: 18px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #1C1C1C; font-size: 16px; font-weight: 600;">📦 Envío a domicilio</h3>
          <p style="margin: 6px 0; font-size: 14px; color: #333333;">
            <strong>Dirección de entrega:</strong> ${order.delivery_address || 'No especificada'}
          </p>
          <p style="margin: 6px 0; font-size: 14px; color: #333333;">
            <strong>Localidad y CP:</strong> ${order.delivery_city || ''} ${order.delivery_postal_code ? `(CP ${order.delivery_postal_code})` : ''}
          </p>
          ${
            order.delivery_notes
              ? `<p style="margin: 6px 0; font-size: 14px; color: #333333;"><strong>Referencias / Depto:</strong> ${order.delivery_notes}</p>`
              : ''
          }
          <p style="margin: 12px 0 0; font-size: 13px; color: #666666;">
            Coordinaremos el despacho a la brevedad y te enviaremos la información de seguimiento.
          </p>
        </div>
      `;

    const buyerEmailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1C1C1C; padding: 26px; text-align: center;">
          <h1 style="color: #C5A47E; margin: 0; font-size: 20px; font-weight: 500; letter-spacing: 0.05em;">Dra. Paula Landaburo</h1>
          <p style="color: #ffffff; margin: 6px 0 0; font-size: 14px; opacity: 0.85;">¡Gracias por tu compra, ${order.buyer_name}!</p>
        </div>

        <div style="padding: 26px; color: #1C1C1C; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">
            Tu pedido <strong>${order.order_number}</strong> ha sido confirmado y el pago registrado exitosamente.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="border-bottom: 2px solid #C5A47E; text-align: left; font-size: 12px; color: #848484; text-transform: uppercase;">
                <th style="padding: 8px 0;">Producto</th>
                <th style="padding: 8px 0; text-align: center;">Cant.</th>
                <th style="padding: 8px 0; text-align: right;">Precio</th>
                <th style="padding: 8px 0; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 16px 0 6px; text-align: right; font-weight: bold; font-size: 15px; color: #1C1C1C;">Total pagado:</td>
                <td style="padding: 16px 0 6px; text-align: right; font-weight: bold; font-size: 17px; color: #C5A47E;">${formatARS(order.total_ars)}</td>
              </tr>
            </tfoot>
          </table>

          ${deliveryBlockHtml}

          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #fafafa; border-radius: 6px;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #444444;">
              ¿Tenés dudas con tu pedido o necesitás coordinar la entrega?
            </p>
            <a
              href="https://wa.me/5491169684062?text=${encodeURIComponent(
                `Hola! Tengo una consulta sobre mi pedido online ${order.order_number}`
              )}"
              style="display: inline-block; background: #25D366; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 4px; font-weight: 600; font-size: 14px;"
              target="_blank"
            >
              Contactar por WhatsApp
            </a>
          </div>

          <p style="font-size: 12px; color: #848484; margin-top: 30px; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 16px;">
            Consultorio Dra. Paula Landaburo · Leandro N. Alem 45, Gualeguaychú · dralandaburo.com
          </p>
        </div>
      </div>
    `;

    const buyerRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [order.buyer_email],
        subject: `Confirmación de tu pedido ${order.order_number} — Dra. Paula Landaburo`,
        html: buyerEmailHtml,
      }),
    });

    if (buyerRes.ok) {
      buyerSuccess = true;
      const resJson = await buyerRes.json().catch(() => ({}));
      console.log(`[OrderEmails] Email a compradora enviado OK para pedido ${order.order_number}. Resend ID: ${resJson.id}`);
    } else {
      buyerError = await buyerRes.text();
      console.error(`[OrderEmails] Error enviando email a compradora (${buyerRes.status}):`, buyerError);
    }
  } catch (err: any) {
    buyerError = err.message || 'Error de red enviando email a compradora';
    console.error('[OrderEmails] Excepción enviando email a compradora:', err);
  }

  // 2. Email al Consultorio (Staff / Operativo)
  try {
    const isRetiro = order.delivery_method === 'retiro';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dralandaburo.com';

    const staffEmailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1C1C1C; padding: 22px; text-align: center;">
          <h1 style="color: #C5A47E; margin: 0; font-size: 18px; font-weight: 500; letter-spacing: 0.05em;">NUEVA VENTA ONLINE REGISTRADA</h1>
          <p style="color: #ffffff; margin: 6px 0 0; font-size: 14px; opacity: 0.85;">Pedido: ${order.order_number}</p>
        </div>

        <div style="padding: 24px; color: #1C1C1C; line-height: 1.6;">
          <div style="background: #fafafa; border-left: 4px solid #C5A47E; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px; font-size: 14px;"><strong>Compradora:</strong> ${order.buyer_name}</p>
            <p style="margin: 0 0 6px; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${order.buyer_email}">${order.buyer_email}</a></p>
            <p style="margin: 0 0 6px; font-size: 14px;">
              <strong>Teléfono:</strong> ${
                order.buyer_phone
                  ? `<a href="https://wa.me/${order.buyer_phone.replace(/[^0-9]/g, '')}">${order.buyer_phone}</a>`
                  : 'No especificado'
              }
            </p>
            <p style="margin: 0; font-size: 14px;">
              <strong>Método de entrega:</strong> ${isRetiro ? '📍 Retiro en consultorio' : '📦 Envío a domicilio'}
            </p>
            ${
              !isRetiro
                ? `
                  <p style="margin: 6px 0 0; font-size: 13px; color: #444444;">
                    <strong>Dirección:</strong> ${order.delivery_address || ''}, ${order.delivery_city || ''} (CP ${order.delivery_postal_code || ''})
                    ${order.delivery_notes ? `<br /><em>Ref: ${order.delivery_notes}</em>` : ''}
                  </p>
                `
                : ''
            }
          </div>

          <h3 style="margin: 20px 0 10px; font-size: 15px; color: #1C1C1C;">Detalle de productos</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #C5A47E; text-align: left; font-size: 12px; color: #848484; text-transform: uppercase;">
                <th style="padding: 8px 0;">Producto</th>
                <th style="padding: 8px 0; text-align: center;">Cant.</th>
                <th style="padding: 8px 0; text-align: right;">Unitario</th>
                <th style="padding: 8px 0; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 14px 0 6px; text-align: right; font-weight: bold; font-size: 15px;">Total:</td>
                <td style="padding: 14px 0 6px; text-align: right; font-weight: bold; font-size: 16px; color: #C5A47E;">${formatARS(order.total_ars)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="text-align: center; margin-top: 25px;">
            <a
              href="${siteUrl}/dashboard/operativo"
              style="display: inline-block; background: #1C1C1C; color: #C5A47E; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: 600; font-size: 14px;"
            >
              Ir a Bandeja de Pedidos en Dashboard →
            </a>
          </div>
        </div>
      </div>
    `;

    const staffRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [staffRecipient],
        reply_to: order.buyer_email,
        subject: `[Nueva Venta Online] Pedido ${order.order_number} — ${formatARS(order.total_ars)}`,
        html: staffEmailHtml,
      }),
    });

    if (staffRes.ok) {
      staffSuccess = true;
      const resJson = await staffRes.json().catch(() => ({}));
      console.log(`[OrderEmails] Email a consultorio enviado OK para pedido ${order.order_number}. Resend ID: ${resJson.id}`);
    } else {
      staffError = await staffRes.text();
      console.error(`[OrderEmails] Error enviando email a consultorio (${staffRes.status}):`, staffError);
    }
  } catch (err: any) {
    staffError = err.message || 'Error de red enviando email a consultorio';
    console.error('[OrderEmails] Excepción enviando email a consultorio:', err);
  }

  // Persistir estado de los emails en orders
  await updateOrderEmailStatus(order.id, {
    buyer_email_sent: buyerSuccess,
    buyer_email_error: buyerError,
    staff_email_sent: staffSuccess,
    staff_email_error: staffError,
  });

  return { buyerSuccess, buyerError, staffSuccess, staffError };
}

async function updateOrderEmailStatus(
  orderId: string,
  status: {
    buyer_email_sent: boolean;
    buyer_email_error: string | null;
    staff_email_sent: boolean;
    staff_email_error: string | null;
  }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('orders')
      .update({
        buyer_email_sent: status.buyer_email_sent,
        buyer_email_error: status.buyer_email_error,
        staff_email_sent: status.staff_email_sent,
        staff_email_error: status.staff_email_error,
        emails_attempted_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('[OrderEmails] Error persistiendo estado de emails en orders:', error);
    }
  } catch (dbErr) {
    console.error('[OrderEmails] Error conectando con BD para persistir estado de emails:', dbErr);
  }
}
