import * as React from "react"

import { cn } from "@/lib/utils"

const MULTILINE_PROMPT_PLACEHOLDERS = new Set([
  "Ex: Moto premium em rua neon noturna",
  "Descreva o contexto do vídeo...",
  "Ex: fumaça saindo dos pneus e luzes refletindo na lataria",
])

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const placeholder = typeof props.placeholder === "string" ? props.placeholder : ""
    const normalizedPlaceholder = placeholder.toLocaleLowerCase("pt-BR")
    const isCreativeVideoPrompt =
      normalizedPlaceholder.includes("vídeo") || normalizedPlaceholder.includes("video")
    const isMultilinePrompt =
      MULTILINE_PROMPT_PLACEHOLDERS.has(placeholder) || isCreativeVideoPrompt

    if (isMultilinePrompt) {
      const textareaProps = props as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>

      return (
        <textarea
          rows={4}
          className={cn(
            "flex min-h-[112px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={ref as unknown as React.ForwardedRef<HTMLTextAreaElement>}
          {...textareaProps}
        />
      )
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
