import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@org/ui';
import { FEDERATION_NAME } from '@/core/constants/app';
import type { CreateItemResult } from '../../hooks/useCreateItem';
import type { Item, ItemDraft, ItemFieldErrors } from '../../types/item';
import { validateItemDraft } from '../../utils/validation';
import styles from './AddItemForm.module.scss';

const FIELD_IDS = {
  name: `${FEDERATION_NAME}-item-name`,
  uen: `${FEDERATION_NAME}-item-uen`,
} as const;
/** Order of the fields in the error summary. */
const FIELD_ORDER = ['name', 'uen'] as const;

/**
 * The form pattern of docs/coding-conventions.md: validate on submit, then an error summary
 * (focused, links to the fields) plus an error next to each field; server 422 errors land in
 * the same places; while sending, the submit button shows `loading` (it keeps focus).
 * Fields and messages come from @org/ui (TextField wires label, error and aria-* itself).
 *
 * It sends nothing itself: `onCreate` comes from the page (`useCreateItem()`), the form keeps
 * only its own UI state (field value, errors, "sending").
 */
export function AddItemForm({
  onCreate,
  onCreated,
}: {
  onCreate: (draft: ItemDraft) => Promise<CreateItemResult>;
  onCreated: (item: Item) => void;
}) {
  const [name, setName] = useState('');
  const [uen, setUen] = useState('');
  const [errors, setErrors] = useState<ItemFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const uenRef = useRef<HTMLInputElement>(null);
  const refs = { name: nameRef, uen: uenRef };

  // move focus to the summary after each failed submit
  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  const showErrors = (next: ItemFieldErrors) => {
    setErrors(next);
    setFailedSubmits((n) => n + 1);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setFormError('');
    const draft = { name: name.trim(), uen: uen.trim() };
    const clientErrors = validateItemDraft(draft);
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors);
      return;
    }
    setErrors({});
    setSending(true);
    const result = await onCreate(draft);
    setSending(false);
    if (result.ok) {
      onCreated(result.item);
      setName('');
      setUen('');
      setStatus(`Added “${result.item.name}”.`);
    } else if (result.fieldErrors) {
      showErrors(result.fieldErrors);
    } else {
      setFormError(result.message);
    }
  }

  const fieldErrors = FIELD_ORDER.filter((field) => errors[field]);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-labelledby="demo-add-item-title"
    >
      <h3 id="demo-add-item-title" className={styles.formTitle}>
        Add an item
      </h3>
      {fieldErrors.length > 0 ? (
        <Alert
          ref={summaryRef}
          variant="error"
          title="There is a problem"
          headingLevel={4}
          className={styles.errorSummary}
          tabIndex={-1}
          data-testid="error-summary"
        >
          <ul>
            {fieldErrors.map((field) => (
              <li key={field}>
                <a
                  href={`#${FIELD_IDS[field]}`}
                  onClick={(event) => {
                    event.preventDefault();
                    refs[field].current?.focus();
                  }}
                >
                  {errors[field]}
                </a>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <TextField
        ref={nameRef}
        id={FIELD_IDS.name}
        label="Name"
        name="name"
        className={styles.field}
        value={name}
        autoComplete="off"
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        ref={uenRef}
        id={FIELD_IDS.uen}
        label="UEN"
        hint="Unique Entity Number of the business, for example 201912345K"
        required
        name="uen"
        className={styles.field}
        value={uen}
        autoComplete="off"
        autoCapitalize="characters"
        error={errors.uen}
        onChange={(event) => setUen(event.target.value)}
      />
      <div className={styles.row}>
        <Button type="submit" loading={sending}>
          {sending ? 'Adding…' : 'Add item'}
        </Button>
        <p className={styles.copy} role="status">
          {status}
        </p>
      </div>
    </form>
  );
}
