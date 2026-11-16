"use client";
import { useState } from "react";
import { WizardStepForm } from "@/components/crm/WizardStepForm";
import { WizardSteps } from "@/components/crm/WizardSteps";

/** Elle ekleme · 1. adım: ilk değişiklikte taslak oluşur; o andan itibaren diğer bölümlere serbestçe geçilebilir. */
export function ManualWizard() {
  const [vehicleId, setVehicleId] = useState<string | undefined>();
  return (
    <>
      <WizardSteps current={1} vehicleId={vehicleId} />
      <WizardStepForm sections={["basic", "identity", "equipment"]} next="/crm/vehicles/:id/tamamla?adim=2" submitLabel="Devam et → Kaporta" onCreated={setVehicleId} />
    </>
  );
}
