import { NextResponse } from "next/server";
import { Pool } from "pg";

const parseIdAllowlist = (rawValue?: string) =>
  new Set(
    (rawValue ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

type SessionStep =
  | "awaiting_amount"
  | "awaiting_description"
  | "awaiting_paid_by"
  | "awaiting_paid_by_custom"
  | "awaiting_payment_method"
  | "awaiting_date"
  | "awaiting_currency"
  | "awaiting_trip"
  | "awaiting_confirmation";

type ExpenseSessionData = {
  amount?: number;
  description?: string;
  paidBy?: string;
  paymentMethod?: "efectivo" | "tarjeta";
  exchange?: "Pesos" | "Real" | "Dólar";
  date?: string;
  travelId?: string;
  travelDescription?: string;
};

type TelegramInlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

type SaveExpenseInput = {
  description: string;
  amount: number;
  paidBy: string;
  paymentMethod?: string | null;
  exchange: string;
  date: string;
  travelId: string;
  travelDescription?: string;
  notes?: string | null;
};

async function sendTelegramApi(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return null;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error(`[Telegram] ${method} failed:`, err);
    return null;
  });

  if (!response) {
    return null;
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    console.error(`[Telegram] ${method} returned ${response.status}:`, raw.slice(0, 300));
    return null;
  }

  return response;
}

async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup,
) {
  await sendTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await sendTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

async function ensureTelegramSessionTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_expense_sessions (
      chat_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      step VARCHAR(64) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chat_id, user_id)
    );
  `);
}

async function getExpenseSession(pool: Pool, chatId: string, userId: string) {
  const result = await pool.query(
    `SELECT step, data
     FROM telegram_expense_sessions
     WHERE chat_id = $1 AND user_id = $2`,
    [chatId, userId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0] as { step: SessionStep; data: ExpenseSessionData | null };
  return {
    step: row.step,
    data: row.data ?? {},
  };
}

async function saveExpenseSession(
  pool: Pool,
  chatId: string,
  userId: string,
  step: SessionStep,
  data: ExpenseSessionData,
) {
  await pool.query(
    `INSERT INTO telegram_expense_sessions (chat_id, user_id, step, data, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     ON CONFLICT (chat_id, user_id)
     DO UPDATE SET step = EXCLUDED.step, data = EXCLUDED.data, updated_at = NOW()`,
    [chatId, userId, step, JSON.stringify(data ?? {})],
  );
}

async function clearExpenseSession(pool: Pool, chatId: string, userId: string) {
  await pool.query(
    `DELETE FROM telegram_expense_sessions WHERE chat_id = $1 AND user_id = $2`,
    [chatId, userId],
  );
}

function getConfiguredAppsScriptUrl() {
  const candidates = [
    "GOOGLE_APPS_SCRIPT_URL",
    "APPS_SCRIPT_URL",
    "GAS_WEBAPP_URL",
  ] as const;

  for (const key of candidates) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return { url: value.trim(), envKey: key };
    }
  }

  return { url: null, envKey: null };
}

function isSheetsSyncEnabled() {
  const raw = String(process.env.SHEETS_SYNC_ENABLED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off" && raw !== "no";
}

async function syncExpenseToGoogleSheet(payload: {
  date: string;
  description: string;
  exchange: string;
  amount: number;
  paidBy: string;
  paymentMethod?: string | null;
  travelId?: string;
  travelDescription?: string;
  sheetName?: string;
  sheetId?: string;
  notes?: string | null;
}) {
  if (!isSheetsSyncEnabled()) {
    return {
      ok: true,
      skipped: true,
      message: "Sincronización con Sheets desactivada por configuración",
    };
  }

  const { url } = getConfiguredAppsScriptUrl();
  if (!url) {
    return {
      ok: false,
      skipped: false,
      message: "GOOGLE_APPS_SCRIPT_URL no configurada",
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        message: `Apps Script HTTP ${response.status}${text ? `: ${String(text).slice(0, 180)}` : ""}`,
      };
    }

    if (json && typeof json === "object" && "error" in json && (json as { error?: string }).error) {
      return {
        ok: false,
        skipped: false,
        message: (json as { error: string }).error,
      };
    }

    return { ok: true, skipped: false, message: "OK" };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

async function ensureExpenseSyncQueueTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.expense_sheet_sync_queue (
      expense_id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_expense_sheet_sync_queue_status_next_retry
    ON public.expense_sheet_sync_queue (status, next_retry_at);
  `);
}

