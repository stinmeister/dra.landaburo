-- ============================================================================
-- MIGRACIÓN: Tabla de Cobros Reales Diarios (Cash Payments)
-- Archivo: 20260921_cash_payments.sql
-- Para ejecutar en el SQL Editor de Supabase por Agustín Landaburo
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_date DATE NOT NULL,                        -- Fecha real del cobro (cierre de caja del día)
    appointment_date DATE,                            -- Fecha del turno/cita (contexto operativo)
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    patient_name_raw TEXT NOT NULL,                   -- Nombre tal como llegó del export de Calu
    service TEXT,                                     -- Tratamiento / concepto
    payment_method TEXT NOT NULL,                     -- Medio de pago
    professional_name TEXT,                           -- Profesional declarado (origen)
    professional_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount_ars NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    amount_usd NUMERIC(12,2),
    currency TEXT NOT NULL DEFAULT 'ARS',
    is_fused_amount BOOLEAN NOT NULL DEFAULT false,   -- True si combina USD y ARS sin desglosar
    is_product_sale BOOLEAN NOT NULL DEFAULT false,   -- True si es venta mostrador o URDI PRODUCTOS
    source_file TEXT,                                 -- Archivo de origen
    external_id TEXT NOT NULL UNIQUE,                 -- Clave determinista de deduplicación
    notes TEXT,                                       -- Auditoría, tags y notas adicionales
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_cash_payments_date ON public.cash_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_payments_prof ON public.cash_payments(professional_profile_id);
CREATE INDEX IF NOT EXISTS idx_cash_payments_patient ON public.cash_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_cash_payments_ext ON public.cash_payments(external_id);

-- RLS
ALTER TABLE public.cash_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura staff/admin de cash_payments"
    ON public.cash_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Inserción staff/admin de cash_payments"
    ON public.cash_payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'staff')
        )
    );
