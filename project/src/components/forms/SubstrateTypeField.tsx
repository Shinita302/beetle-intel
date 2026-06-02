import { FormField, SelectInput, TextInput } from '../ui/FormField';
import { SUBSTRATE_CUSTOM, SUBSTRATE_PRESET_OPTIONS } from '../../constants/substrate';

interface SubstrateTypeFieldProps {
  selection: string;
  customValue: string;
  onSelectionChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  label?: string;
  hint?: string;
}

export function SubstrateTypeField({
  selection,
  customValue,
  onSelectionChange,
  onCustomChange,
  label = 'Substrate Type',
  hint,
}: SubstrateTypeFieldProps) {
  const isCustom = selection === SUBSTRATE_CUSTOM;

  return (
    <div className="space-y-3">
      <FormField label={label} hint={hint}>
        <SelectInput
          value={selection}
          onChange={onSelectionChange}
          options={[...SUBSTRATE_PRESET_OPTIONS]}
        />
      </FormField>
      {isCustom && (
        <FormField label="Custom Substrate">
          <TextInput
            value={customValue}
            onChange={onCustomChange}
            placeholder="Enter your substrate type"
          />
        </FormField>
      )}
    </div>
  );
}