async function enqueueExpenseSheetSync(pool: Pool, expenseId: number, payload: Record<string, unknown>, lastError: string) {
  await ensureExpenseSyncQueueTable(pool);
  await pool.query(
    `INSERT INTO public.expense_sheet_sync_queue (expense_id, payload, status, retries, last_error, next_retry_at, updated_at)
     VALUES ($1, $2::jsonb, 'pending', 1, $3, NOW() + INTERVAL '2 minutes', NOW())
     ON CONFLICT (expense_id)
     DO UPDATE SET
       payload = EXCLUDED.payload,
       status = 'pending',
       retries = expense_sheet_sync_queue.retries + 1,
       last_error = EXCLUDED.last_error,
       next_retry_at = NOW() + ((LEAST(60, POWER(2, expense_sheet_sync_queue.retries + 1)))::text || ' minutes')::interval,
       updated_at = NOW()`,
    [expenseId, JSON.stringify(payload), lastError || "sync failed"],
  );
}

const HELP_TEXT = `<b>Comandos disponibles:</b>

<b>/nuevo</b>
Carga guiada paso a paso con botones.

<b>Flujo:</b> viaje → monto → moneda → descripción → quién pagó → método de pago → fecha → confirmar

<b>/gastos</b> — elegís un viaje y te muestra el listado de gastos
<b>/viajes</b> — lista los viajes disponibles
<b>/cancel</b> — cancela una carga guiada activa
<b>/ayuda</b> — muestra este mensaje`;

function normalizeExchange(raw: string) {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (value === "usd" || value === "dolar" || value === "dolares") {
    return "Dólar" as const;
  }
  if (value === "real" || value === "reales") {
    return "Real" as const;
  }
  if (value === "peso" || value === "pesos") {
    return "Pesos" as const;
  }
  return null;
}

function currencyKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Pesos", callback_data: "exp_currency:pesos" },
        { text: "Reales", callback_data: "exp_currency:reales" },
      ],
      [{ text: "Dolares", callback_data: "exp_currency:dolares" }],
      [{ text: "Cancelar", callback_data: "exp_confirm:cancel" }],
    ],
  };
}

function paidByKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Mati", callback_data: "exp_paid_by:mati" },
        { text: "Juli", callback_data: "exp_paid_by:juli" },
      ],
      [{ text: "Otros", callback_data: "exp_paid_by:otros" }],
      [{ text: "Cancelar", callback_data: "exp_confirm:cancel" }],
    ],
  };
}

function paymentMethodKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Efectivo", callback_data: "exp_payment:efectivo" },
        { text: "Tarjeta", callback_data: "exp_payment:tarjeta" },
      ],
      [{ text: "Cancelar", callback_data: "exp_confirm:cancel" }],
    ],
  };
}

async function tripKeyboard(pool: Pool): Promise<TelegramInlineKeyboardMarkup | null> {
  const result = await pool.query(
    `SELECT id, destiny FROM public.trips ORDER BY id ASC`,
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rows = result.rows as Array<{ id: number; destiny: string }>;
  return {
    inline_keyboard: [
      ...rows.map((trip) => [{ text: `${trip.id} - ${trip.destiny}`, callback_data: `exp_trip:${trip.id}` }]),
      [{ text: "Cancelar", callback_data: "exp_confirm:cancel" }],
    ],
  };
}

async function expensesTripKeyboard(pool: Pool): Promise<TelegramInlineKeyboardMarkup | null> {
  const result = await pool.query(
    `SELECT id, destiny FROM public.trips ORDER BY id ASC`,
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rows = result.rows as Array<{ id: number; destiny: string }>;
  return {
    inline_keyboard: rows.map((trip) => [{ text: `${trip.id} - ${trip.destiny}`, callback_data: `exp_list_trip:${trip.id}` }]),
  };
}

function confirmationKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Guardar", callback_data: "exp_confirm:save" },
        { text: "Cancelar", callback_data: "exp_confirm:cancel" },
      ],
    ],
  };
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatExpenseDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseExpenseDateInput(value: string) {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const lowered = raw.toLowerCase();
  const now = new Date();

  if (lowered === "hoy") {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  }

  if (lowered === "ayer") {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1)).toISOString().slice(0, 10);
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number.parseInt(slashMatch[1], 10);
    const month = Number.parseInt(slashMatch[2], 10);
    const year = Number.parseInt(slashMatch[3], 10);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day
    ) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day
    ) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

