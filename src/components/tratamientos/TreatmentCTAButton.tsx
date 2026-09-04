'use client';

import { Button } from '@/components/ui/Button';
import { trackScheduleClick } from '@/lib/tracking';

interface TreatmentCTAButtonProps {
  treatmentTitle: string;
}

export default function TreatmentCTAButton({ treatmentTitle }: TreatmentCTAButtonProps) {
  return (
    <Button
      href="/contacto"
      variant="primary"
      size="lg"
      onClick={() => trackScheduleClick(treatmentTitle, 'treatment_detail_page')}
    >
      Agendá tu consulta
    </Button>
  );
}
