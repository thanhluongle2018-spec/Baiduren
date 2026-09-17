import type { DataMode } from "@/types";

export type ApiListResponse<T> = {
  demo: true;
  source: DataMode;
  generatedAt: string;
  data: T;
};

export type ApiErrorResponse = {
  demo: true;
  error: string;
};