function formatDateForSheet(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const parsed = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatExpenseAmount(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "0.00";
  }
  return amount.toFixed(2);
}

async function sendExpensesByTrip(pool: Pool, chatId: number | string, travelId: string) {
  const tripResult = await pool.query(
    `SELECT id, destiny FROM public.trips WHERE id = $1`,
    [travelId],
  );

  if (tripResult.rowCount === 0) {
    await sendTelegramMessage(chatId, `❌ No existe el viaje con ID ${travelId}.`);
    return;
  }

  const tripName = String(tripResult.rows[0].destiny);
  const expensesResult = await pool.query(
    `SELECT id, type, amount, responsible, paymentmethod, exchange, date
     FROM public.expenses
     WHERE travelid = $1
     ORDER BY date DESC, id DESC
     LIMIT 20`,
    [travelId],
  );

  if (expensesResult.rowCount === 0) {
    await sendTelegramMessage(chatId, `No hay gastos cargados para <b>${escapeHtml(tripName)}</b>.`);
    return;
  }

  const totals = await pool.query(
    `SELECT exchange, COALESCE(SUM(amount), 0) AS total
     FROM public.expenses
     WHERE travelid = $1
     GROUP BY exchange`,
    [travelId],
  );

  const totalLines = (totals.rows as Array<{ exchange: string; total: string | number }>).map(
    (row) => `• ${formatExpenseAmount(row.total)} ${escapeHtml(String(row.exchange).toUpperCase())}`,
  );

  const expenseLines = (expensesResult.rows as Array<{
    id: number;
    type: string;
    amount: string | number;
    responsible: string | null;
    paymentmethod: string | null;
    exchange: string | null;
    date: string | Date | null;
  }>).map((expense) => {
    const date = formatExpenseDate(expense.date);
    const description = escapeHtml(expense.type);
    const amount = formatExpenseAmount(expense.amount);
    const exchange = escapeHtml(String(expense.exchange ?? "").toUpperCase() || "-");
    const paidBy = escapeHtml(expense.responsible || "Sin responsable");
    const paymentMethod = escapeHtml(expense.paymentmethod || "Sin método");
    return `• ${date} | ${description} | ${amount} ${exchange} | ${paidBy} | ${paymentMethod}`;
  });

  const message = [
    `<b>Gastos de ${escapeHtml(tripName)}</b>`,
    "",
    ...expenseLines,
    "",
    "<b>Totales por moneda</b>",
    ...(totalLines.length > 0 ? totalLines : ["• 0.00"]),
  ].join("\n");

  await sendTelegramMessage(chatId, message);
}

