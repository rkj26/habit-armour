import React, { useId } from 'react';
import './ui.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* --- Layout ---------------------------------------------------------------- */

/**
 * Flex container. Replaces the `style={{ display: 'flex', gap: '16px' }}` that
 * appears hundreds of times across this codebase; gaps come from the 8pt scale
 * so vertical rhythm stays consistent between views.
 */
export function Stack({
  direction = 'column',
  gap = 4,
  align,
  justify,
  wrap = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        'ui-stack',
        `ui-stack--${direction}`,
        `ui-stack--gap-${gap}`,
        align && `ui-stack--align-${align}`,
        justify === 'between' && 'ui-stack--justify-between',
        wrap && 'ui-stack--wrap',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* --- Card ------------------------------------------------------------------ */

export function Card({ padding = 'md', interactive = false, className, children, ...rest }) {
  return (
    <div
      className={cx('ui-card', `ui-card--${padding}`, interactive && 'ui-card--interactive', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, divider = true }) {
  return (
    <div className={cx('ui-card__header', !divider && 'ui-card__header--plain')}>
      <div>
        {title && <h3 className="ui-card__title">{title}</h3>}
        {description && <p className="ui-card__description">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/* --- Button ---------------------------------------------------------------- */

export function Spinner({ size = 'md', className }) {
  return <span className={cx('ui-spinner', `ui-spinner--${size}`, className)} aria-hidden="true" />;
}

/**
 * `loading` disables the button and swaps in a spinner, so callers stop
 * hand-rolling `disabled={busy}` plus a text swap and getting it subtly
 * different each time.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  block = false,
  disabled = false,
  type = 'button',
  icon,
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(
        'btn',
        `btn-${variant}`,
        size !== 'md' && `ui-btn--${size}`,
        block && 'ui-btn--block',
        loading && 'ui-btn--loading',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}

/* --- Form fields ----------------------------------------------------------- */

/**
 * Label + control + hint + error, wired up for screen readers.
 *
 * Pass `error` and the control gets aria-invalid and is described by the error
 * text. That wiring is the reason to use this rather than a bare .form-group:
 * it is exactly what everyone forgets, and it is how server-side 422s from
 * POST /api/config end up visible next to the offending input.
 */
export function Field({ label, hint, error, required = false, htmlFor, children }) {
  const generatedId = useId();
  const id = htmlFor || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const control =
    typeof children === 'function'
      ? children({
          id,
          'aria-invalid': error ? 'true' : undefined,
          'aria-describedby': cx(errorId, hintId) || undefined,
        })
      : children;

  return (
    <div className="ui-field">
      {label && (
        <label className="ui-field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="ui-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {hint && !error && (
        <span className="ui-field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="ui-field__error" id={errorId} role="alert">
          <span aria-hidden="true">⚠</span>
          {error}
        </span>
      )}
    </div>
  );
}

export function Input({ className, ...rest }) {
  return <input className={cx('form-input', className)} {...rest} />;
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx('form-textarea', className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cx('form-select', className)} {...rest}>
      {children}
    </select>
  );
}

export function Slider({ value, min = 1, max = 10, suffix, className, ...rest }) {
  return (
    <div className={cx('ui-slider', className)}>
      <input type="range" className="ui-slider__input" value={value} min={min} max={max} {...rest} />
      <span className="ui-slider__value">{suffix ? `${value}${suffix}` : `${value}/${max}`}</span>
    </div>
  );
}

/* --- Feedback -------------------------------------------------------------- */

const ALERT_ICONS = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '⛔' };

export function Alert({ variant = 'info', title, icon, onDismiss, className, children }) {
  return (
    <div
      className={cx('ui-alert', `ui-alert--${variant}`, className)}
      role={variant === 'danger' ? 'alert' : 'status'}
    >
      <span className="ui-alert__icon" aria-hidden="true">
        {icon ?? ALERT_ICONS[variant]}
      </span>
      <div className="ui-alert__body">
        {title && <div className="ui-alert__title">{title}</div>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className="ui-alert__dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function Badge({ variant = 'primary', dot = false, className, children }) {
  return (
    <span className={cx('badge', `badge-${variant}`, className)}>
      {dot && <span className="badge-dot" style={{ background: 'currentColor' }} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="ui-empty">
      {icon && (
        <div className="ui-empty__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      {title && <div className="ui-empty__title">{title}</div>}
      {description && <p className="ui-empty__description">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

/**
 * Live progress toward a minimum. Built for the 100-word journal gate, which
 * previously only told you the count in an alert() after you tried to submit.
 */
export function Counter({ value, min, unit = 'words' }) {
  const met = value >= min;
  return (
    <span className={cx('ui-counter', met && 'ui-counter--met')}>
      {met ? `${value} ${unit}` : `${value} / ${min} ${unit}`}
      {met && <span aria-hidden="true"> ✓</span>}
    </span>
  );
}
