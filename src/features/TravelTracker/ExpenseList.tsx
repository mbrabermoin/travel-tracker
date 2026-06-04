"use client";

import React from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AddExpenseModal from "./components/AddExpenseModal";
import TripsGallery from "./components/TripsGallery";
import { useTripsAndExpenses } from "./useTripsAndExpenses";
import { apiUrl } from "../../lib/api";
import {
  TravelFonts,
  StyledPage,
  StyledPageHeader,
  StyledHeaderInner,
  StyledHeaderTop,
  StyledTitleGroup,
  StyledHeaderActions,
  StyledStatsRow,
  StyledStat,
  StyledStatLabel,
  StyledStatValue,
  StyledStatDivider,
  StyledFiltersSection,
  StyledFiltersInner,
  StyledTripFilterContainer,
  StyledTripSelectWrap,
  StyledTripSelect,
  StyledFilterLabel,
  StyledChip,
  StyledMain,
  StyledTotalsBar,
  StyledTotalCard,
  StyledTotalCardLabel,
  StyledTotalCardValue,
  StyledTotalCardSubValue,
  StyledTotalValueSkeleton,
  StyledTableWrap,
  StyledExpenseTable,
  StyledTableHeader,
  StyledTableRow,
  StyledTableCell,
  StyledAvatarBadge,
  StyledCardList,
  StyledExpenseCard,
  StyledCardRow,
  StyledCardLabel,
  StyledCardValue,
  StyledBackButton,
  StyledSyncButton,
  StyledMessage,
  StyledPaginationContainer,
  StyledPaginationButton,
  StyledPaginationInfo,
  StyledSuccessPopup,
  StyledConfirmBackdrop,
  StyledConfirmBox,
  StyledConfirmTitle,
  StyledConfirmButtons,
  StyledConfirmCancelBtn,
  StyledConfirmOkBtn,
} from "./ExpenseList.styles";

