import { Input } from '@scanvault/ui';
import { useId } from 'react';

type QuestionSuggestInputProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * The scan type's own question bank (`scanType.questions`). Often empty — v6
   * scan types carry none — so the field must stay usable as a plain input.
   */
  suggestions?: readonly string[];
};

/**
 * A free-text question field with the scan type's standard questions offered as
 * type-ahead.
 *
 * Backed by a native <datalist> rather than a hand-rolled popover. The legacy
 * version mirrored its filtered suggestions into state inside an effect, and an
 * unstable `suggestions` array from the caller drove render -> setState ->
 * render until React bailed out with "Maximum update depth exceeded". A
 * datalist cannot loop, and it comes with keyboard and screen-reader support.
 */
export function QuestionSuggestInput({
  label,
  placeholder,
  value,
  onChange,
  suggestions = [],
}: QuestionSuggestInputProps) {
  const listId = useId();

  return (
    <>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        list={suggestions.length > 0 ? listId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
