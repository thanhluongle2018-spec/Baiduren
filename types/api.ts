import type { DataMode } from "@/types";

export type DataPayload<T> = {
  demo: boolean;
  source: DataMode;
  generatedAt: string;
  data: T;
};

export type ApiListResponse<T> = DataPayload<T>;

export type ApiErrorResponse = {
  demo: boolean;
  error: string;
};
