import { format, isValid } from 'date-fns';

export const DATE_TIME_FORMAT = 'dd.MM.yyyy HH:mm';
export const DATE_TIME_PICKER_FORMAT = "yyyy-MM-dd'T'HH:mm";

export const formatDate = (
  value?: Date | string | null,
  dateFormat: string = DATE_TIME_FORMAT,
): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (!isValid(date)) throw new Error('formatDate: Invalid Date provided');
  return format(date, dateFormat);
};
