
export const router = {
  route(t: string) {
    const s = (t || '').toLowerCase();
    if (/renewal|price|discount|plan|upgrade|offer|payment|subscribe/.test(s)) return 'sales_pitch';
    if (/login|otp|error|fail|issue|refund|help|bug|cannot|problem/.test(s)) return 'support_faq';
    return 'sales_pitch';
  }
} as const;
