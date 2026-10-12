import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({ label, required, error, hint, children }: FieldWrapperProps) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}

type FieldMeta = Omit<FieldWrapperProps, 'children'>;

type InputProps = FieldMeta & InputHTMLAttributes<HTMLInputElement>;
export function TextField({ label, required, error, hint, className = '', ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      <input className={`input ${error ? 'border-danger focus:border-danger focus:ring-danger/25' : ''} ${className}`} {...rest} />
    </FieldWrapper>
  );
}

type TextareaProps = FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>;
export function TextAreaField({ label, required, error, hint, className = '', ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      <textarea className={`input min-h-[112px] py-3 ${error ? 'border-danger' : ''} ${className}`} {...rest} />
    </FieldWrapper>
  );
}

type SelectProps = FieldMeta & SelectHTMLAttributes<HTMLSelectElement>;
export function SelectField({ label, required, error, hint, className = '', children, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      <select className={`input ${error ? 'border-danger' : ''} ${className}`} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
}