async function saveExpenseAndSync(pool: Pool, input: SaveExpenseInput) {
  const tripCheck = await pool.query(
    `SELECT id, destiny, sheettab FROM public.trips WHERE id = $1`,
    [input.travelId],
  );

  if (tripCheck.rowCount === 0) {
    throw new Error(`No existe el viaje con ID ${input.travelId}`);
  }

  const tripName: string = tripCheck.rows[0].destiny;
  const sheetTab: string | null = (tripCheck.rows[0] as any).sheettab ?? null;
  const normalizedExchange = normalizeExchange(input.exchange);
  if (!normalizedExchange) {
    throw new Error(`Moneda inválida: ${input.exchange}`);
  }

  const result = await pool.query(
    `INSERT INTO public.expenses (type, amount, responsible, paymentMethod, exchange, travelId, travelDescription, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.description.trim(),
      input.amount,
      input.paidBy.trim(),
      input.paymentMethod ? input.paymentMethod.trim() : null,
      normalizedExchange,
      input.travelId,
      tripName,
      input.date,
    ],
  );

  const expenseId = Number(result.rows[0].id);

  const targetSheetName = sheetTab || input.travelDescription || tripName;
  const sheetPayload = {
    date: formatDateForSheet(input.date),
    description: input.description.trim(),
    exchange: normalizedExchange,
    amount: input.amount,
    paidBy: input.paidBy.trim(),
    paymentMethod: input.paymentMethod ? input.paymentMethod.trim() : null,
    travelId: String(input.travelId),
    travelDescription: input.travelDescription || tripName,
    sheetName: targetSheetName,
    sheetId: String(input.travelId),
    notes: input.notes ?? `Cargado por Telegram (${tripName})`,
  };

  const sheetSync = await syncExpenseToGoogleSheet(sheetPayload);
  if (!sheetSync.ok) {
    await enqueueExpenseSheetSync(pool, expenseId, sheetPayload, sheetSync.message);
  }

  return {
    expenseId,
    tripName,
    exchange: normalizedExchange,
    sheetSync,
  };
}

async function sendExpenseConfirmation(chatId: string, data: ExpenseSessionData) {
  await sendTelegramMessage(
    chatId,
    `<b>Confirmá el gasto:</b>\n\n📝 ${data.description}\n💰 ${Number(data.amount ?? 0).toFixed(2)} ${data.exchange}\n👤 ${data.paidBy}\n💳 ${data.paymentMethod}\n📅 ${formatExpenseDate(data.date)}\n✈️ ${data.travelDescription}`,
    confirmationKeyboard(),
  );
}

async function startWizard(pool: Pool, chatId: string, userId: string) {
  await saveExpenseSession(pool, chatId, userId, "awaiting_trip", {});
  const keyboard = await tripKeyboard(pool);
  if (!keyboard) {
    await sendTelegramMessage(chatId, "No hay viajes disponibles para asociar el gasto.");
    return;
  }

  await sendTelegramMessage(chatId, "Perfecto, empecemos. Elegí el viaje:", keyboard);
}

async function handleWizardTextStep(
  pool: Pool,
  chatId: string,
  userId: string,
  fromName: string,
  rawText: string,
) {
  const session = await getExpenseSession(pool, chatId, userId);
  if (!session) {
    return false;
  }

  const text = rawText.trim();
  if (!text) {
    await sendTelegramMessage(chatId, "Necesito un valor válido para continuar.");
    return true;
  }

  if (session.step === "awaiting_amount") {
    const amount = Number.parseFloat(text.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, "Monto inválido. Probá con un número positivo, por ejemplo: 2500.75");
      return true;
    }

    await saveExpenseSession(pool, chatId, userId, "awaiting_currency", {
      ...session.data,
      amount,
    });
    await sendTelegramMessage(chatId, "En que moneda?", currencyKeyboard());
    return true;
  }

  if (session.step === "awaiting_description") {
    await saveExpenseSession(pool, chatId, userId, "awaiting_paid_by", {
      ...session.data,
      description: text,
    });
    await sendTelegramMessage(chatId, "Quién pagó?", paidByKeyboard());
    return true;
  }

  if (session.step === "awaiting_paid_by_custom") {
    await saveExpenseSession(pool, chatId, userId, "awaiting_payment_method", {
      ...session.data,
      paidBy: text,
    });
    await sendTelegramMessage(chatId, "Como pagó?", paymentMethodKeyboard());
    return true;
  }

  if (session.step === "awaiting_date") {
    const parsedDate = parseExpenseDateInput(text);
    if (!parsedDate) {
      await sendTelegramMessage(chatId, "Fecha inválida. Probá con hoy, ayer, DD/MM/AAAA o AAAA-MM-DD.");
      return true;
    }

    const nextData = {
      ...session.data,
      date: parsedDate,
    };
    await saveExpenseSession(pool, chatId, userId, "awaiting_confirmation", nextData);
    await sendExpenseConfirmation(chatId, nextData);
    return true;
  }

  if (
    session.step === "awaiting_paid_by"
    || session.step === "awaiting_payment_method"
    || session.step === "awaiting_currency"
    || session.step === "awaiting_trip"
    || session.step === "awaiting_confirmation"
  ) {
    await sendTelegramMessage(chatId, "Para este paso usá los botones del mensaje anterior.");
    return true;
  }

  return false;
}

async function handleWizardCallback(
  pool: Pool,
  callbackQueryId: string,
  chatId: string,
  userId: string,
  callbackData: string,
) {
  if (callbackData.startsWith("exp_list_trip:")) {
    const travelId = (callbackData.split(":")[1] ?? "").trim();
    if (!travelId) {
      await answerCallbackQuery(callbackQueryId, "Viaje inválido");
      return;
    }

    await answerCallbackQuery(callbackQueryId, "Cargando gastos");
    await sendExpensesByTrip(pool, chatId, travelId);
    return;
  }

  const session = await getExpenseSession(pool, chatId, userId);
  if (!session) {
    await answerCallbackQuery(callbackQueryId, "No hay una carga activa. Escribí /nuevo");
    return;
  }

  if (callbackData === "exp_confirm:cancel") {
    await clearExpenseSession(pool, chatId, userId);
    await answerCallbackQuery(callbackQueryId, "Carga cancelada");
    await sendTelegramMessage(chatId, "Carga cancelada. Cuando quieras volver a empezar: /nuevo");
    return;
  }

  if (callbackData.startsWith("exp_currency:")) {
    if (session.step !== "awaiting_currency") {
      await answerCallbackQuery(callbackQueryId, "Ese paso ya pasó o todavía no corresponde");
      return;
    }

    const selected = callbackData.split(":")[1] ?? "";
    const exchange = normalizeExchange(selected);
    if (!exchange) {
      await answerCallbackQuery(callbackQueryId, "Moneda inválida");
      return;
    }

    const nextData = {
      ...session.data,
      exchange,
    };
    await saveExpenseSession(pool, chatId, userId, "awaiting_description", nextData);
    await answerCallbackQuery(callbackQueryId, "Moneda guardada");
    await sendTelegramMessage(chatId, "Que se pagó?");
    return;
  }

  if (callbackData.startsWith("exp_payment:")) {
    if (session.step !== "awaiting_payment_method") {
      await answerCallbackQuery(callbackQueryId, "Ese paso ya pasó o todavía no corresponde");
      return;
    }

    const selected = (callbackData.split(":")[1] ?? "").trim().toLowerCase();
    const paymentMethod: ExpenseSessionData["paymentMethod"] =
      selected === "efectivo" || selected === "tarjeta" ? selected : undefined;
    if (!paymentMethod) {
      await answerCallbackQuery(callbackQueryId, "Método inválido");
      return;
    }

    const nextData = {
      ...session.data,
      paymentMethod,
    };
    await saveExpenseSession(pool, chatId, userId, "awaiting_date", nextData);
    await answerCallbackQuery(callbackQueryId, "Método guardado");
    await sendTelegramMessage(chatId, "Qué fecha le pongo? Podés escribir hoy, ayer, DD/MM/AAAA o AAAA-MM-DD.");
    return;
  }

  if (callbackData.startsWith("exp_paid_by:")) {
    if (session.step !== "awaiting_paid_by") {
      await answerCallbackQuery(callbackQueryId, "Ese paso ya pasó o todavía no corresponde");
      return;
    }

    const selected = (callbackData.split(":")[1] ?? "").trim().toLowerCase();
    if (selected === "otros") {
      await saveExpenseSession(pool, chatId, userId, "awaiting_paid_by_custom", {
        ...session.data,
      });
      await answerCallbackQuery(callbackQueryId, "Perfecto");
      await sendTelegramMessage(chatId, "Escribí quién pagó (nombre libre).");
      return;
    }

    const mappedPaidBy = selected === "mati" ? "Mati" : selected === "juli" ? "Juli" : null;
    if (!mappedPaidBy) {
      await answerCallbackQuery(callbackQueryId, "Opción inválida");
      return;
    }

    await saveExpenseSession(pool, chatId, userId, "awaiting_payment_method", {
      ...session.data,
      paidBy: mappedPaidBy,
    });
    await answerCallbackQuery(callbackQueryId, "Quién pagó guardado");
    await sendTelegramMessage(chatId, "Como se pagó?", paymentMethodKeyboard());
    return;
  }

  if (callbackData.startsWith("exp_trip:")) {
    if (session.step !== "awaiting_trip") {
      await answerCallbackQuery(callbackQueryId, "Ese paso ya pasó o todavía no corresponde");
      return;
    }

    const travelId = (callbackData.split(":")[1] ?? "").trim();
    if (!travelId) {
      await answerCallbackQuery(callbackQueryId, "Viaje inválido");
      return;
    }

    const check = await pool.query(`SELECT id, destiny FROM public.trips WHERE id = $1`, [travelId]);
    if (check.rowCount === 0) {
      await answerCallbackQuery(callbackQueryId, "Ese viaje no existe");
      return;
    }

    const tripName: string = check.rows[0].destiny;
    const nextData = {
      ...session.data,
      travelId,
      travelDescription: tripName,
    };

    await saveExpenseSession(pool, chatId, userId, "awaiting_amount", nextData);
    await answerCallbackQuery(callbackQueryId, "Viaje guardado");
    await sendTelegramMessage(chatId, "Cuanto se gastó? (ej: 1500 o 1500.50)");
    return;
  }

  if (callbackData === "exp_confirm:save") {
    if (session.step !== "awaiting_confirmation") {
      await answerCallbackQuery(callbackQueryId, "No hay nada para confirmar");
      return;
    }

    const data = session.data;
    if (!data.amount || !data.description || !data.paidBy || !data.paymentMethod || !data.exchange || !data.travelId || !data.date) {
      await answerCallbackQuery(callbackQueryId, "Faltan datos en la sesión");
      await sendTelegramMessage(chatId, "No pude confirmar porque faltan datos. Escribí /nuevo para reiniciar.");
      await clearExpenseSession(pool, chatId, userId);
      return;
    }

    const saved = await saveExpenseAndSync(pool, {
      description: data.description,
      amount: Number(data.amount),
      paidBy: data.paidBy,
      paymentMethod: data.paymentMethod,
      exchange: data.exchange,
      date: data.date,
      travelId: data.travelId,
      travelDescription: data.travelDescription,
    });

    await clearExpenseSession(pool, chatId, userId);
    await answerCallbackQuery(callbackQueryId, "Gasto guardado");

    const syncLine = saved.sheetSync.ok
      ? "📄 Sync Sheet: OK"
      : `⚠️ Sync Sheet falló: ${saved.sheetSync.message}`;

    await sendTelegramMessage(
      chatId,
      `✅ <b>Gasto agregado</b> (#${saved.expenseId})\n\n📝 ${data.description}\n💰 ${Number(data.amount).toFixed(2)} ${saved.exchange}\n👤 ${data.paidBy}\n💳 ${data.paymentMethod}\n📅 ${formatExpenseDate(data.date)}\n✈️ ${saved.tripName}\n${syncLine}`,
    );
    return;
  }

  await answerCallbackQuery(callbackQueryId, "Acción no reconocida");
}

