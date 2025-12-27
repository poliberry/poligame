export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const handleError = (error: unknown, context?: string): string => {
  console.error(`Error${context ? ` in ${context}` : ""}:`, error);
  
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === "string") {
    return error;
  }
  
  return "An unexpected error occurred";
};

export const showError = (error: unknown, context?: string) => {
  const message = handleError(error, context);
  // In a real implementation, this could show a toast notification
  console.error(message);
  alert(message);
};

