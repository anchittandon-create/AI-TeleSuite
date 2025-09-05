
export const router = {
  route(t: string) {
    const s = (t || '').toLowerCase();
    if (/renewal|price|discount|plan/.test(s)) return 'sales_pitch';
    if (/login|otp|error|help/.test(s)) return 'support_faq';
    return 'sales_pitch';
  }
} as const;