async function handleViajesCommand(pool: Pool, chatId: number | string) {
  const trips = await pool.query(
    `SELECT id, destiny FROM public.trips ORDER BY id ASC`,
  );
  if (trips.rowCount === 0) {
    await sendTelegramMessage(chatId, "No hay viajes registrados.");
    return;
  }
  const lines = trips.rows.map((r: { id: number; destiny: string }) => `• <code>${r.id}</code> — ${r.destiny}`).join("\n");
  await sendTelegramMessage(chatId, `<b>Viajes disponibles:</b>\n\n${lines}`);
}

export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");

    if (secret && incomingSecret !== secret) {
      console.warn("[Telegram] Invalid webhook secret");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const callbackQuery = body.callback_query;
    const payloadMessage = body.message ?? body.edited_message ?? body.channel_post;

    const text = payloadMessage?.text;
    const fromName = payloadMessage?.from?.first_name ?? callbackQuery?.from?.first_name ?? "Unknown";
    const fromId = payloadMessage?.from?.id ?? callbackQuery?.from?.id;
    const chatId = payloadMessage?.chat?.id ?? callbackQuery?.message?.chat?.id;

    const allowedUserIds = parseIdAllowlist(process.env.TELEGRAM_ALLOWED_USER_IDS);
    const allowedChatIds = parseIdAllowlist(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
    const hasUserAllowlist = allowedUserIds.size > 0;
    const hasChatAllowlist = allowedChatIds.size > 0;

    const userAllowed = !hasUserAllowlist || allowedUserIds.has(String(fromId));
    const chatAllowed = !hasChatAllowlist || allowedChatIds.has(String(chatId));

    if (!userAllowed || !chatAllowed) {
      console.log("[Telegram] Update ignored by allowlist", {
        fromId,
        chatId,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    console.log("--- ¡Mensaje Recibido de Telegram! ---");
    console.log("Meta:", { updateId: body.update_id, fromId, chatId, fromName });
    console.log(`Mati, ${fromName} escribió: ${text ?? "(sin texto)"}`);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      await ensureTelegramSessionTable(pool);

      if (payloadMessage) {
        await pool.query(
          `INSERT INTO telegram_messages (update_id, from_id, from_name, from_username, chat_id, chat_type, text)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (update_id) DO NOTHING`,
          [
            body.update_id,
            fromId,
            fromName,
            payloadMessage?.from?.username ?? null,
            chatId,
            payloadMessage?.chat?.type ?? null,
            text ?? null,
          ],
        );
      }

      if (callbackQuery?.id && chatId && fromId && callbackQuery?.data) {
        await handleWizardCallback(
          pool,
          String(callbackQuery.id),
          String(chatId),
          String(fromId),
          String(callbackQuery.data),
        );
        return NextResponse.json({ ok: true });
      }

      if (text && chatId && fromId) {
        const trimmed = text.trim();
        if (trimmed.startsWith("/nuevo")) {
          await startWizard(pool, String(chatId), String(fromId));
        } else if (trimmed.startsWith("/cancel")) {
          await clearExpenseSession(pool, String(chatId), String(fromId));
          await sendTelegramMessage(chatId, "Carga cancelada.");
        } else if (trimmed.startsWith("/gastos")) {
          const keyboard = await expensesTripKeyboard(pool);
          if (!keyboard) {
            await sendTelegramMessage(chatId, "No hay viajes disponibles.");
          } else {
            await sendTelegramMessage(chatId, "Elegí el viaje para ver sus gastos:", keyboard);
          }
        } else if (trimmed.startsWith("/viajes")) {
          await handleViajesCommand(pool, chatId);
        } else if (trimmed.startsWith("/ayuda") || trimmed.startsWith("/start")) {
          await sendTelegramMessage(chatId, HELP_TEXT);
        } else {
          const consumedByWizard = await handleWizardTextStep(
            pool,
            String(chatId),
            String(fromId),
            fromName,
            trimmed,
          );
          if (!consumedByWizard) {
            await sendTelegramMessage(
              chatId,
              "No entendí ese mensaje. Probá con /nuevo para carga guiada o /ayuda para ver comandos.",
            );
          }
        }
      }
    } catch (dbErr) {
      console.error("[Telegram] Error procesando update:", dbErr);
      if (chatId) {
        await sendTelegramMessage(chatId, "❌ Ocurrió un error procesando tu mensaje.");
      }
    } finally {
      await pool.end();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en el Webhook:", error);
    return NextResponse.json({ error: "Check logs" }, { status: 500 });
  }
}
