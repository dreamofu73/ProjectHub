/**
 * Minimal REST API client for the ProjectHub backend.
 *
 * Only the endpoints the seeder needs are exercised. Every ID is treated as a
 * string (Sonyflake IDs exceed JavaScript number precision).
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: { id: string; login: string; role: string };
}

export class ApiClient {
  private readonly token: string;

  constructor(
    private readonly baseUrl: string,
    token: string,
  ) {
    this.token = token;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<any> {
    const isForm = body instanceof FormData;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined && !isForm
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        body === undefined
          ? undefined
          : isForm
            ? body
            : typeof body === 'string'
              ? body
              : JSON.stringify(body),
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, init);
    } catch (err) {
      throw new Error(`${method} ${path} — 네트워크 오류: ${String(err)}`);
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // non-JSON response body
    }

    if (!res.ok || (json && json.success === false)) {
      throw new ApiError(
        res.status,
        `${method} ${path} 실패 (${res.status}): ${JSON.stringify(json)}`,
        json,
      );
    }
    return json;
  }

  get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  post(path: string, body?: unknown): Promise<any> {
    return this.request('POST', path, body);
  }

  put(path: string, body?: unknown): Promise<any> {
    return this.request('PUT', path, body);
  }

  delete(path: string): Promise<any> {
    return this.request('DELETE', path);
  }

  upload(path: string, form: FormData): Promise<any> {
    return this.request('POST', path, form);
  }

  /**
   * Normalize list responses into a plain array. Endpoints return
   * `{success, data}` where `data` may be an array, `{items: []}`,
   * `{data: []}`, or a single object.
   */
  async getList(path: string): Promise<any[]> {
    const json = await this.get(path);
    const data = json?.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && typeof data === 'object') return [data];
    return [];
  }
}

export async function login(
  baseUrl: string,
  loginName: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginName, password }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json.token) {
    throw new ApiError(res.status, `'${loginName}' 로그인 실패`, json);
  }
  return json as LoginResponse;
}
