import { useQuery } from "@tanstack/react-query";
import { erpApi, type ListParams } from "../api/erp";
import { shouldUseMockData, mockEmployees } from "../api/mock";

export const useEmployees = (params: ListParams = {}) => {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: async () => {
      if (shouldUseMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return mockEmployees;
      }
      return erpApi.listEmployees(params);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useEmployee = (name: string) => {
  return useQuery({
    queryKey: ["employee", name],
    queryFn: () => erpApi.getEmployee(name),
    enabled: !!name,
    staleTime: 10 * 60 * 1000,
  });
};
