import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatMoneyMinor, parseMoneyMinor } from '@family-budget/types';
import { FormInput } from '../FormInput';
import type { OperationsControllerCreateV1201 } from '../../api/model';
import { amountToApiString, amountToMinor } from '../../lib/allocation';
import { MONTH_LOCKED_MESSAGE, describeMonthError } from '../../lib/apiErrors';
import { formatRubles, isNonZeroMoney, toInputMoney } from '../../lib/money';
import { formatPeriodLabel } from '../../lib/period';
import { useCreateOperation } from './useCreateOperation';
import { useUpdateOperation } from '../history/useOperationMutations';
import type { HistoryOperation } from '../history/types';
import type { QuickActionKind } from './QuickActions';
import type { Dashboard } from './types';

interface OperationFormValues {
  sourceEnvelopeId: string;
  destinationEnvelopeId: string;
  sign: '+' | '-';
  amount: string;
  comment: string;
}

const MONEY_ERROR = 'Сумма в рублях, до 2 знаков после запятой';

const TITLES: Record<QuickActionKind, string> = {
  expense: 'Списание',
  transfer: 'Перевод',
  adjustment: 'Корректировка',
};

const SAVE_LABELS: Record<QuickActionKind, string> = {
  expense: 'Сохранить списание',
  transfer: 'Сохранить перевод',
  adjustment: 'Сохранить корректировку',
};

/** Form-level checks only; amounts, balances and uncovered parts are decided by the API (OP-04..OP-07). */
function buildSchema(kind: QuickActionKind) {
  return z
    .object({
      sourceEnvelopeId: z.string().min(1, 'Выберите конверт'),
      destinationEnvelopeId: z.string(),
      sign: z.enum(['+', '-']),
      amount: z.string().refine((value) => {
        const minor = amountToMinor(value);
        return minor !== null && minor > 0 && value.trim() !== '';
      }, MONEY_ERROR),
      comment: z.string().max(500, 'Комментарий — не более 500 символов'),
    })
    .superRefine((value, ctx) => {
      if (kind !== 'transfer') return;
      if (value.destinationEnvelopeId === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationEnvelopeId'], message: 'Выберите конверт-получатель' });
      } else if (value.destinationEnvelopeId === value.sourceEnvelopeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationEnvelopeId'], message: 'Выберите другой конверт' });
      }
    });
}

interface EnvelopePickerProps {
  label: string;
  envelopes: Dashboard['envelopes'];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled: boolean;
}

