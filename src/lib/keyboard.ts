export type DetailsKeyboardAction = 'watchlist' | 'watched';

type ClickableControl = {
  click(): void;
  disabled?: boolean;
};

type QueryRoot = {
  querySelector(selector: string): ClickableControl | null;
};

export const getDetailsKeyboardAction = (key: string): DetailsKeyboardAction | null => {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'w') return 'watchlist';
  if (normalizedKey === 'e') return 'watched';
  return null;
};

export const triggerDetailsAction = (
  action: DetailsKeyboardAction,
  root: QueryRoot = document,
): boolean => {
  const control = root.querySelector(`[data-details-action="${action}"]`);
  if (!control || control.disabled) return false;

  control.click();
  return true;
};
