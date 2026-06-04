import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../../lib/api";

interface Trip {
  id: number;
  destiny: string;
  dolarRealExchange: number;
  dolarPesosExchange: number;
  startDate: string | Date;
  endDate: string | Date;
  paidBy: string;
  year: number;
  month: string;
}

interface Expense {
  id: number;
  type: string;
  amount: number;
  dollarAmount: number;
  date: string;
  category: string;
  travelId: string;
  tripDescription: string;
  exchange: string;
  responsible: string;
}

interface ExpenseApiItem {
  id?: number;
  type?: string;
  amount?: number | string;
  dollarAmount?: number | string;
  date?: string;
  category?: string;
  travelId?: string | number;
  travelid?: string | number;
  tripDescription?: string;
  travelDescription?: string;
  exchange?: string;
  responsible?: string;
}

interface PaginationParams {
  totalPages: number;
  totalExpenses: number;
  totalCount: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ExpenseTotals {
  dollarTotal: number;
  localCurrencyAmount: number;
  dollarPaid: number;
  pesosPaid: number;
  realesPaid: number;
  perPersonUsd: Record<string, { usdTotal: number; pesosTotal: number; expenseCount: number }>;
}

export const useTripsAndExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [pagination, setPagination] = useState<PaginationParams>({
    totalPages: 0,
    totalExpenses: 0,
    totalCount: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [allExpensesTotals, setAllExpensesTotals] = useState<ExpenseTotals>({
    dollarTotal: 0,
    localCurrencyAmount: 0,
    dollarPaid: 0,
    pesosPaid: 0,
    realesPaid: 0,
    perPersonUsd: {},
  });

  useEffect(() => {
    loadTrips();
    loadExpenses(1);
  }, []);

  useEffect(() => {
    loadExpenses(1);
  }, [selectedTrip]);

  const loadTrips = async () => {
    try {
      const response = await fetch(
        apiUrl("/api/trips?page=1"),
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTrips(data.data.trips || []);
    } catch (error) {
      console.error("❌ Error loading trips:", error);
      setTrips([]);
    }
  };

  const loadExpenses = useCallback(async (currentPage: number, responsible?: string | null) => {
    try {
      setLoading(true);
      // Clear previous page data so stale totals are not rendered while loading.
      setExpenses([]);
      setAllExpensesTotals({
        dollarTotal: 0,
        localCurrencyAmount: 0,
        dollarPaid: 0,
        pesosPaid: 0,
        realesPaid: 0,
        perPersonUsd: {},
      });
      const responsibleQuery = responsible ? `&responsible=${encodeURIComponent(responsible)}` : "";
      const url = selectedTrip
        ? apiUrl(`/api/expenses?page=${currentPage}&limit=50&travelId=${selectedTrip.id}${responsibleQuery}`)
        : apiUrl(`/api/expenses`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const normalizedExpenses: Expense[] = (data.data.expenses || []).map((item: ExpenseApiItem) => ({
        id: Number(item.id || 0),
        type: String(item.type || ""),
        amount: Number(item.amount || 0),
        dollarAmount: Number(item.dollarAmount || 0),
        date: String(item.date || ""),
        category: String(item.category || ""),
        travelId: String(item.travelId ?? item.travelid ?? ""),
        tripDescription: String(item.tripDescription ?? item.travelDescription ?? ""),
        exchange: String(item.exchange || ""),
        responsible: String(item.responsible || ""),
      }));

      setExpenses(normalizedExpenses);
      
      setAllExpensesTotals({
        dollarTotal: Number(data.data?.totals?.dollarTotal || 0),
        localCurrencyAmount: Number(data.data?.totals?.localCurrencyAmount || 0),
        dollarPaid: Number(data.data?.totals?.dollarPaid || 0),
        pesosPaid: Number(data.data?.totals?.pesosPaid || 0),
        realesPaid: Number(data.data?.totals?.realesPaid || 0),
        perPersonUsd: Object.fromEntries(
          Object.entries(data.data?.totals?.perPersonUsd || {}).map(([name, raw]) => {
            const normalized = (raw || {}) as { usdTotal?: number | string; pesosTotal?: number | string; expenseCount?: number | string };
            return [name, {
              usdTotal: Number(normalized.usdTotal || 0),
              pesosTotal: Number(normalized.pesosTotal || 0),
              expenseCount: Number(normalized.expenseCount || 0),
            }];
          }),
        ),
      });

      if (data.data.pagination) {
        setPagination(data.data.pagination);
      } else {
        setPagination({
          totalPages: 1,
          totalExpenses: normalizedExpenses.length,
          totalCount: normalizedExpenses.length,
          currentPage: 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
    } catch (error) {
      console.error("❌ Error loading expenses:", error);
      setExpenses([]);
      setAllExpensesTotals({
        dollarTotal: 0,
        localCurrencyAmount: 0,
        dollarPaid: 0,
        pesosPaid: 0,
        realesPaid: 0,
        perPersonUsd: {},
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTrip]);

  const handleAddExpense = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    loadExpenses(1);
  };

  return {
    expenses,
    trips,
    loading,
    selectedTrip,
    setSelectedTrip,
    pagination,
    loadExpenses,
    handleAddExpense,
    allExpensesTotals,
  };
};