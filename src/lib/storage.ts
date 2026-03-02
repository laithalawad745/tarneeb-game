// ============================================================
// استخدم sessionStorage بدل localStorage
// sessionStorage معزول لكل تاب — يحل مشكلة 4 تابات بنفس المتصفح
// ============================================================

export const storage = {
  get: (key: string): string => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(key) || '';
  },
  set: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key, value);
  },
  remove: (key: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(key);
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    sessionStorage.clear();
  },
};