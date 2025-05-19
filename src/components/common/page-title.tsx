import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  text: string;
}

export function PageTitle({ text, className, ...props }: PageTitleProps) {
  return (
    <h1
      className={cn('text-2xl font-semibold tracking-tight text-foreground', className)}
      {...props}
    >
      {text}
    </h1>
  );
}
