import { FormField, NumberInput, SelectInput } from '../ui/FormField';
import { CONTAINER_SIZE_UNITS } from '../../constants/containerSize';
import type { ContainerSizeUnit } from '../../types';

interface ContainerSizeFieldProps {
  value: number;
  unit: ContainerSizeUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: ContainerSizeUnit) => void;
  label?: string;
  hint?: string;
}

export function ContainerSizeField({
  value,
  unit,
  onValueChange,
  onUnitChange,
  label = 'Container Size',
  hint,
}: ContainerSizeFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <div className="flex gap-2">
        <div className="flex-[2] min-w-0">
          <NumberInput value={value} onChange={onValueChange} step={1} min={0} />
        </div>
        <div className="flex-1 min-w-[100px]">
          <SelectInput
            value={unit}
            onChange={(v) => onUnitChange(v as ContainerSizeUnit)}
            options={CONTAINER_SIZE_UNITS}
          />
        </div>
      </div>
    </FormField>
  );
}