/** Radio list of envelopes with their balance for the displayed month (data from the dashboard response). */
function EnvelopePicker({ label, envelopes, value, onChange, error, disabled }: EnvelopePickerProps) {
  return (
    <View className="mb-4" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {envelopes.map((envelope) => {
          const selected = envelope.envelopeId === value;
          return (
            <Pressable
              key={envelope.envelopeId}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${envelope.name}${envelope.status === 'archived' ? ' (архив)' : ''}`}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(envelope.envelopeId)}
              className={`rounded-lg border px-3 py-2 disabled:opacity-40 ${
                selected ? 'border-primary-600 bg-primary-50' : 'border-gray-300 bg-white'
              }`}
            >
              <Text className="text-sm font-medium text-gray-900">
                {envelope.name}
                {envelope.status === 'archived' ? ' (архив)' : ''}
              </Text>
              <Text className="text-xs text-gray-600">{formatRubles(envelope.closing)}</Text>
            </Pressable>
          );
        })}
      </View>
      {error !== undefined && <Text className="text-sm text-danger mt-1">{error}</Text>}
    </View>
  );
}

export interface OperationSaved {
  kind: QuickActionKind;
  /** Warnings returned by the API (OP-06 / OP-12 uncovered parts), already in Russian. */
  warnings: string[];
}

interface OperationFormProps {
  kind: QuickActionKind;
  dashboard: Dashboard;
  onSaved: (saved: OperationSaved) => void;
  onCancel: () => void;
  /** Edit mode (HIST-07): amount, envelopes and comment of this operation; the type (`kind`) stays fixed. */
  editing?: HistoryOperation;
}

/**
 * Expense / transfer / adjustment form (UI-10). Month-only (AC-21): the operation always goes to the month shown on
 * screen — `period` and that month's `version` are sent with every request (UI-16, API-21). Archived envelopes are not
 * offered for new choices (ENV-12); editing keeps the operation's own archived envelopes preselected (HIST-09). The balance shown and compared is the envelope's `closing` from the dashboard response; the
 * uncovered part is never computed here — it arrives in the API warnings after the save (OP-06, OP-12).
 * A transfer above the available balance is refused by the API (OP-07); the form then offers one click to
 * transfer the available amount (MSG-03).
 */
export function OperationForm({ kind, dashboard, onSaved, onCancel, editing }: OperationFormProps) {
  const { month, envelopes } = dashboard;
  const locked = month.status === 'closed';
  // ENV-12: archived envelopes are not offered for new choices; in edit mode the operation's own archived envelopes
  // stay visible (flagged) so they can be preselected and the operation remains editable.
  const active = envelopes.filter(
    (envelope) =>
      envelope.status === 'active' ||
      (editing !== undefined &&
        (envelope.envelopeId === editing.sourceEnvelopeId || envelope.envelopeId === editing.destinationEnvelopeId)),
  );
  const create = useCreateOperation();
  const update = useUpdateOperation();
  const pending = create.isPending || update.isPending;

  const methods = useForm<OperationFormValues>({
    resolver: zodResolver(buildSchema(kind)),
    defaultValues: editing
      ? {
          sourceEnvelopeId: editing.sourceEnvelopeId,
          destinationEnvelopeId: editing.destinationEnvelopeId ?? '',
          sign: editing.sign === '-' ? '-' : '+',
          amount: toInputMoney(formatMoneyMinor(editing.requestedMinor)),
          comment: editing.comment ?? '',
        }
      : { sourceEnvelopeId: '', destinationEnvelopeId: '', sign: '+', amount: '', comment: '' },
  });
  const { control, handleSubmit, setValue, setError, clearErrors, formState } = methods;

  const sourceId = useWatch({ control, name: 'sourceEnvelopeId' });
  const destinationId = useWatch({ control, name: 'destinationEnvelopeId' });
  const sign = useWatch({ control, name: 'sign' });
  const amount = useWatch({ control, name: 'amount' }) ?? '';
  const [exceedsOffer, setExceedsOffer] = React.useState<{ message: string; available: string | null } | null>(null);

  const source = active.find((envelope) => envelope.envelopeId === sourceId);
  const amountMinor = amountToMinor(amount);
  // Only a comparison against the balance the API returned decides whether the warning is shown (OP-06, OP-12).
  const reducesBalance = kind === 'expense' || (kind === 'adjustment' && sign === '-');
  // In edit mode the dashboard `closing` already includes this operation, so no pre-check: the API answers (OP-04..OP-07).
  const exceedsBalance =
    editing === undefined &&
    reducesBalance && source !== undefined && amountMinor !== null && amountMinor > parseMoneyMinor(source.closing);

  const send = (values: OperationFormValues, amountOverride?: string) => {
    clearErrors('root');
    setExceedsOffer(null);
    const amountString = amountOverride ?? amountToApiString(values.amount);
    const onSuccess = (response: { warnings: { message: string }[] }) =>
      onSaved({ kind, warnings: response.warnings.map((warning) => warning.message) });
    const onError = (error: unknown) => {
      const { code, message, available } = describeMonthError(error, 'Не удалось сохранить операцию');
      if (code === 'TRANSFER_EXCEEDS_BALANCE') setExceedsOffer({ message, available });
      else setError('root', { message });
    };
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          version: month.version,
          data: {
            amount: amountString,
            sourceEnvelopeId: values.sourceEnvelopeId,
            ...(kind === 'transfer' ? { destinationEnvelopeId: values.destinationEnvelopeId } : {}),
            comment: values.comment.trim(),
          },
        },
        { onSuccess, onError },
      );
      return;
    }
    create.mutate(
      {
        version: month.version,
        data: {
          type: kind,
          sourceEnvelopeId: values.sourceEnvelopeId,
          ...(kind === 'transfer' ? { destinationEnvelopeId: values.destinationEnvelopeId } : {}),
          ...(kind === 'adjustment' ? { sign: values.sign } : {}),
          amount: amountString,
          ...(values.comment.trim() !== '' ? { comment: values.comment.trim() } : {}),
          period: month.period,
        },
      },
      { onSuccess: (response: OperationsControllerCreateV1201) => onSuccess(response), onError },
    );
  };

  // MSG-03: the refusal body carries `available` (the balance at the transfer's sequence position); the dashboard
  // closing (create) or the stored result (edit, unchanged source) is only a fallback when the field is absent.
  const fallbackAvailable = editing
    ? editing.result !== null && sourceId === editing.sourceEnvelopeId
      ? formatMoneyMinor(editing.result.sourceBalanceBefore)
      : undefined
    : source?.closing;
  const availableForTransfer = exceedsOffer?.available ?? fallbackAvailable;
  const canOfferAvailable = exceedsOffer !== null && availableForTransfer !== undefined && isNonZeroMoney(availableForTransfer);
  const blocked = locked || pending;

  const onTransferAvailable = () => {
    if (availableForTransfer === undefined) return;
    setValue('amount', toInputMoney(availableForTransfer));
    void handleSubmit((values) => send(values, availableForTransfer))();
  };

  const saveLabel = editing ? 'Сохранить изменения' : exceedsBalance ? 'Всё равно сохранить' : SAVE_LABELS[kind];

  return (
    <FormProvider {...methods}>
      <View className="mt-3 rounded-lg border border-gray-200 p-3">
        <Text accessibilityRole="header" className="text-base font-semibold text-gray-800 mb-1">
          {editing ? `Изменить: ${TITLES[kind].toLowerCase()}` : TITLES[kind]}
        </Text>
        <Text className="text-sm text-gray-600 mb-3">Месяц: {formatPeriodLabel(month.period)}</Text>
        {locked && <Text className="mb-3 text-sm text-gray-700">{MONTH_LOCKED_MESSAGE}</Text>}

        {active.length === 0 ? (
          <Text className="text-gray-500 italic mb-3">Нет активных конвертов</Text>
        ) : (
          <>
            <EnvelopePicker
              label={kind === 'transfer' ? 'Откуда' : 'Конверт'}
              envelopes={active}
              value={sourceId}
              onChange={(id) => {
                setValue('sourceEnvelopeId', id, { shouldValidate: formState.isSubmitted });
                setExceedsOffer(null);
              }}
              error={formState.errors.sourceEnvelopeId?.message}
              disabled={blocked}
            />
            {kind === 'transfer' && (
              <EnvelopePicker
                label="Куда"
                envelopes={active.filter((envelope) => envelope.envelopeId !== sourceId)}
                value={destinationId}
                onChange={(id) => setValue('destinationEnvelopeId', id, { shouldValidate: formState.isSubmitted })}
                error={formState.errors.destinationEnvelopeId?.message}
                disabled={blocked}
              />
            )}
          </>
        )}

        {kind === 'adjustment' && !editing && (
          <View className="mb-4 flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel="Знак корректировки">
            {(['+', '-'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={value === '+' ? 'Увеличить' : 'Уменьшить'}
                accessibilityState={{ checked: sign === value, disabled: blocked }}
                disabled={blocked}
                onPress={() => setValue('sign', value)}
                className={`flex-1 rounded-lg border px-3 py-2 ${
                  sign === value ? 'border-primary-600 bg-primary-50' : 'border-gray-300 bg-white'
                }`}
              >
                <Text className="text-center font-medium text-gray-900">{value === '+' ? '+ Увеличить' : '− Уменьшить'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <FormInput
          label="Сумма (₽)"
          controllerProps={{ name: 'amount' }}
          placeholder="0,00"
          keyboardType="decimal-pad"
          autoCapitalize="none"
          editable={!blocked}
          accessibilityLabel="Сумма"
        />
        <FormInput
          label="Комментарий (необязательно)"
          controllerProps={{ name: 'comment' }}
          maxLength={500}
          multiline
          editable={!blocked}
          accessibilityLabel="Комментарий"
        />

        {exceedsBalance && source && (
          <View className="mb-3 rounded-lg border border-amber-600 bg-amber-50 p-3">
            <Text accessibilityRole="alert" className="text-sm text-gray-900">
              {kind === 'expense'
                ? `В конверте доступно ${formatRubles(source.closing)}. Остальная часть будет отмечена как непокрытая.`
                : `Баланс станет ${formatRubles('0.00')}, остальная часть будет отмечена как непокрытая.`}
            </Text>
          </View>
        )}

        {exceedsOffer !== null && (
          <View className="mb-3 rounded-lg border border-amber-600 bg-amber-50 p-3">
            <Text accessibilityRole="alert" className="text-sm text-gray-900">
              {exceedsOffer.message}
            </Text>
            {canOfferAvailable && availableForTransfer !== undefined && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Перевести только ${formatRubles(availableForTransfer)}`}
                disabled={blocked}
                onPress={onTransferAvailable}
                className="mt-2 rounded-lg bg-primary-600 py-2 active:bg-primary-700 disabled:opacity-50"
              >
                <Text className="text-center font-semibold text-white">
                  Перевести только {formatRubles(availableForTransfer)}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {formState.errors.root && (
          <Text accessibilityRole="alert" className="text-sm text-danger mb-3">
            {formState.errors.root.message}
          </Text>
        )}

        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            accessibilityState={{ disabled: blocked }}
            disabled={blocked}
            onPress={handleSubmit((values) => send(values))}
            className="flex-1 rounded-lg bg-primary-600 py-3 active:bg-primary-700 disabled:opacity-50"
          >
            <Text className="text-center font-semibold text-white">{pending ? 'Сохранение…' : saveLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть форму операции"
            disabled={pending}
            onPress={onCancel}
            className="flex-1 rounded-lg bg-gray-200 py-3 active:bg-gray-300"
          >
            <Text className="text-center font-semibold text-gray-700">Отмена</Text>
          </Pressable>
        </View>
      </View>
    </FormProvider>
  );
}
