/**
 * Minimal types for Vercel serverless handlers.
 * Replaces @vercel/node to avoid transitive dependency vulnerabilities.
 */

export interface VercelRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[]>;
}

export interface VercelResponse {
  setHeader(name: string, value: string | number | readonly string[]): this;
  status(code: number): this;
  json(body: unknown): this;
  end(): this;
}
