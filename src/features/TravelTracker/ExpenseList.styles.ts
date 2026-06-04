import styled, { createGlobalStyle, keyframes } from "styled-components";

export const TravelFonts = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
`;

/* ── tokens ── */
const sand = "#f5ede0";
const terracotta = "#c4714a";
const deep = "#1a1410";
const warmBrown = "#6b4226";
const sage = "#8a9e7e";
const gold = "#d4a853";
const cream = "#fdf6ec";
const muted = "#9c8b79";

/* ── PAGE SHELL ── */
export const StyledPage = styled.div`
  font-family: 'DM Sans', sans-serif;
  background-color: ${sand};
  color: ${deep};
  min-height: 100vh;
`;

/* ── HEADER ── */
export const StyledPageHeader = styled.header`
  background: ${deep};
  padding: 32px 20px 24px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(196,113,74,0.3) 0%, transparent 70%);
    pointer-events: none;
  }

  @media (min-width: 640px) {
    padding: 48px 40px 36px;
  }
`;

export const StyledHeaderInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  position: relative;
`;

export const StyledHeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
`;

export const StyledTitleGroup = styled.div`
  h1 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(28px, 7vw, 52px);
    color: ${cream};
    line-height: 1;
    letter-spacing: -1px;
    margin: 0;
    em {
      font-style: italic;
      color: ${gold};
    }
  }
  p {
    color: ${muted};
    font-size: 13px;
    font-weight: 300;
    margin-top: 8px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
`;

export const StyledHeaderActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  align-self: flex-start;
`;

export const StyledStatsRow = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: center;

  @media (min-width: 640px) {
    gap: 32px;
  }
`;

export const StyledStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const StyledStatLabel = styled.span`
  font-size: 11px;
  color: ${muted};
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 500;
`;

export const StyledStatValue = styled.span<{ $accent?: boolean }>`
  font-size: 20px;
  font-weight: 500;
  color: ${(p) => (p.$accent ? gold : cream)};
  letter-spacing: -0.5px;

  @media (min-width: 640px) {
    font-size: 22px;
  }
`;

export const StyledStatDivider = styled.div`
  width: 1px;
  background: rgba(255,255,255,0.1);
  align-self: stretch;
`;

/* ── FILTERS ── */
export const StyledFiltersSection = styled.section`
  background: ${cream};
  border-bottom: 1px solid rgba(0,0,0,0.06);
  padding: 14px 20px;
  position: sticky;
  top: 0;
  z-index: 1;

  @media (min-width: 640px) {
    padding: 20px 40px;
  }
`;

export const StyledFiltersInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const StyledTripFilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

export const StyledTripSelectWrap = styled.div`
  position: relative;
  min-width: min(100%, 360px);
  max-width: 100%;
  border-radius: 14px;
  background: linear-gradient(145deg, #fffdf9 0%, #f8eee2 100%);
  border: 1px solid rgba(107,66,38,0.14);
  box-shadow: 0 8px 22px rgba(26,20,16,0.08);
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  &:hover {
    border-color: rgba(107,66,38,0.28);
    box-shadow: 0 12px 26px rgba(26,20,16,0.12);
    transform: translateY(-1px);
  }

  &:focus-within {
    border-color: ${terracotta};
    box-shadow: 0 0 0 3px rgba(196,113,74,0.2), 0 14px 28px rgba(26,20,16,0.12);
    transform: translateY(-1px);
  }

  &::after {
    content: "";
    position: absolute;
    right: 16px;
    top: calc(50% - 8px);
    width: 8px;
    height: 8px;
    border-right: 2px solid ${warmBrown};
    border-bottom: 2px solid ${warmBrown};
    transform: rotate(45deg);
    pointer-events: none;
  }

  @media (max-width: 640px) {
    min-width: 100%;
  }
`;

export const StyledTripSelect = styled.select`
  width: 100%;
  appearance: none;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: ${deep};
  padding: 12px 40px 12px 14px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.1px;
  cursor: pointer;
  text-wrap: pretty;

  option {
    font-weight: 500;
    color: ${deep};
    background: #fffdfa;
  }

  &:hover {
    color: ${warmBrown};
  }

  &:focus {
    outline: none;
    color: ${deep};
  }
`;

export const StyledFilterLabel = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: ${muted};
  font-weight: 500;
  min-width: 50px;
`;

export const StyledChip = styled.button<{ $active: boolean; $person?: boolean }>`
  padding: 6px 16px;
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid ${(p) => (p.$active ? (p.$person ? terracotta : deep) : "rgba(0,0,0,0.12)")};
  background: ${(p) => (p.$active ? (p.$person ? terracotta : deep) : "transparent")};
  color: ${(p) => (p.$active ? "white" : warmBrown)};
  cursor: pointer;
  transition: all 0.18s;
  font-family: 'DM Sans', sans-serif;

  &:hover {
    border-color: ${(p) => (p.$person ? terracotta : deep)};
    color: ${(p) => (p.$active ? "white" : (p.$person ? terracotta : deep))};
  }

  &:active {
    transform: scale(0.97);
  }
`;

/* ── MAIN CONTENT ── */
export const StyledMain = styled.main`
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px;

  @media (min-width: 640px) {
    padding: 40px;
  }
`;

/* ── TOTALS BAR ── */
export const StyledTotalsBar = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: ${deep};
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 24px;

  @media (min-width: 640px) {
    display: flex;
  }
`;

export const StyledTotalCard = styled.div`
  padding: 16px 18px;
  border-right: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);

  &:nth-child(2n) {
    border-right: none;
  }

  @media (min-width: 640px) {
    flex: 1;
    padding: 20px 24px;
    border-bottom: none;
    &:nth-child(2n) {
      border-right: 1px solid rgba(255,255,255,0.06);
    }
    &:last-child {
      border-right: none;
    }
  }
`;

export const StyledTotalCardLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: ${muted};
  margin-bottom: 6px;
  font-weight: 500;
`;

export const StyledTotalCardValue = styled.div<{ $color?: string }>`
  font-size: 20px;
  font-weight: 500;
  color: ${(p) => p.$color ?? "white"};
  line-height: 1.2;

  @media (min-width: 640px) {
    font-size: 24px;
  }
`;

export const StyledTotalCardSubValue = styled.div`
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${muted};
  opacity: 0.95;

  @media (min-width: 640px) {
    font-size: 13px;
  }
`;

const totalValueShimmer = keyframes`
  0% {
    background-position: -180px 0;
  }
  100% {
    background-position: 180px 0;
  }
`;

export const StyledTotalValueSkeleton = styled.span<{ $width?: string }>`
  display: inline-block;
  width: ${(p) => p.$width ?? "92px"};
  height: 20px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(255,255,255,0.14) 20%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.14) 80%);
  background-size: 300px 100%;
  animation: ${totalValueShimmer} 1.1s linear infinite;

  @media (min-width: 640px) {
    height: 24px;
  }
`;

/* ── TABLE ── */
export const StyledTableWrap = styled.div`
  display: none;

  @media (min-width: 768px) {
    display: block;
    background: white;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 2px 20px rgba(0,0,0,0.06);
  }
`;

export const StyledExpenseTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const StyledTableHeader = styled.th`
  padding: 16px 20px;
  background: ${deep};
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 500;
  color: ${muted};
`;

export const StyledTableRow = styled.tr`
  border-bottom: 1px solid rgba(0,0,0,0.05);
  transition: background 0.15s;

  &:hover {
    background: ${sand};
  }

  &:last-child {
    border-bottom: none;
  }
`;

export const StyledTableCell = styled.td`
  padding: 15px 20px;
  font-size: 14px;
  color: ${deep};
  font-weight: 400;

  &.date {
    font-size: 12px;
    color: ${muted};
    font-weight: 500;
    white-space: nowrap;
  }

  &.desc {
    font-weight: 500;
  }

  &.responsible {
    font-size: 13px;
    font-weight: 500;
  }

  &.amount {
    font-weight: 500;
    font-size: 15px;
  }

  &.pesos {
    color: ${muted};
    font-size: 13px;
  }

  &.usd {
    color: ${warmBrown};
    font-weight: 500;
  }
`;

export const StyledAvatarBadge = styled.span<{ $name: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: white;
  margin-right: 8px;
  background: ${(p) => (p.$name.toLowerCase().startsWith("j") ? terracotta : sage)};
  vertical-align: middle;
`;

/* ── CARD LIST (mobile) ── */
export const StyledCardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 0;

  @media (min-width: 768px) {
    display: none;
  }
`;

export const StyledExpenseCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
`;

export const StyledCardRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const StyledCardLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${muted};
`;

export const StyledCardValue = styled.span`
  font-size: 0.93rem;
  font-weight: 500;
  color: ${deep};

  &.accent { color: ${terracotta}; font-weight: 600; }
  &.usd { color: ${warmBrown}; }
  &.muted { color: ${muted}; }
`;

/* ── BACK / SYNC BUTTONS ── */
export const StyledBackButton = styled.button`
  padding: 10px 20px;
  border-radius: 50px;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  color: ${cream};
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;

  &:hover {
    border-color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.06);
  }

  &:active { transform: scale(0.97); }
`;

export const StyledSyncButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 50px;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  color: ${cream};
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;

  &:hover {
    border-color: ${gold};
    color: ${gold};
  }

  &:active { transform: scale(0.97); }
`;

/* ── MESSAGE ── */
export const StyledMessage = styled.div`
  padding: 48px 20px;
  text-align: center;
  color: ${muted};
  font-size: 15px;
`;

/* ── PAGINATION ── */
export const StyledPaginationContainer = styled.div`
  margin-top: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
`;

export const StyledPaginationButton = styled.button<{ disabled: boolean }>`
  padding: 9px 20px;
  border-radius: 50px;
  border: 1.5px solid ${(p) => (p.disabled ? "rgba(0,0,0,0.1)" : warmBrown)};
  background: ${(p) => (p.disabled ? "transparent" : warmBrown)};
  color: ${(p) => (p.disabled ? muted : "white")};
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  transition: all 0.18s;

  &:hover {
    background: ${(p) => (p.disabled ? "transparent" : "#5a3520")};
  }

  &:active {
    transform: ${(p) => (p.disabled ? "none" : "scale(0.97)")};
  }
`;

export const StyledPaginationInfo = styled.span`
  color: ${muted};
  font-size: 13px;
  font-weight: 500;
`;

const toastIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

export const StyledSuccessPopup = styled.div<{ $isError?: boolean }>`
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10000;
  background: ${(p) => (p.$isError ? "linear-gradient(145deg, #fff2ee, #fde9e2)" : "linear-gradient(145deg, #edf8f1, #e4f4ea)")};
  color: ${(p) => (p.$isError ? "#9b2f18" : "#1f6b3b")};
  border: 1px solid ${(p) => (p.$isError ? "rgba(155, 47, 24, 0.35)" : "rgba(44, 140, 82, 0.35)")};
  box-shadow: ${(p) => (p.$isError ? "0 14px 36px rgba(155, 47, 24, 0.18)" : "0 14px 36px rgba(31, 107, 59, 0.22)")};
  border-radius: 14px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  animation: ${toastIn} 220ms ease-out;

  @media (max-width: 640px) {
    right: 14px;
    left: 14px;
    bottom: 14px;
    text-align: center;
  }
`;

/* ── Confirm modal ── */
const backdropIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const modalIn = keyframes`
  from { opacity: 0; transform: translateY(18px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

export const StyledConfirmBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${backdropIn} 180ms ease-out;
`;

export const StyledConfirmBox = styled.div`
  background: #fffdf8;
  border-radius: 18px;
  padding: 32px 28px 24px;
  max-width: 400px;
  width: calc(100% - 48px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  animation: ${modalIn} 220ms cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const StyledConfirmTitle = styled.p`
  font-size: 15px;
  font-weight: 600;
  color: #2e2c28;
  line-height: 1.5;
  margin: 0;
`;

export const StyledConfirmButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

export const StyledConfirmCancelBtn = styled.button`
  padding: 9px 18px;
  border-radius: 10px;
  border: 1.5px solid rgba(0,0,0,0.14);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #555;
  cursor: pointer;
  transition: background 140ms;
  &:hover { background: #f3f0ea; }
`;

export const StyledConfirmOkBtn = styled.button`
  padding: 9px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(145deg, #e05a2b, #c94a1a);
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: filter 140ms;
  &:hover { filter: brightness(1.07); }
`;

/* ── kept for compatibility (AddExpenseModal may use these) ── */
export const StyledContainer = StyledPage;
export const StyledHeader = StyledTitleGroup;
export const StyledButtonContainer = StyledHeaderActions;
export const StyledSummary = StyledTotalsBar;
export const StyledSummaryItem = StyledTotalCardLabel;
export const StyledSummaryValue = StyledTotalCardValue;
export const StyledTripFilterButton = StyledChip;