const ExpenseList: React.FC = () => {
  const LazyExpenseStatsSummary = React.useMemo(
    () => dynamic(() => import("./components/ExpenseStatsSummary"), {
      loading: () => null,
    }),
    [],
  );

  const router = useRouter();
  const {
    expenses,
    trips,
    loading,
    selectedTrip,
    setSelectedTrip,
    pagination,
    loadExpenses,
    allExpensesTotals,
  } = useTripsAndExpenses();

  const { currentPage, hasNextPage, hasPrevPage, totalExpenses, totalCount } = pagination;
  const [selectedResponsible, setSelectedResponsible] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; isError: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const isViewingAllTrips = selectedTrip === null;

  React.useEffect(() => {
    if (!isViewingAllTrips) {
      loadExpenses(1, selectedResponsible);
    }
  }, [selectedResponsible, isViewingAllTrips, selectedTrip?.id]);

  // Reset responsible filter when trip changes
  React.useEffect(() => {
    setSelectedResponsible(null);
  }, [selectedTrip?.id]);

  const showToast = React.useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    window.setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  const dolarPesosExchange = selectedTrip?.dolarPesosExchange ?? 1;
  const dolarRealExchange = selectedTrip?.dolarRealExchange ?? 1;
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const formatAmount = (value: number) => round2(value).toFixed(2);

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(new Date(date));
  };

  const formatTripDate = (date?: string | Date) => {
    if (!date) return "-";
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-AR", { timeZone: "UTC" });
  };

  const formatTripMonthYear = (trip: {
    startDate?: string | Date;
    month?: string;
    year?: number;
  }) => {
    if (trip.startDate) {
      const d = trip.startDate instanceof Date ? trip.startDate : new Date(trip.startDate);
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("es-AR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(d);
      }
    }

    if (trip.month && trip.year) {
      return `${trip.month} ${trip.year}`;
    }

    if (trip.year) {
      return String(trip.year);
    }

    return "";
  };

  const formatTripFilterLabel = (trip: {
    destiny: string;
    startDate?: string | Date;
    month?: string;
    year?: number;
  }) => {
    const monthYear = formatTripMonthYear(trip);
    return monthYear ? `${trip.destiny} - ${monthYear}` : trip.destiny;
  };

  const normalizeExchange = (v: string) =>
    v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const getExchange = (exchange: string) => {
    const n = normalizeExchange(exchange);
    if (n.startsWith("pes") || n.startsWith("ars")) return "$";
    if (n.startsWith("dol") || n.startsWith("usd")) return "U$D";
    if (n.startsWith("rea") || n.startsWith("brl")) return "R$";
    return "-";
  };

  const getLocalCurrencyAmount = (amount: number, exchange: string) => {
    const n = normalizeExchange(exchange);
    return round2(
      n.startsWith("dol") || n.startsWith("usd") ? amount * dolarPesosExchange
      : n.startsWith("rea") || n.startsWith("brl") ? (amount / dolarRealExchange) * dolarPesosExchange
      : amount,
    );
  };

  const getDollarAmount = (amount: number, exchange: string) => {
    const n = normalizeExchange(exchange);
    return round2(
      n.startsWith("pes") || n.startsWith("ars") ? amount / dolarPesosExchange
      : n.startsWith("rea") || n.startsWith("brl") ? amount / dolarRealExchange
      : amount,
    );
  };

  const totals = allExpensesTotals;

  const responsibles = Array.from(
    new Set([...Object.keys(totals.perPersonUsd || {}), ...expenses.map((e) => e.responsible)].filter(Boolean)),
  ).sort();

  const expensesWithTotals = expenses.map((expense) => ({
    ...expense,
    displayExchange: getExchange(expense.exchange),
    localCurrencyAmount: getLocalCurrencyAmount(expense.amount, expense.exchange),
    dollarAmount:
      Number.isFinite(expense.dollarAmount) && expense.dollarAmount > 0
        ? expense.dollarAmount
        : getDollarAmount(expense.amount, expense.exchange),
  }));

  const personEntries = Object.entries(totals.perPersonUsd || {});

  const doSync = async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/sync-sheets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showToast("Error: " + (data.message || "No se pudo importar desde Sheet"), true);
        return;
      }

      showToast("BD actualizada desde Google Sheet.");
      await loadExpenses(1, selectedResponsible);
    } catch {
      showToast("Cannot connect with server. Please try again later.", true);
    }
  };

  const handleSyncClick = () => setConfirmOpen(true);

  const handleExpenseAddedWithSyncRefresh = () => {
    loadExpenses(1, selectedResponsible);
  };

  const renderCards = () => {
    return (
      <StyledCardList>
        {expensesWithTotals.map((expense) => (
          <StyledExpenseCard key={expense.id}>
            <StyledCardRow>
              <StyledCardLabel>Fecha</StyledCardLabel>
              <StyledCardValue className="accent">{formatDate(expense.date)}</StyledCardValue>
            </StyledCardRow>
            <StyledCardRow>
              <StyledCardLabel>Pagó</StyledCardLabel>
              <StyledCardValue>{expense.responsible}</StyledCardValue>
            </StyledCardRow>
            <StyledCardRow style={{ gridColumn: "1 / -1" }}>
              <StyledCardLabel>Descripción</StyledCardLabel>
              <StyledCardValue>{expense.type}</StyledCardValue>
            </StyledCardRow>
            <StyledCardRow>
              <StyledCardLabel>Monto</StyledCardLabel>
              <StyledCardValue>{expense.displayExchange} {formatAmount(expense.amount)}</StyledCardValue>
            </StyledCardRow>
            <StyledCardRow>
              <StyledCardLabel>Pesos</StyledCardLabel>
              <StyledCardValue className="muted">$ {formatAmount(expense.localCurrencyAmount)}</StyledCardValue>
            </StyledCardRow>
            <StyledCardRow>
              <StyledCardLabel>USD</StyledCardLabel>
              <StyledCardValue className="usd">U$D {formatAmount(expense.dollarAmount)}</StyledCardValue>
            </StyledCardRow>
          </StyledExpenseCard>
        ))}
      </StyledCardList>
    );
  };

  const renderTable = () => {
    if (loading) return <tbody><tr><td colSpan={6}><StyledMessage>Cargando gastos...</StyledMessage></td></tr></tbody>;
    if (expensesWithTotals.length === 0) return <tbody><tr><td colSpan={6}><StyledMessage>✈️ No hay gastos para mostrar.</StyledMessage></td></tr></tbody>;

    return (
      <tbody>
        {expensesWithTotals.map((expense) => (
          <StyledTableRow key={expense.id}>
            <StyledTableCell className="date">{formatDate(expense.date)}</StyledTableCell>
            <StyledTableCell className="desc">{expense.type}</StyledTableCell>
            <StyledTableCell className="responsible">
              <StyledAvatarBadge $name={expense.responsible ?? ""}>
                {expense.responsible?.[0]?.toUpperCase() ?? "?"}
              </StyledAvatarBadge>
              {expense.responsible}
            </StyledTableCell>
            <StyledTableCell className="amount">{expense.displayExchange} {formatAmount(expense.amount)}</StyledTableCell>
            <StyledTableCell className="pesos">$ {formatAmount(expense.localCurrencyAmount)}</StyledTableCell>
            <StyledTableCell className="usd">U$D {formatAmount(expense.dollarAmount)}</StyledTableCell>
          </StyledTableRow>
        ))}
      </tbody>
    );
  };

  return (
    <StyledPage>
      <TravelFonts />

      {toast && <StyledSuccessPopup $isError={toast.isError}>{toast.message}</StyledSuccessPopup>}
      {confirmOpen && (
        <StyledConfirmBackdrop onClick={() => setConfirmOpen(false)}>
          <StyledConfirmBox onClick={(e) => e.stopPropagation()}>
            <StyledConfirmTitle>
              Esto va a reemplazar la BD con los datos actuales del Google Sheet. ¿Continuar?
            </StyledConfirmTitle>
            <StyledConfirmButtons>
              <StyledConfirmCancelBtn onClick={() => setConfirmOpen(false)}>
                Cancelar
              </StyledConfirmCancelBtn>
              <StyledConfirmOkBtn
                onClick={() => {
                  setConfirmOpen(false);
                  doSync();
                }}
              >
                Confirmar
              </StyledConfirmOkBtn>
            </StyledConfirmButtons>
          </StyledConfirmBox>
        </StyledConfirmBackdrop>
      )}
      
      {/* ── HEADER ── */}
      <StyledPageHeader>
        <StyledHeaderInner>
          <StyledHeaderTop>
            <StyledTitleGroup>
              <h1>{isViewingAllTrips ? "Nuestros" : "Gastos de"} <em>viaje{isViewingAllTrips ? "s" : ""}</em></h1>
              <p>JULI & MATI - TRACKER PERSONAL 🛫</p>
              {selectedTrip && (
                <p>
                  {selectedTrip.destiny} · {formatTripDate(selectedTrip.startDate)} – {formatTripDate(selectedTrip.endDate)}
                </p>
              )}
            </StyledTitleGroup>
            <StyledHeaderActions>
              <StyledBackButton onClick={() => router.push("/")}>← Volver</StyledBackButton>
              <StyledSyncButton onClick={handleSyncClick}>⟳ Importar desde Sheet</StyledSyncButton>
              <AddExpenseModal
                onAddExpense={handleExpenseAddedWithSyncRefresh}
                trips={trips.map((trip) => ({ id: trip.id, destiny: trip.destiny }))}
                selectedTripId={selectedTrip?.id ?? null}
              />
            </StyledHeaderActions>
          </StyledHeaderTop>

          {!isViewingAllTrips && (
            <LazyExpenseStatsSummary
              totalExpenses={totalCount || totalExpenses}
              dollarTotal={totals.dollarTotal}
              localCurrencyAmount={totals.localCurrencyAmount}
              showDollarRate={Boolean(selectedTrip)}
              dolarPesosExchange={selectedTrip?.dolarPesosExchange ?? 1}
              formatAmount={formatAmount}
              loading={loading}
            />
          )}
          {isViewingAllTrips && (
            <StyledStatsRow>
              <StyledStat>
                <StyledStatLabel>Viajes</StyledStatLabel>
                <StyledStatValue>{trips.length}</StyledStatValue>
              </StyledStat>
            </StyledStatsRow>
          )}
        </StyledHeaderInner>
      </StyledPageHeader>

      {/* ── FILTERS ── */}
      <StyledFiltersSection>
        <StyledFiltersInner>
          <StyledTripFilterContainer>
            <StyledFilterLabel>Viaje</StyledFilterLabel>
            <StyledTripSelectWrap>
              <StyledTripSelect
                aria-label="Seleccionar viaje"
                value={selectedTrip ? String(selectedTrip.id) : "all"}
                onChange={(event) => {
                  const selectedId = event.target.value;
                  if (selectedId === "all") {
                    setSelectedTrip(null);
                    return;
                  }

                  const trip = trips.find((item) => String(item.id) === selectedId) ?? null;
                  setSelectedTrip(trip);
                }}
              >
                <option value="all">Todos los viajes</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={String(trip.id)}>
                    {formatTripFilterLabel(trip)}
                  </option>
                ))}
              </StyledTripSelect>
            </StyledTripSelectWrap>
          </StyledTripFilterContainer>

          {!isViewingAllTrips && (
            <StyledTripFilterContainer>
              <StyledFilterLabel>Pagó</StyledFilterLabel>
              <StyledChip $active={selectedResponsible === null} $person onClick={() => setSelectedResponsible(null)}>
                Todos
              </StyledChip>
              {responsibles.map((r) => (
                <StyledChip key={r} $active={selectedResponsible === r} $person onClick={() => setSelectedResponsible(r)}>
                  {r}
                </StyledChip>
              ))}
            </StyledTripFilterContainer>
          )}
        </StyledFiltersInner>
      </StyledFiltersSection>

      {/* ── MAIN ── */}
      <StyledMain>
        {isViewingAllTrips ? (
          <TripsGallery trips={trips} expenses={expenses} onSelectTrip={setSelectedTrip} />
        ) : (
          <>
          {/* Totals bar */}
          <StyledTotalsBar>
            <StyledTotalCard>
              <StyledTotalCardLabel>Gastos en USD</StyledTotalCardLabel>
              <StyledTotalCardValue $color="#d4a853">
                {loading ? <StyledTotalValueSkeleton $width="108px" /> : <>U$D {formatAmount(totals.dollarTotal)}</>}
              </StyledTotalCardValue>
              <StyledTotalCardSubValue>
                    $ {formatAmount(totals.pesosPaid)}
              </StyledTotalCardSubValue>
            </StyledTotalCard>

            {loading ? (
              <StyledTotalCard>
                <StyledTotalCardLabel>Pagó</StyledTotalCardLabel>
                <StyledTotalCardValue>
                  <StyledTotalValueSkeleton $width="92px" />
                </StyledTotalCardValue>
              </StyledTotalCard>
            ) : (
              personEntries.map(([name, data]) => (
                <StyledTotalCard key={name}>
                  <StyledTotalCardLabel>{name} pagó ({data.expenseCount})</StyledTotalCardLabel>
                  <StyledTotalCardValue $color={name.toLowerCase().startsWith("j") ? "#c4714a" : "#8a9e7e"}>
                    U$D {formatAmount(data.usdTotal)}
                  </StyledTotalCardValue>
                  <StyledTotalCardSubValue>
                    $ {formatAmount(data.pesosTotal)}
                  </StyledTotalCardSubValue>
                </StyledTotalCard>
              ))
            )}
          </StyledTotalsBar>

        {/* Cards (mobile) */}
        {renderCards()}

        {/* Table (desktop) */}
        <StyledTableWrap>
          <StyledExpenseTable>
            <thead>
              <tr>
                <StyledTableHeader>Fecha</StyledTableHeader>
                <StyledTableHeader>Descripción</StyledTableHeader>
                <StyledTableHeader>Pagado por</StyledTableHeader>
                <StyledTableHeader>Monto</StyledTableHeader>
                <StyledTableHeader>Pesos</StyledTableHeader>
                <StyledTableHeader>USD</StyledTableHeader>
              </tr>
            </thead>
            {renderTable()}
          </StyledExpenseTable>
        </StyledTableWrap>

        {/* Pagination */}
        <StyledPaginationContainer>
          <StyledPaginationButton disabled={!hasPrevPage} onClick={() => loadExpenses(currentPage - 1, selectedResponsible)}>
            ← Anterior
          </StyledPaginationButton>
          <StyledPaginationInfo>Mostrando {expenses.length} gastos</StyledPaginationInfo>
          <StyledPaginationButton disabled={!hasNextPage} onClick={() => loadExpenses(currentPage + 1, selectedResponsible)}>
            Siguiente →
          </StyledPaginationButton>
        </StyledPaginationContainer>
          </>
        )}
      </StyledMain>
    </StyledPage>
  );
};

export default ExpenseList;
