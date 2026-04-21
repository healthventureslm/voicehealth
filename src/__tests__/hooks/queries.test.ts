import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a chainable mock that resolves at the end of any chain
function chainable(resolvedValue: unknown): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "then") {
        return Promise.resolve(resolvedValue).then.bind(Promise.resolve(resolvedValue));
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

let selectResults: unknown[] = [];
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => {
    const val = selectResults.shift() ?? { data: null, count: 0, error: null };
    return chainable(val);
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

// Mock QueryClient wrapper
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
  });

  it("fetches and returns patient/consultation counts", async () => {
    selectResults = [
      { count: 42, data: null, error: null },   // patients
      { count: 100, data: null, error: null },   // consultations
      { count: 5, data: null, error: null },     // today
    ];

    const { useDashboardStats } = await import("@/hooks/queries/useDashboardStats");

    const { result } = renderHook(() => useDashboardStats(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      patients: 42,
      consultations: 100,
      todayConsultations: 5,
    });
  });

  it("does not fetch when enabled=false", async () => {
    const { useDashboardStats } = await import("@/hooks/queries/useDashboardStats");

    const { result } = renderHook(() => useDashboardStats(false), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("useSpecialties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
  });

  it("fetches active specialties ordered by name", async () => {
    const mockSpecialties = [
      { id: "1", name: "Cardiologia", is_active: true },
      { id: "2", name: "Neurologia", is_active: true },
    ];

    selectResults = [{ data: mockSpecialties, error: null }];

    const { useSpecialties } = await import("@/hooks/queries/useSpecialties");

    const { result } = renderHook(() => useSpecialties(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSpecialties);
    expect(mockFrom).toHaveBeenCalledWith("medical_specialties");
  });
});
