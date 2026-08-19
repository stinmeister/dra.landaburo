-- =============================================================================
-- MIGRACIÓN PENDIENTE — Ejecutar en Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/mdletvbgwzbpenzevurr/sql
-- =============================================================================
-- Tablas que YA EXISTEN y no tocar: profiles, patients, products, orders,
-- order_items, cookie_consents, inventory_items
-- =============================================================================

-- 1. Agregar profile_id a patients (vincula ficha clínica con auth.users)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_patients_profile_id ON public.patients(profile_id);

-- RLS para pacientes que leen su propia ficha
DROP POLICY IF EXISTS patients_patient_read_own ON public.patients;
CREATE POLICY patients_patient_read_own ON public.patients
  FOR SELECT USING (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- 2. treatments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treatments (
  id                 uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text        NOT NULL UNIQUE,
  title              text        NOT NULL,
  category           text        NOT NULL
                                 CHECK (category IN ('Facial', 'Corporal', 'Capilar', 'Dermatologia Clinica', 'Cosmetologia')),
  description        text        NOT NULL DEFAULT '',
  price_ars          numeric(12,2),
  price_usd          numeric(12,2),
  duration_minutes   integer     NOT NULL DEFAULT 30,
  professional_role  text        NOT NULL DEFAULT 'medico'
                                 CHECK (professional_role IN ('medico', 'cosmetologa')),
  commission_rate    numeric(5,2) NOT NULL DEFAULT 0.00,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatments_slug     ON public.treatments(slug);
CREATE INDEX IF NOT EXISTS idx_treatments_category ON public.treatments(category);

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY treatments_read_public ON public.treatments
  FOR SELECT USING (true);

CREATE POLICY treatments_write_admin ON public.treatments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 3. product_batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_batches (
  id              uuid    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number    text    NOT NULL,
  expiration_date date    NOT NULL,
  quantity        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches(expiration_date);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batches_admin_only ON public.product_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 4. gift_cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text        NOT NULL UNIQUE,
  purchaser_patient_id     uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  amount_ars               numeric(12,2) NOT NULL,
  remaining_balance_ars    numeric(12,2) NOT NULL,
  status                   text        NOT NULL DEFAULT 'active'
                                       CHECK (status IN ('active', 'redeemed', 'expired')),
  expiration_date          timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY gift_cards_admin_all ON public.gift_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY gift_cards_read_purchaser ON public.gift_cards
  FOR SELECT USING (
    purchaser_patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. appointments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment_id             uuid        NOT NULL REFERENCES public.treatments(id) ON DELETE RESTRICT,
  professional_profile_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_date         timestamptz NOT NULL,
  status                   text        NOT NULL DEFAULT 'scheduled'
                                       CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_staff ON public.appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'medico', 'operativo')
    )
  );

CREATE POLICY appointments_patient_read ON public.appointments
  FOR SELECT USING (
    patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id                       uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id           uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
  order_id                 uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  patient_id               uuid        NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  amount_ars               numeric(12,2) NOT NULL,
  amount_usd               numeric(12,2),
  currency                 text        NOT NULL DEFAULT 'ARS'
                                       CHECK (currency IN ('ARS', 'USD')),
  payment_method           text        NOT NULL
                                       CHECK (payment_method IN ('efectivo', 'transferencia', 'mercadopago')),
  professional_profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  commission_amount_ars    numeric(12,2) NOT NULL DEFAULT 0.00,
  payment_date             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_date         ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_professional ON public.payments(professional_profile_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_admin_all ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY payments_medico_own ON public.payments
  FOR SELECT USING (professional_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. employee_tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_tasks (
  id                   uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                text        NOT NULL,
  description          text,
  due_date             date        NOT NULL DEFAULT CURRENT_DATE,
  is_completed         boolean     NOT NULL DEFAULT false,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_due ON public.employee_tasks(due_date, is_completed);

ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_tasks_own ON public.employee_tasks
  FOR ALL USING (assigned_profile_id = auth.uid());

CREATE POLICY employee_tasks_admin ON public.employee_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 8. Verificar / crear trigger auto-profile en registro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'paciente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 9. Promover primer admin (reemplazar con tu email real)
-- ---------------------------------------------------------------------------
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'tu@email.com';
