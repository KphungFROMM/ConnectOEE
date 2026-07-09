import { HierarchySetupStep } from './HierarchySetupStep'

interface PlantSetupStepProps {
  plantCount: number
  onChange: () => void
}

export function PlantSetupStep({ plantCount, onChange }: PlantSetupStepProps) {
  return (
    <HierarchySetupStep
      wizardStep="plant"
      title="Create your plant"
      description="Add one or more plants for this installation. Departments and lines come in the next steps."
      itemCount={plantCount}
      savedMessage="Plant saved. Add another or continue to departments when ready."
      onChange={onChange}
    />
  )
}
