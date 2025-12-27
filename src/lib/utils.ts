import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strips markdown and HTML from text, returning plain text
 */
export function stripMarkdownAndHtml(text: string): string {
  if (!text) return "";
  
  let cleaned = text;
  
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  
  // Remove markdown headers (# ## ### etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  
  // Remove markdown bold (**text** or __text__)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
  
  // Remove markdown italic (*text* or _text_)
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");
  
  // Remove markdown links [text](url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  
  // Remove markdown images ![alt](url)
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1");
  
  // Remove markdown code blocks ```code```
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  
  // Remove markdown inline code `code`
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  
  // Remove markdown lists (- * +)
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "");
  
  // Remove markdown numbered lists
  cleaned = cleaned.replace(/^\d+\.\s+/gm, "");
  
  // Remove markdown blockquotes (>)
  cleaned = cleaned.replace(/^>\s+/gm, "");
  
  // Remove markdown horizontal rules (--- or ***)
  cleaned = cleaned.replace(/^[-*]{3,}$/gm, "");
  
  // Remove markdown strikethrough (~~text~~)
  cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1");
  
  // Decode HTML entities
  const textarea = document.createElement("textarea");
  textarea.innerHTML = cleaned;
  cleaned = textarea.value;
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n/g, "\n");
  cleaned = cleaned.trim();
  
  return cleaned;
}
