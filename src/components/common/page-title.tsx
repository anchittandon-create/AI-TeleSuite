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
