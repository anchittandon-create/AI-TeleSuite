# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Part 3

## **Part 3: UI Components**

This section lists all standard ShadCN UI components used in the application. As these components are generated from the ShadCN CLI and are not custom-built, their full code is not included here. Instead, this list serves as a manifest to confirm their presence in the `/src/components/ui/` directory.

The application's `components.json` file configures the path aliases and other settings for these components.

---

### **3.1. List of ShadCN UI Components**

The following components MUST be present in the `/src/components/ui/` directory. They can be added to a new project using the ShadCN CLI: `npx shadcn-ui@latest add [component-name]`.

*   `accordion.tsx`
*   `alert-dialog.tsx`
*   `alert.tsx`
*   `avatar.tsx`
*   `badge.tsx`
*   `button.tsx`
*   `calendar.tsx`
*   `card.tsx`
*   `checkbox.tsx`
*   `command.tsx`
*   `dialog.tsx`
*   `dropdown-menu.tsx`
*   `form.tsx`
*   `input.tsx`
*   `label.tsx`
*   `menubar.tsx`
*   `popover.tsx`
*   `progress.tsx`
*   `radio-group.tsx`
*   `scroll-area.tsx`
*   `select.tsx`
*   `separator.tsx`
*   `sheet.tsx`
*   `skeleton.tsx`
*   `slider.tsx`
*   `switch.tsx`
*   `table.tsx`
*   `tabs.tsx`
*   `textarea.tsx`
*   `toast.tsx`
*   `toaster.tsx`
*   `tooltip.tsx`
*   `sidebar.tsx` (Custom component, but often included in ShadCN setups)

---

### **3.2. Custom Common Components**

The following are simple, custom-built components located under `/src/components/common/`.

---

#### **File: `src/components/common/loading-spinner.tsx`**
**Purpose:** A reusable loading spinner component.

```tsx
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 24, className }: LoadingSpinnerProps) {
  return (
    <Loader2
      style={{ width: size, height: size }}
      className={cn('animate-spin text-primary', className)}
    />
  );
}
```

---

#### **File: `src/components/common/page-title.tsx`**
**Purpose:** A standardized component for rendering page titles.

```tsx
"use client"

import { cn } from "@/lib/utils"

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  text: string
}

export function PageTitle({ text, className, ...props }: PageTitleProps) {
  return (
    <h1
      className={cn(
        "text-lg font-semibold md:text-xl text-foreground",
        className
      )}
      {...props}
    >
      {text}
    </h1>
  )
}
```

---

This concludes Part 3.
