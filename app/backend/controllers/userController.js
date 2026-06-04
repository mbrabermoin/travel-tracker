const pool = require("../config/database");
const {
  sendSuccess,
  sendError,
  sendValidationError,
} = require("../utils/response");

const getTrips = async (req, res) => {
  console.log('[DEBUG] getTrips called');
  try {
    const { page, limit } = req.query;

    let params = [];
    let hasLimit = limit !== undefined;
    let pageNum = 1;
    let limitNum;

    if (hasLimit) {
      pageNum = Number.parseInt(page, 10) || 1;
      limitNum = Number.parseInt(limit, 10);

      if (!Number.isInteger(limitNum) || limitNum <= 0) {
        return sendValidationError(res, ["limit must be a positive integer"]);
      }

      if (!Number.isInteger(pageNum) || pageNum <= 0) {
        return sendValidationError(res, ["page must be a positive integer"]);
      }
    }

    const tableResult = await pool.query(
      `SELECT table_schema
       FROM information_schema.tables
       WHERE table_name = 'trips'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END, table_schema
       LIMIT 1`,
    );

    if (tableResult.rows.length === 0) {
      return sendError(res, "Trips table does not exist", 500);
    }

    const tableSchema = tableResult.rows[0].table_schema;

    const columnsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'trips'
       ORDER BY ordinal_position`,
      [tableSchema],
    );

    if (columnsResult.rows.length === 0) {
      return sendError(res, "Trips table has no readable columns", 500);
    }

    const columnsLower = new Map(
      columnsResult.rows.map((row) => [row.column_name.toLowerCase(), row.column_name]),
    );
    const pickColumn = (...candidates) => {
      for (const candidate of candidates) {
        const found = columnsLower.get(String(candidate).toLowerCase());
        if (found) return found;
      }
      return undefined;
    };

    const idColumn = pickColumn("id");
    const destinyColumn = pickColumn("destiny", "destination", "travelDescription", "description");
    const pesosExchangeColumn = pickColumn("dolarPesosExchange");
    const realExchangeColumn = pickColumn("dolarRealExchange");
    const startDateColumn = pickColumn("startDate");
    const endDateColumn = pickColumn("endDate");
    const paidByColumn = pickColumn("paidBy");
    const sheetTabColumn = pickColumn("sheetTab", "sheettab", "sheet_tab");
    const yearColumn = pickColumn("year");
    const monthColumn = pickColumn("month");

    const selectedColumns = [];
    if (idColumn) selectedColumns.push(`${idColumn} AS id`);
    if (destinyColumn) selectedColumns.push(`${destinyColumn} AS destiny`);
    if (pesosExchangeColumn) selectedColumns.push(`${pesosExchangeColumn} AS "dolarPesosExchange"`);
    if (realExchangeColumn) selectedColumns.push(`${realExchangeColumn} AS "dolarRealExchange"`);
    if (startDateColumn) selectedColumns.push(`${startDateColumn} AS "startDate"`);
    if (endDateColumn) selectedColumns.push(`${endDateColumn} AS "endDate"`);
    if (paidByColumn) selectedColumns.push(`${paidByColumn} AS "paidBy"`);
    if (sheetTabColumn) selectedColumns.push(`${sheetTabColumn} AS "sheetTab"`);
    if (yearColumn) selectedColumns.push(`${yearColumn} AS "year"`);
    if (monthColumn) selectedColumns.push(`${monthColumn} AS "month"`);

    const quoteIdent = (value) => `"${value.replace(/"/g, '""')}"`;
    const tableRef = `${quoteIdent(tableSchema)}.${quoteIdent("trips")}`;
    const selectClause = selectedColumns.length > 0 ? selectedColumns.join(", ") : "*";
    const orderByColumn = idColumn || columnsResult.rows[0].column_name;

    let query = `SELECT ${selectClause} FROM ${tableRef} ORDER BY ${quoteIdent(orderByColumn)} ASC`;

    if (hasLimit) {
      const offset = (pageNum - 1) * limitNum;
      query += " LIMIT $1 OFFSET $2";
      params = [limitNum, offset];
    }

    const result = await pool.query(query, params);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableRef}`);
    const totalTrips = Number.parseInt(countResult.rows[0].count);

    let responseData = {
      trips: result.rows,
    };
    
    if (hasLimit) {
      const totalPages = Math.ceil(totalTrips / limitNum);
      responseData.pagination = {
        currentPage: pageNum,
        totalPages,
        totalTrips,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };
    } else {
      responseData.totalTrips = totalTrips;
    }

    sendSuccess(res, responseData, "Trips retrieved successfully");
  } catch (error) {
    sendError(res, "Error fetching trips", 500, error.message);
  }
};

const getExpenses = async (req, res) => {
  console.log('[DEBUG] getExpenses called');
  try {
    const { page, limit, travelId, responsible } = req.query;
    let hasLimit = limit !== undefined;

    let query = `SELECT
      e.id,
      e.type,
      e.amount,
      e.responsible,
      e.paymentMethod,
      e.travelId,
      e.travelDescription,
      e.exchange,
      e.date,
      ROUND(
        CASE
          WHEN LOWER(TRIM(e.exchange)) IN ('peso', 'pesos', 'ars') THEN
            e.amount / NULLIF(
              COALESCE(
                (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                1
              ),
              0
            )
          WHEN LOWER(TRIM(e.exchange)) IN ('real', 'reales', 'brl') THEN
            e.amount / NULLIF(
              COALESCE(
                (to_jsonb(t) ->> 'dolarRealExchange')::numeric,
                (to_jsonb(t) ->> 'dolarrealexchange')::numeric,
                1
              ),
              0
            )
          ELSE e.amount
        END,
        2
      ) AS "dollarAmount"
    FROM expenses e
    LEFT JOIN trips t ON t.id::text = e.travelId::text`;
    let countQuery = "SELECT COUNT(*) FROM expenses e";
    let perPersonQuery = `SELECT
      e.responsible,
      COUNT(*) AS "expenseCount",
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('peso', 'pesos', 'ars') THEN
                e.amount / NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                    1
                  ),
                  0
                )
              WHEN LOWER(TRIM(e.exchange)) IN ('real', 'reales', 'brl') THEN
                e.amount / NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarRealExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarrealexchange')::numeric,
                    1
                  ),
                  0
                )
              WHEN LOWER(TRIM(e.exchange)) IN ('dolar', 'dólar', 'dolares', 'dólares', 'usd') THEN e.amount
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "usdTotal",
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('peso', 'pesos', 'ars') THEN e.amount
              WHEN LOWER(TRIM(e.exchange)) IN ('real', 'reales', 'brl') THEN
                (e.amount / NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarRealExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarrealexchange')::numeric,
                    1
                  ),
                  0
                )) * NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                    1
                  ),
                  0
                )
              WHEN LOWER(TRIM(e.exchange)) IN ('dolar', 'dólar', 'dolares', 'dólares', 'usd') THEN
                e.amount * NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                    1
                  ),
                  0
                )
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "pesosTotal"
    FROM expenses e
    LEFT JOIN trips t ON t.id::text = e.travelId::text`;
    let totalsQuery = `SELECT
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('dolar', 'dólar', 'dolares', 'dólares', 'usd') THEN e.amount
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "dollarPaid",
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('peso', 'pesos', 'ars') THEN e.amount
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "pesosPaid",
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('real', 'reales', 'brl') THEN e.amount
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "realesPaid",
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('peso', 'pesos', 'ars') THEN
                e.amount / NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                    1
                  ),
                  0
                )
              WHEN LOWER(TRIM(e.exchange)) IN ('real', 'reales', 'brl') THEN
                e.amount / NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarRealExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarrealexchange')::numeric,
                    1
                  ),
                  0
                )
              WHEN LOWER(TRIM(e.exchange)) IN ('dolar', 'dólar', 'dolares', 'dólares', 'usd') THEN e.amount
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "dollarTotal",
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(e.exchange)) IN ('peso', 'pesos', 'ars') THEN e.amount
              WHEN LOWER(TRIM(e.exchange)) IN ('real', 'reales', 'brl') THEN
                (e.amount / NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarRealExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarrealexchange')::numeric,
                    1
                  ),
                  0
                )) * NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                    1
                  ),
                  0
                )
              WHEN LOWER(TRIM(e.exchange)) IN ('dolar', 'dólar', 'dolares', 'dólares', 'usd') THEN
                e.amount * NULLIF(
                  COALESCE(
                    (to_jsonb(t) ->> 'dolarPesosExchange')::numeric,
                    (to_jsonb(t) ->> 'dolarpesosexchange')::numeric,
                    1
                  ),
                  0
                )
              ELSE 0
            END
          ),
          0
        ),
        2
      ) AS "localCurrencyAmount"
    FROM expenses e
    LEFT JOIN trips t ON t.id::text = e.travelId::text`;
    let params = [];
    let countParams = [];
    let totalsParams = [];
    let perPersonParams = [];

    const mainWhere = [];
    const countWhere = [];
    const totalsWhere = [];
    const perPersonWhere = [];

    if (travelId) {
      mainWhere.push("e.travelId = $" + (params.length + 1));
      params.push(travelId);

      countWhere.push("e.travelId = $" + (countParams.length + 1));
      countParams.push(travelId);

      totalsWhere.push("e.travelId = $" + (totalsParams.length + 1));
      totalsParams.push(travelId);

      perPersonWhere.push("e.travelId = $" + (perPersonParams.length + 1));
      perPersonParams.push(travelId);
    }

    const normalizedResponsible = String(responsible || "").trim().toLowerCase();
    if (normalizedResponsible) {
      // Apply responsible filter ONLY to main list and count (not to totals/perPerson to show general totals)
      mainWhere.push("LOWER(TRIM(e.responsible)) = $" + (params.length + 1));
      params.push(normalizedResponsible);

      countWhere.push("LOWER(TRIM(e.responsible)) = $" + (countParams.length + 1));
      countParams.push(normalizedResponsible);
    }

    if (mainWhere.length > 0) {
      query += " WHERE " + mainWhere.join(" AND ");
      countQuery += " WHERE " + countWhere.join(" AND ");
      totalsQuery += " WHERE " + totalsWhere.join(" AND ");
      perPersonQuery += " WHERE " + perPersonWhere.join(" AND ");
    }

    query += " ORDER BY e.id ASC";
    perPersonQuery += " GROUP BY e.responsible ORDER BY e.responsible ASC";
    
    if (hasLimit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query += " LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
      params.push(limitNum, offset);
    }

    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, countParams);
    
    // Get total count without responsible filter (for display purposes)
    let totalCountQuery = "SELECT COUNT(*) FROM expenses e";
    let totalCountParams = [];
    const totalCountWhere = [];
    if (travelId) {
      totalCountWhere.push("e.travelId = $1");
      totalCountParams.push(travelId);
    }
    if (totalCountWhere.length > 0) {
      totalCountQuery += " WHERE " + totalCountWhere.join(" AND ");
    }
    const totalCountResult = await pool.query(totalCountQuery, totalCountParams);
    
    const totalsResult = await pool.query(totalsQuery, totalsParams);
    const perPersonResult = await pool.query(perPersonQuery, perPersonParams);
    const totalExpenses = Number.parseInt(countResult.rows[0].count);
    const totalCount = Number.parseInt(totalCountResult.rows[0].count);
    const totalsRow = totalsResult.rows[0] || {
      dollarPaid: 0,
      pesosPaid: 0,
      realesPaid: 0,
      dollarTotal: 0,
      localCurrencyAmount: 0,
    };
    const totals = {
      dollarPaid: Number.parseFloat(totalsRow.dollarPaid) || 0,
      pesosPaid: Number.parseFloat(totalsRow.pesosPaid) || 0,
      realesPaid: Number.parseFloat(totalsRow.realesPaid) || 0,
      dollarTotal: Number.parseFloat(totalsRow.dollarTotal) || 0,
      localCurrencyAmount: Number.parseFloat(totalsRow.localCurrencyAmount) || 0,
      perPersonUsd: Object.fromEntries(
        perPersonResult.rows
          .filter((row) => row.responsible)
          .map((row) => [String(row.responsible), {
            usdTotal: Number.parseFloat(row.usdTotal) || 0,
            pesosTotal: Number.parseFloat(row.pesosTotal) || 0,
            expenseCount: Number.parseInt(row.expenseCount) || 0
          }]),
      ),
    };

    let responseData = {
      expenses: result.rows,
      totals,
    };
    
    if (hasLimit) {
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page) || 1;
      const totalPages = Math.ceil(totalExpenses / limitNum);
      responseData.pagination = {
        currentPage: pageNum,
        totalPages,
        totalExpenses,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };
    } else {
      responseData.totalExpenses = totalExpenses;
    }

    sendSuccess(res, responseData, "Expenses retrieved successfully");
  } catch (error) {
    sendError(res, "Error fetching expenses", 500, error.message);
  }
};

const getUsers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    let hasLimit = limit !== undefined;
    
    let query = "SELECT id, username, email FROM users ORDER BY id ASC";
    let params = [];
    
    if (hasLimit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query += " LIMIT $1 OFFSET $2";
      params = [limitNum, offset];
    }

    const result = await pool.query(query, params);
    const countResult = await pool.query("SELECT COUNT(*) FROM users");
    const totalUsers = Number.parseInt(countResult.rows[0].count);

    let responseData = {
      users: result.rows,
    };
    
    if (hasLimit) {
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page) || 1;
      const totalPages = Math.ceil(totalUsers / limitNum);
      responseData.pagination = {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };
    } else {
      responseData.totalUsers = totalUsers;
    }

    sendSuccess(res, responseData, "Users retrieved successfully");
  } catch (error) {
    sendError(res, "Error fetching users", 500, error.message);
  }
};

const createUser = async (req, res) => {
  try {
    const { username, email } = req.body;

    const errors = [];
    if (!username || username.trim().length < 3) {
      errors.push("Username must be at least 3 characters long");
    }
    if (!email?.includes("@")) {
      errors.push("Valid email is required");
    }

    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    // Verificar si el usuario ya existe
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email.toLowerCase(), username.toLowerCase()],
    );

    if (existingUser.rows.length > 0) {
      return sendError(res, "User with this email or username already exists", 409);
    }

    const result = await pool.query(
      `INSERT INTO users (username, email) 
       VALUES ($1, $2) 
       RETURNING id, username, email`,
      [username.trim(), email.toLowerCase()],
    );

    const newUser = result.rows[0];

    sendSuccess(res, newUser, "User created successfully", 201);
  } catch (error) {
    sendError(res, "Error creating user", 500, error.message);
  }
};

const testConnection = async (req, res) => {
  try {
    const pgPool = pool.getPool();
    const options = pgPool.options || {};

    // useful debug info
    const configDebug = {
      user: options.user,
      host: options.host,
      database: options.database,
      port: options.port,
      envPGPORT: process.env.PGPORT,
      envDBPORT: process.env.DB_PORT,
    };
    console.log("[DB DEBUG] using config:", configDebug);

    const result = await pool.query("SELECT NOW()");
    sendSuccess(res, { ...configDebug, now: result.rows }, "Database connection successful");
  } catch (error) {
    const pgPool = pool.getPool();
    const options = pgPool.options || {};

    // return config + original error message so we can debug easily
    const configDebug = {
      user: options.user,
      host: options.host,
      database: options.database,
      port: options.port,
      envPGPORT: process.env.PGPORT,
      envDBPORT: process.env.DB_PORT,
    };
    console.error("[DB DEBUG ERROR]", error.message, configDebug);
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
      config: configDebug,
    });
  }
};

const MISSING_APPS_SCRIPT_MESSAGE = "GOOGLE_APPS_SCRIPT_URL is not configured. Expense was saved in DB only.";

const isSheetsSyncEnabled = () => {
  const raw = String(process.env.SHEETS_SYNC_ENABLED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off" && raw !== "no";
};

const getAppsScriptUrl = () => {
  const configuredUrl =
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.APPS_SCRIPT_URL ||
    process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL;

  if (!configuredUrl) return null;

  const trimmedUrl = String(configuredUrl).trim();
  if (!trimmedUrl) return null;

  if (trimmedUrl.includes("/exec") || trimmedUrl.includes("/dev")) {
    return trimmedUrl;
  }

  return `${trimmedUrl.replace(/\/+$/, "")}/exec`;
};

const ensureExpenseSyncQueueTable = async () => {
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
};

const syncExpenseWithAppsScript = async (payload) => {
  if (!isSheetsSyncEnabled()) {
    return {
      ok: true,
      skipped: true,
      warning: "Sincronización con Sheets desactivada por configuración",
      result: null,
    };
  }

  const appsScriptUrl = getAppsScriptUrl();
  if (!appsScriptUrl) {
    return {
      ok: false,
      skipped: false,
      warning: MISSING_APPS_SCRIPT_MESSAGE,
      result: null,
    };
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!response.ok || json.error) {
      const rawResponsePreview = String(text || "").slice(0, 180);
      return {
        ok: false,
        skipped: false,
        warning: json.error ?? `Apps Script status ${response.status}${rawResponsePreview ? `: ${rawResponsePreview}` : ""}`,
        result: null,
      };
    }

    return {
      ok: true,
      skipped: false,
      warning: null,
      result: json,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      warning: error.message,
      result: null,
    };
  }
};

const enqueueExpenseSheetSync = async (expenseId, payload, lastError) => {
  await ensureExpenseSyncQueueTable();
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
};

const processPendingExpenseSync = async (limit = 20) => {
  if (!isSheetsSyncEnabled()) {
    return {
      picked: 0,
      synced: 0,
      failed: 0,
      skipped: true,
    };
  }

  await ensureExpenseSyncQueueTable();

  const queued = await pool.query(
    `SELECT expense_id, payload, retries
     FROM public.expense_sheet_sync_queue
     WHERE status IN ('pending', 'failed')
       AND next_retry_at <= NOW()
     ORDER BY updated_at ASC
     LIMIT $1`,
    [limit],
  );

  let synced = 0;
  let failed = 0;

  for (const row of queued.rows) {
    const expenseId = Number(row.expense_id);
    const payload = row.payload || {};
    const syncResult = await syncExpenseWithAppsScript(payload);

    if (syncResult.ok) {
      await pool.query(
        `DELETE FROM public.expense_sheet_sync_queue WHERE expense_id = $1`,
        [expenseId],
      );
      synced += 1;
      continue;
    }

    await pool.query(
      `UPDATE public.expense_sheet_sync_queue
       SET status = 'failed',
           retries = retries + 1,
           last_error = $2,
           next_retry_at = NOW() + ((LEAST(60, POWER(2, retries + 1)))::text || ' minutes')::interval,
           updated_at = NOW()
       WHERE expense_id = $1`,
      [expenseId, syncResult.warning || "sync failed"],
    );
    failed += 1;
  }

  return {
    picked: queued.rowCount,
    synced,
    failed,
    skipped: false,
  };
};

const formatDateForSheet = (inputDate, fallbackDate = new Date()) => {
  const rawDate = String(inputDate || "").trim();
  const ymdMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }

  const parsedDate = new Date(rawDate);
  const baseDate = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
  const day = String(baseDate.getDate()).padStart(2, "0");
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  const year = baseDate.getFullYear();
  return `${day}/${month}/${year}`;
};

const addExpenseToSheet = async (req, res) => {
  try {
    const payload = req.body ?? {};
    const { travelId, date, description, exchange, amount, paidBy, paymentMethod, notes } = payload;
    console.log("[addExpenseToSheet] received data:", payload);

    if (!travelId || !date || !description || !exchange || !amount || !paidBy) {
      return sendValidationError(res, ["travelId, date, description, exchange, amount and paidBy are required"]);
    }

    const amountNumber = Number.parseFloat(String(amount));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return sendValidationError(res, ["amount must be a positive number"]);
    }

    const parsedDate = new Date(date);
    const expenseDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const tripResult = await pool.query(
      `SELECT id, destiny, sheettab FROM public.trips WHERE id = $1`,
      [String(travelId)],
    );

    if (tripResult.rowCount === 0) {
      return sendValidationError(res, ["travelId no existe"]);
    }

    const tripRow = tripResult.rows[0];
    const travelDescription = String(tripRow.destiny || "").trim();
    const sheetName = String(tripRow.sheettab || tripRow.destiny || "").trim();

    const dbResult = await pool.query(
      `INSERT INTO public.expenses (type, amount, responsible, paymentMethod, exchange, date, travelId, travelDescription)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, type, amount, responsible, paymentMethod, exchange, date, travelId, travelDescription`,
      [
        String(description).trim(),
        amountNumber,
        String(paidBy).trim(),
        paymentMethod ? String(paymentMethod).trim() : null,
        String(exchange).trim(),
        expenseDate,
        String(travelId),
        travelDescription,
      ]
    );

    const expense = dbResult.rows[0];
    const sheetPayload = {
      date: formatDateForSheet(date, expenseDate),
      description: String(description).trim(),
      exchange: String(exchange).trim(),
      amount: amountNumber,
      paidBy: String(paidBy).trim(),
      paymentMethod: paymentMethod ? String(paymentMethod).trim() : null,
      travelId: String(travelId),
      travelDescription,
      sheetName,
      notes: notes ? String(notes).trim() : null,
    };

    const syncResult = await syncExpenseWithAppsScript(sheetPayload);
    if (!syncResult.ok) {
      await enqueueExpenseSheetSync(Number(expense.id), sheetPayload, syncResult.warning);
    }

    const backgroundRun = await processPendingExpenseSync(10);

    const syncStatus = syncResult.skipped ? "disabled" : syncResult.ok ? "synced" : "pending";
    const syncMessage = syncResult.skipped
      ? "Guardado en BD. Sincronización con Sheets desactivada"
      : syncResult.ok
      ? "Google Sheets sincronizado"
      : `Guardado en BD. Sheets pendiente de sincronización: ${syncResult.warning || "error desconocido"}`;

    return sendSuccess(
      res,
      {
        expense,
        sync: {
          status: syncStatus,
          message: syncMessage,
          warning: syncResult.warning,
          result: syncResult.result,
        },
        retryStats: backgroundRun,
      },
      syncResult.skipped
        ? "Gasto agregado. Sincronización desactivada"
        : syncResult.ok
        ? "Gasto agregado y sincronizado"
        : "Gasto agregado. La sincronización quedó pendiente",
      201,
    );
  } catch (error) {
    console.error("[addExpenseToSheet] error:", error.message);
    return sendError(res, "Error al agregar gasto", 500, error.message);
  }
};

const retryPendingExpenseSync = async (req, res) => {
  try {
    if (!isSheetsSyncEnabled()) {
      return sendSuccess(
        res,
        { picked: 0, synced: 0, failed: 0, skipped: true },
        "Sincronización desactivada por configuración",
      );
    }

    const result = await processPendingExpenseSync(100);
    return sendSuccess(res, result, "Procesamiento de pendientes finalizado");
  } catch (error) {
    console.error("[retryPendingExpenseSync] error:", error.message);
    return sendError(res, "Error procesando pendientes de sincronización", 500, error.message);
  }
};

const getExpenseSyncStatus = async (req, res) => {
  try {
    if (!isSheetsSyncEnabled()) {
      return sendSuccess(
        res,
        {
          enabled: false,
          pending: 0,
          failed: 0,
          total: 0,
        },
        "Sincronización con Sheets desactivada",
      );
    }

    await ensureExpenseSyncQueueTable();
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COUNT(*) AS total
       FROM public.expense_sheet_sync_queue`,
    );

    const row = result.rows[0] || { pending: 0, failed: 0, total: 0 };
    return sendSuccess(
      res,
      {
        enabled: true,
        pending: Number(row.pending || 0),
        failed: Number(row.failed || 0),
        total: Number(row.total || 0),
      },
      "Estado de sincronización obtenido",
    );
  } catch (error) {
    console.error("[getExpenseSyncStatus] error:", error.message);
    return sendError(res, "Error obteniendo estado de sincronización", 500, error.message);
  }
};

const getTelegramMessages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, update_id, from_id, from_name, from_username, chat_id, chat_type, text, received_at
       FROM telegram_messages
       ORDER BY received_at DESC
       LIMIT 100`
    );
    return sendSuccess(res, { messages: result.rows }, "Messages retrieved");
  } catch (error) {
    console.error("[getTelegramMessages] error:", error.message);
    return sendError(res, "Error retrieving messages", 500);
  }
};

module.exports = {
  getUsers,
  getExpenses,
  getTrips,
  createUser,
  testConnection,
  getTelegramMessages,
  addExpenseToSheet,
  retryPendingExpenseSync,
  getExpenseSyncStatus,
};
