import { ShiftWizardPanel } from './ShiftWizardPanel'

interface ShiftSetupStepProps {
  shiftsAssigned: boolean
  onChange: () => void
}

export function ShiftSetupStep({ shiftsAssigned, onChange }: ShiftSetupStepProps) {
  return <ShiftWizardPanel shiftsAssigned={shiftsAssigned} onChange={onChange} />
}
