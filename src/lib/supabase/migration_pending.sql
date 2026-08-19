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

-- ---------------------------------------------------------------------------
-- 10. app_settings — configuración global de la app (1 fila, id='default')
-- Guarda credenciales de MercadoPago y otras settings de nivel aplicación.
-- Solo el rol admin puede leer/escribir. El webhook route usa service role.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                  text        NOT NULL PRIMARY KEY DEFAULT 'default',
  mp_access_token     text,
  mp_public_key       text,
  mp_webhook_secret   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Asegurar fila única (constraint ya garantizada por PK='default')
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Solo admin puede leer/escribir — el service role key bypasea RLS internamente
DROP POLICY IF EXISTS app_settings_admin_only ON public.app_settings;
CREATE POLICY app_settings_admin_only ON public.app_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. Columnas adicionales en orders para MercadoPago
-- (orders ya existe según CLAUDE.md — solo agregamos cols nuevas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_name         text,
  ADD COLUMN IF NOT EXISTS buyer_email        text,
  ADD COLUMN IF NOT EXISTS buyer_phone        text,
  ADD COLUMN IF NOT EXISTS payment_status     text NOT NULL DEFAULT 'pending'
                                              CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_method     text,
  ADD COLUMN IF NOT EXISTS mp_payment_id      text,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

-- Índice para buscar órdenes por estado de pago
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- ---------------------------------------------------------------------------
-- 12. order_items — columnas adicionales si la tabla ya existe
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name       text,
  ADD COLUMN IF NOT EXISTS unit_price_ars     numeric(12,2),
  ADD COLUMN IF NOT EXISTS subtotal_ars       numeric(12,2);

-- ---------------------------------------------------------------------------
-- 13. Eliminar constraint restrictivo en products.brand_type
-- La tabla products fue creada con un CHECK en brand_type desconocido.
-- Este bloque lo elimina para permitir nombres de marcas libres.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_brand_type_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products DROP CONSTRAINT products_brand_type_check;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 14. Seed: 24 productos de dermocosmética demo
-- Ejecutar DESPUÉS de eliminar el constraint (sección 13 arriba).
-- Usar ON CONFLICT DO NOTHING para que sea idempotente.
-- ---------------------------------------------------------------------------
INSERT INTO public.products (name, slug, description, brand_type, price_ars, compare_price_ars, image_url, category, stock_quantity, is_active)
VALUES
  -- Limpieza
  ('Cetaphil Gentle Skin Cleanser 500ml', 'cetaphil-gentle-skin-cleanser-500ml', 'Limpiador suave sin jabón, ideal para piel seca y sensible. Elimina impurezas sin alterar la barrera cutánea.', 'Cetaphil', 7500, 9000, NULL, 'Limpieza', 18, true),
  ('La Roche-Posay Effaclar Gel Purificante 400ml', 'lrp-effaclar-gel-400ml', 'Gel limpiador purificante con zinc, formulado para piel mixta a grasa con tendencia acneica.', 'La Roche-Posay', 9800, NULL, NULL, 'Limpieza', 12, true),
  ('Bioderma Sensibio H2O 500ml', 'bioderma-sensibio-h2o-500ml', 'Agua micelar de limpieza y desmaquillaje para piel sensible. Elimina maquillaje resistente al agua.', 'Bioderma', 12500, 14000, NULL, 'Limpieza', 10, true),
  ('Avène Agua Termal en Spray 150ml', 'avene-agua-termal-spray-150ml', 'Agua termal pura con propiedades calmantes y anti-irritantes. Alivia la piel después de tratamientos.', 'Avène', 6200, NULL, NULL, 'Limpieza', 25, true),
  -- Hidratación
  ('CeraVe Moisturising Cream 454g', 'cerave-moisturising-cream-454g', 'Crema hidratante con ceramidas y ácido hialurónico. Restaura y mantiene la barrera protectora de la piel.', 'CeraVe', 14500, 18000, NULL, 'Hidratación', 15, true),
  ('La Roche-Posay Cicaplast Baume B5 100ml', 'lrp-cicaplast-baume-b5-100ml', 'Bálsamo reparador multi-propósito. Acelera la cicatrización post-tratamiento y calma la piel irritada.', 'La Roche-Posay', 11200, NULL, NULL, 'Hidratación', 20, true),
  ('Cetaphil Rich Nourishing Body Cream 250ml', 'cetaphil-rich-nourishing-cream-250ml', 'Crema corporal nutritiva de absorción rápida con manteca de karité y vitamina E.', 'Cetaphil', 6900, 8500, NULL, 'Hidratación', 14, true),
  ('Avène Skin Recovery Cream 40ml', 'avene-skin-recovery-cream-40ml', 'Crema reconfortante para pieles muy sensibles, intolerantes y reactivas. Sin perfume ni colorantes.', 'Avène', 13800, NULL, NULL, 'Hidratación', 8, true),
  ('Eucerin Hyaluron-Filler Day Cream SPF15 50ml', 'eucerin-hyaluron-filler-day-spf15-50ml', 'Crema de día con ácido hialurónico profundo. Rellena las arrugas desde adentro y protege del sol.', 'Eucerin', 16500, 20000, NULL, 'Hidratación', 9, true),
  -- Protección Solar
  ('ISDIN Eryfotona Actinica SPF 100+ 50ml', 'isdin-eryfotona-actinica-spf100', 'Fotoprotector de alta eficacia con ADNRepair Enzymes. Indicado en fotoenvejecimiento y queratosis actínica.', 'ISDIN', 28000, 32000, NULL, 'Protección Solar', 7, true),
  ('La Roche-Posay Anthelios UVMUNE 400 SPF50+ 50ml', 'lrp-anthelios-uvmune-400-spf50', 'Protección UV ultra-alta con filtro Mexoryl 400. Textura fluida, no comedogénico.', 'La Roche-Posay', 22500, NULL, NULL, 'Protección Solar', 12, true),
  ('ISDIN Fusion Water Color SPF50 50ml', 'isdin-fusion-water-color-spf50', 'Fotoprotector con ligero tono unificador. Textura agua ultraligera, no grasa.', 'ISDIN', 19800, 23000, NULL, 'Protección Solar', 10, true),
  ('Eucerin Oil Control SPF50+ 50ml', 'eucerin-oil-control-spf50', 'Fotoprotector matificante para piel mixta-grasa. Controla el brillo hasta 8 horas.', 'Eucerin', 17500, NULL, NULL, 'Protección Solar', 11, true),
  -- Sérum
  ('La Roche-Posay Hyalu B5 Serum 30ml', 'lrp-hyalu-b5-serum-30ml', 'Sérum hidratante con ácido hialurónico puro y vitamina B5. Rellena y restaura la piel.', 'La Roche-Posay', 18500, 22000, NULL, 'Sérum', 13, true),
  ('Sesderma Retises 0.25% Retinol Cream 30ml', 'sesderma-retises-025-30ml', 'Crema con retinol encapsulado en nanosomas. Alta tolerancia, para iniciar tratamiento con retinoides.', 'Sesderma', 23500, NULL, NULL, 'Sérum', 6, true),
  ('Vichy Liftactiv B3 Sérum Anti-Manchas 30ml', 'vichy-liftactiv-b3-serum-30ml', 'Sérum con vitamina B3 pura al 5%. Corrige manchas oscuras y unifica el tono en 4 semanas.', 'Vichy', 21000, 25000, NULL, 'Sérum', 9, true),
  ('CeraVe Vitamin C Serum 30ml', 'cerave-vitamin-c-serum-30ml', 'Sérum con vitamina C al 10% y ácido hialurónico. Ilumina el tono apagado y protege del daño oxidativo.', 'CeraVe', 16800, NULL, NULL, 'Sérum', 11, true),
  -- Contorno de Ojos
  ('Eucerin Hyaluron-Filler Eye Cream 15ml', 'eucerin-hyaluron-filler-eye-cream-15ml', 'Contorno de ojos con ácido hialurónico de acción dual. Reduce patas de gallo y bolsas.', 'Eucerin', 17200, 21000, NULL, 'Contorno de Ojos', 7, true),
  ('La Roche-Posay Redermic Retinol Eyes 15ml', 'lrp-redermic-retinol-eyes-15ml', 'Contorno de ojos con retinol puro. Suaviza arrugas y mejora la firmeza alrededor del ojo.', 'La Roche-Posay', 19500, NULL, NULL, 'Contorno de Ojos', 5, true),
  ('Vichy Mineral 89 Eyes Fortifying Serum 15ml', 'vichy-mineral-89-eyes-15ml', 'Sérum contorno de ojos con agua volcánica y ácido hialurónico. Reduce ojeras e hidrata intensamente.', 'Vichy', 15900, 18500, NULL, 'Contorno de Ojos', 8, true),
  -- Tratamiento Específico
  ('La Roche-Posay Effaclar Duo+ SPF30 40ml', 'lrp-effaclar-duo-plus-spf30-40ml', 'Tratamiento anti-imperfecciones con SPF30. Reduce el acné, las marcas post-acné y la apariencia de los poros.', 'La Roche-Posay', 15800, NULL, NULL, 'Tratamiento Específico', 14, true),
  ('Vichy ProEven Advanced Dark Spot Corrector 30ml', 'vichy-proeven-advanced-30ml', 'Corrector de manchas con LHA y ácido kójico. Unifica el tono y previene la reaparición de manchas.', 'Vichy', 24500, 29000, NULL, 'Tratamiento Específico', 8, true),
  ('Sesderma Acglicolic Classic Forte Cream 50ml', 'sesderma-acglicolic-classic-forte-50ml', 'Crema exfoliante con ácido glicólico al 10%. Renueva la piel, mejora textura y reduce líneas finas.', 'Sesderma', 22000, NULL, NULL, 'Tratamiento Específico', 7, true),
  ('Avène Cicalfate+ Crema Reparadora Post-Acto 40ml', 'avene-cicalfate-plus-40ml', 'Crema reparadora e hidratante para post-procedimientos. Calma, protege y acelera la cicatrización cutánea.', 'Avène', 12800, 15000, NULL, 'Tratamiento Específico', 16, true)
ON CONFLICT (slug) DO NOTHING;
