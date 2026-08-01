type ClientRouter = {
  back: () => void;
  replace: (href: string) => void;
};

const parentKey = (route: string) => `void_route_parent:${route}`;
const scrollKey = (url: string) => `void_scroll:${url}`;

export const rememberRouteParent = (route: string) => {
  sessionStorage.setItem(parentKey(route), `${location.pathname}${location.search}`);
};

export const clearRouteParent = (route: string) => {
  sessionStorage.removeItem(parentKey(route));
};

export const backOrHome = (router: ClientRouter, route: string) => {
  const parent = sessionStorage.getItem(parentKey(route));
  clearRouteParent(route);
  if (parent) router.back();
  else router.replace('/');
};

export const rememberScrollPosition = (url: string, top: number) => {
  sessionStorage.setItem(scrollKey(url), String(Math.max(0, top)));
};

export const restoreScrollPosition = (url: string) => {
  const key = scrollKey(url);
  const value = sessionStorage.getItem(key);
  if (value === null) return null;
  sessionStorage.removeItem(key);
  const top = Number(value);
  return Number.isFinite(top) ? top : null;
};
