/**
 * Data Ingestion Agent
 * Accepts CSV, tab-delimited exports, JSON, and export const blocks.
 * Maps fields to employees, shifts, and pos_sales; flags data quality issues.
 */
const DataIngestionAgent = (() => {
  const FIELD_ALIASES = {
    employee_id: [
      "employee_id", "employeeid", "emp_id", "empid", "staff_id", "staffid",
      "worker_id", "employee_guid", "team_member_id", "team_member_guid", "user_id",
      "emplyee_id", "employee_number", "emp_number", "employee_code", "emp_code", "payroll_id"
    ],
    first_name: ["first_name", "firstname", "first", "given_name", "fname"],
    last_name: ["last_name", "lastname", "last", "surname", "lname", "family_name"],
    full_name: [
      "name", "employee_name", "employeename", "staff_name", "full_name",
      "employee", "team_member", "team_member_name", "worker", "worker_name"
    ],
    role: ["role", "job_title", "jobtitle", "position", "title", "job", "department"],
    hourly_rate: [
      "hourly_rate", "hourlyrate", "pay_rate", "payrate", "wage", "rate",
      "base_pay", "wage_rate", "regular_rate", "avg_hourly_rate"
    ],
    tip_eligible: ["tip_eligible", "tipeligible", "tipped", "receives_tips"],
    shift_id: ["shift_id", "shiftid", "shift"],
    shift_date: [
      "shift_date", "shiftdate", "date", "work_date", "clock_date",
      "business_date", "businessdate", "in_date", "indate", "date_worked"
    ],
    clock_in: ["clock_in", "clockin", "in", "start_time", "punch_in"],
    clock_out: ["clock_out", "clockout", "out", "end_time", "punch_out"],
    break_minutes: ["break_minutes", "breakminutes", "break", "break_mins"],
    hours_worked: [
      "hours_worked", "hoursworked", "hours", "total_hours", "shift_hours",
      "reg_hours", "regular_hours", "paid_hours", "duration_hours", "hrs", "hour"
    ],
    transaction_id: ["transaction_id", "transactionid", "txn_id", "sale_id", "order_id", "check_id"],
    net_sales: ["net_sales", "netsales", "sales", "net", "revenue", "food_sales", "total_sales"],
    gross_sales: ["gross_sales", "grosssales", "gross"],
    discounts: ["discounts", "discount", "comps"],
    credit_card_tips: ["credit_card_tips", "creditcardtips", "cc_tips", "card_tips", "credit_tips", "non_cash_tips"],
    cash_tips: ["cash_tips", "cashtips", "cash_tip", "gratuity_cash"],
    total_tips: ["total_tips", "totaltips", "tips", "gratuity", "tip_total"],
    total_tips_collected: ["total_tips_collected", "tips_collected", "collected_tips"],
    expected_tip_share: ["expected_tip_share", "expected_tip", "tip_share_expected"],
    actual_tip_paid: ["actual_tip_paid", "actual_tip", "tip_paid"],
    tip_pool_total: ["tip_pool_total", "pool_total"],
    tip_pool_contribution: ["tip_pool_contribution", "pool_contribution"],
    tip_pool_share: ["tip_pool_share", "pool_share"],
    adjustment_reason: ["adjustment_reason", "adjust_reason"],
    adjustment_amount: ["adjustment_amount", "adjust_amount"],
    adjustment_notes: ["adjustment_notes", "adjust_notes", "adjustment_note"],
    adjusted_by_employee_id: ["adjusted_by_employee_id", "adjusted_by", "adjusted_by_id"],
    payment_batch_id: ["payment_batch_id", "pay_batch_id", "batch_id"]
  };

  const DATASET_MARKERS = {
    employees: ["employee", "staff", "roster", "team"],
    shifts: ["shift", "timecard", "time_card", "clock", "hours", "labor"],
    pos_sales: ["sales", "transaction", "pos", "tips", "toast", "square", "check"]
  };

  function looksLikeEmployeeId(value) {
    const text = String(value || "").trim();
    if (!text) {
      return true;
    }
    if (/^(E|AUTO-E)\d+$/i.test(text)) {
      return true;
    }
    if (/^EMP-[A-Z0-9_]+$/i.test(text)) {
      return true;
    }
    return false;
  }

  function recordDisplayName(record) {
    if (record.full_name && !looksLikeEmployeeId(record.full_name)) {
      return String(record.full_name).trim();
    }

    const combined = `${record.first_name || ""} ${record.last_name || ""}`.trim();
    if (combined && !looksLikeEmployeeId(combined)) {
      return combined;
    }

    return "";
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function mapHeader(header) {
    const normalized = normalizeKey(header);
    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalized)) {
        return canonical;
      }
    }

    if (/adjusted/.test(normalized) && /employee/.test(normalized)) {
      return "adjusted_by_employee_id";
    }
    if (/expected/.test(normalized) && /tip/.test(normalized)) {
      return "expected_tip_share";
    }
    if (/actual/.test(normalized) && /tip/.test(normalized)) {
      return "actual_tip_paid";
    }
    if (/payment/.test(normalized) && /batch/.test(normalized)) {
      return "payment_batch_id";
    }
    if (/employee/.test(normalized) && /id|num|number|code|#/.test(normalized)) {
      return "employee_id";
    }
    if (/^id$/i.test(String(header || "").trim()) && !/guid|shift|transaction|sale|check|txn/.test(normalized)) {
      return "employee_id";
    }
    if (/employee|team_member|staff_name|worker/.test(normalized) || normalized === "employee") {
      return "full_name";
    }
    if (/first/.test(normalized) && /name/.test(normalized)) {
      return "first_name";
    }
    if (/last/.test(normalized) && /name/.test(normalized)) {
      return "last_name";
    }
    if (/hour|hrs|duration/.test(normalized) && !/ly_rate|rate|wage|pay/.test(normalized)) {
      return "hours_worked";
    }
    if (/business/.test(normalized) && /date/.test(normalized)) {
      return "shift_date";
    }
    if (/date/.test(normalized) || normalized === "day") {
      return "shift_date";
    }
    if (/tip/.test(normalized) && /collected/.test(normalized)) {
      return "total_tips_collected";
    }
    if (/tip/.test(normalized) && !/eligible|out|pool|expected|actual|share|contribution|adjustment|collected|paid/.test(normalized)) {
      return "total_tips";
    }
    if (/sales|revenue|net/.test(normalized)) {
      return "net_sales";
    }
    if (/job/.test(normalized) || /title/.test(normalized) || normalized === "position") {
      return "role";
    }
    if (/wage|rate|pay/.test(normalized) && !/tip|batch|payment/.test(normalized)) {
      return "hourly_rate";
    }

    return normalized;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (inQuotes) {
        if (char === "\"" && next === "\"") {
          field += "\"";
          index += 1;
        } else if (char === "\"") {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === "\"") {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field.trim());
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && next === "\n") {
          index += 1;
        }
        row.push(field.trim());
        if (row.some((cell) => cell.length)) {
          rows.push(row);
        }
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field.trim());
      if (row.some((cell) => cell.length)) {
        rows.push(row);
      }
    }

    return rows;
  }

  function parseDelimitedTable(text) {
    const delimiter = text.includes("\t") && !text.includes(",") ? "\t" : ",";
    if (delimiter === "\t") {
      return text
        .split(/\r?\n/)
        .map((line) => line.split("\t").map((cell) => cell.trim()))
        .filter((row) => row.some(Boolean));
    }
    return parseCsv(text);
  }

  function inferSectionDataset(label) {
    const normalized = normalizeKey(label);
    if (/employee|staff|roster|team/.test(normalized)) {
      return "employees";
    }
    if (/shift|timecard|time_card|clock|labor|hours/.test(normalized)) {
      return "shifts";
    }
    if (/pos_sales|sales|transaction|tip|check|toast|square/.test(normalized)) {
      return "pos_sales";
    }
    return normalized;
  }

  function splitSections(text) {
    const markerPattern = /^(?:#{1,3}\s*(.+)|={3,}\s*(.+?)\s*={3,}|\[(.+?)\])\s*$/gim;
    const matches = [...text.matchAll(markerPattern)];

    if (!matches.length) {
      return [{ label: "auto", body: text.trim() }];
    }

    if (matches.length === 1) {
      const label = matches[0][1] || matches[0][2] || matches[0][3] || "auto";
      return [{
        label: inferSectionDataset(label),
        body: text.slice(matches[0].index + matches[0][0].length).trim()
      }];
    }

    return matches.map((match, index) => {
      const label = match[1] || match[2] || match[3] || `section_${index + 1}`;
      const bodyStart = match.index + match[0].length;
      const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : text.length;
      return {
        label: inferSectionDataset(label),
        body: text.slice(bodyStart, bodyEnd).trim()
      };
    });
  }

  function normalizeEmployeeId(employeeId) {
    return String(employeeId ?? "").trim();
  }

  function rowHasProcessableIdentity(record) {
    return Boolean(normalizeEmployeeId(record.employee_id) || recordDisplayName(record));
  }

  function extractEntitiesFromRow(record, index, flags, result) {
    if (!rowHasProcessableIdentity(record)) {
      return;
    }

    const employeeId = normalizeEmployeeId(record.employee_id);
    if (employeeId) {
      record.employee_id = employeeId;
    }

    const hours = toNumber(record.hours_worked);
    const hasSales = recordHasSalesData(record);
    const hasRosterFields =
      record.role ||
      toNumber(record.hourly_rate) !== null ||
      toBoolean(record.tip_eligible) !== null;

    if (employeeId && (hasRosterFields || (hours === null && !hasSales))) {
      const employee = normalizeEmployee(record, index, flags);
      if (employee) {
        result.employees.push(employee);
      }
    }

    if (hours !== null) {
      const shift = normalizeShift(record, index, flags);
      if (shift) {
        result.shifts.push(shift);
      }
    }

    if (hasSales || recordHasAllocationData(record)) {
      const sale = normalizeSale(record, index, flags);
      if (sale) {
        result.pos_sales.push(sale);
      }
    }
  }

  function employeeIdFromRecord(record) {
    return normalizeEmployeeId(record.employee_id);
  }

  function findHeaderRowIndex(rows) {
    for (let index = 0; index < Math.min(rows.length, 50); index += 1) {
      const mapped = rows[index].map(mapHeader);
      const signal = [
        "employee_id", "full_name", "first_name", "hours_worked",
        "shift_date", "net_sales", "credit_card_tips", "total_tips", "role"
      ].filter((key) => mapped.includes(key)).length;
      const filledCells = rows[index].filter((cell) => String(cell).trim()).length;
      if (signal >= 1 && filledCells >= 2) {
        return index;
      }
    }
    return 0;
  }

  function resolveDatasetType(sectionLabel, headers) {
    const inferred = inferSectionDataset(sectionLabel);
    if (["employees", "shifts", "pos_sales"].includes(inferred)) {
      return inferred;
    }
    return detectDatasetType(headers);
  }

  function detectDatasetType(headers) {
    const mapped = headers.map(mapHeader);
    const has = (keys) => keys.some((key) => mapped.includes(key));
    const hasSales = has(["net_sales", "credit_card_tips", "cash_tips", "total_tips"]);
    const hasHours = has(["hours_worked"]);
    const hasIdentity = has(["employee_id", "full_name", "first_name", "last_name"]);
    const hasRoster = has(["role", "hourly_rate", "tip_eligible"]);

    if (hasHours && hasIdentity) {
      return "shifts";
    }

    if (hasSales && hasIdentity) {
      return "pos_sales";
    }

    if (hasIdentity && hasRoster) {
      return "employees";
    }

    if (hasIdentity && has(["shift_date", "shift_id", "clock_in", "clock_out"])) {
      return "shifts";
    }

    if (hasIdentity) {
      return hasSales ? "pos_sales" : "employees";
    }

    const joined = headers.join(" ").toLowerCase();
    for (const [dataset, markers] of Object.entries(DATASET_MARKERS)) {
      if (markers.some((marker) => joined.includes(marker))) {
        return dataset;
      }
    }

    return "unknown";
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const cleaned = String(value).replace(/[$,%\s]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toBoolean(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["true", "yes", "y", "1", "tipped"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "n", "0"].includes(normalized)) {
      return false;
    }
    return null;
  }

  function splitFullName(fullName) {
    const parts = String(fullName || "").trim().split(/\s+/);
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: "" };
    }
    return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
  }

  function rowsToObjects(rows) {
    if (!rows.length) {
      return { headers: [], records: [], mapping: {} };
    }

    const headerIndex = findHeaderRowIndex(rows);
    const headers = rows[headerIndex];
    const mappedHeaders = headers.map(mapHeader);
    const mapping = Object.fromEntries(headers.map((header, index) => [header, mappedHeaders[index]]));

    const records = rows.slice(headerIndex + 1).map((cells) => {
      const record = {};
      mappedHeaders.forEach((key, index) => {
        const value = cells[index] ?? "";
        if (record[key] === undefined || record[key] === "") {
          record[key] = value;
        } else if (value !== "" && key === "employee_id") {
          record.adjusted_by_employee_id = value;
        }
      });
      return record;
    }).filter((record) => Object.values(record).some((value) => String(value).trim().length));

    return { headers, records, mapping };
  }

  function normalizeEmployee(record, index, flags) {
    const displayName = recordDisplayName(record);
    const names = displayName
      ? splitFullName(displayName)
      : record.full_name && !looksLikeEmployeeId(record.full_name)
        ? splitFullName(record.full_name)
        : { first_name: record.first_name || "", last_name: record.last_name || "" };

    const employeeId = normalizeEmployeeId(record.employee_id);
    if (!employeeId) {
      return null;
    }

    const hourlyRate = toNumber(record.hourly_rate);
    if (hourlyRate === null) {
      flags.push({
        code: "MISSING_HOURLY_RATE",
        severity: "review",
        entity: "employees",
        row: index + 2,
        employee_id: employeeId,
        message: "Hourly rate is missing or invalid — defaulted to 0 for payroll math."
      });
    }

    const tipEligible = toBoolean(record.tip_eligible);
    const role = record.role || "Server";

    return {
      employee_id: employeeId,
      first_name: names.first_name,
      last_name: names.last_name,
      role,
      hourly_rate: hourlyRate ?? 0,
      tip_eligible: tipEligible ?? ["Server", "Bartender"].includes(role)
    };
  }

  function normalizeShift(record, index, flags) {
    const employeeId = employeeIdFromRecord(record);
    const employeeName = recordDisplayName(record);
    if (!employeeId && !employeeName) {
      return null;
    }

    const hours = toNumber(record.hours_worked);

    if (hours === null) {
      flags.push({
        code: "MISSING_HOURS",
        severity: "review",
        entity: "shifts",
        row: index + 2,
        employee_id: employeeId || undefined,
        message: "Shift row is missing numeric hours_worked."
      });
    }

    return {
      shift_id: record.shift_id || `AUTO-S${String(index + 1).padStart(3, "0")}`,
      employee_id: employeeId,
      employee_name: employeeName,
      role: record.role || "",
      hourly_rate: toNumber(record.hourly_rate),
      shift_date: record.shift_date || "",
      clock_in: record.clock_in || "",
      clock_out: record.clock_out || "",
      break_minutes: toNumber(record.break_minutes) ?? 0,
      hours_worked: hours ?? 0
    };
  }

  function normalizeSale(record, index, flags) {
    const employeeId = employeeIdFromRecord(record);
    const employeeName = recordDisplayName(record);
    if (!employeeId && !employeeName) {
      return null;
    }

    const netSales = toNumber(record.net_sales) ?? toNumber(record.gross_sales);
    const creditTips = toNumber(record.credit_card_tips) ?? 0;
    const cashTips = toNumber(record.cash_tips) ?? 0;
    const totalTips = toNumber(record.total_tips);

    if (netSales === null && totalTips === null) {
      flags.push({
        code: "MISSING_NET_SALES",
        severity: "review",
        entity: "pos_sales",
        row: index + 2,
        employee_id: employeeId,
        message: "Sales row is missing net_sales."
      });
    }

    if (totalTips !== null && Math.abs(totalTips - (creditTips + cashTips)) > 0.05) {
      flags.push({
        code: "TIP_TOTAL_MISMATCH",
        severity: "review",
        entity: "pos_sales",
        row: index + 2,
        employee_id: employeeId,
        message: `Reported total tips (${totalTips}) do not match credit + cash (${creditTips + cashTips}).`
      });
    }

    return {
      transaction_id: record.transaction_id || `AUTO-T${String(index + 1).padStart(3, "0")}`,
      employee_id: employeeId,
      employee_name: employeeName,
      shift_id: record.shift_id || "",
      shift_date: record.shift_date || "",
      gross_sales: toNumber(record.gross_sales) ?? netSales ?? 0,
      discounts: toNumber(record.discounts) ?? 0,
      net_sales: netSales ?? 0,
      credit_card_tips: totalTips !== null && creditTips === 0 && cashTips === 0 ? totalTips : creditTips,
      cash_tips: cashTips,
      expected_tip_share: toNumber(record.expected_tip_share),
      actual_tip_paid: toNumber(record.actual_tip_paid),
      manual_adjustment_amount: toNumber(record.manual_adjustment_amount),
      adjusted_by_employee_id: normalizeEmployeeId(record.adjusted_by_employee_id) || "",
      tip_pool_id: record.tip_pool_id || "",
      tip_pool_total: toNumber(record.tip_pool_total),
      tip_pool_participants: toNumber(record.tip_pool_participants),
      tip_pool_share: toNumber(record.tip_pool_share)
    };
  }

  function recordHasAllocationData(record) {
    return [
      "expected_tip_share", "actual_tip_paid", "manual_adjustment_amount", "tip_pool_share"
    ].some((key) => toNumber(record[key]) !== null);
  }

  function recordHasSalesData(record) {
    return ["net_sales", "credit_card_tips", "cash_tips", "total_tips"].some((key) => {
      const value = toNumber(record[key]);
      return value !== null && value > 0;
    });
  }

  function ingestTable(sectionLabel, text, flags, mappings) {
    const rows = parseDelimitedTable(text);
    const { headers, records, mapping } = rowsToObjects(rows);
    if (!records.length) {
      return { employees: [], shifts: [], pos_sales: [] };
    }

    forwardFillEmployeeIds(records);
    forwardFillEmployeeNames(records);

    mappings.push({ section: sectionLabel, headers, mapping });

    const datasetType = resolveDatasetType(sectionLabel, headers);
    const result = { employees: [], shifts: [], pos_sales: [] };

    if (datasetType === "unknown") {
      flags.push({
        code: "UNKNOWN_TABLE_SHAPE",
        severity: "review",
        section: sectionLabel,
        message: `Could not infer dataset type from headers (${headers.join(", ")}); extracting all recognizable fields from every row.`
      });
    }

    records.forEach((record, index) => extractEntitiesFromRow(record, index, flags, result));

    return result;
  }

  function deriveShiftsFromSales(scenario, flags) {
    if (scenario.shifts.length || !scenario.pos_sales.length) {
      return;
    }

    const employeeById = new Map(scenario.employees.map((employee) => [employee.employee_id, employee]));
    const shiftMap = new Map();

    scenario.pos_sales.forEach((sale) => {
      if (!sale.employee_id) {
        return;
      }

      const shiftDate = sale.shift_date || "UNDATED";
      const key = `${sale.employee_id}|${shiftDate}`;
      const employee = employeeById.get(sale.employee_id);

      if (!shiftMap.has(key)) {
        shiftMap.set(key, {
          shift_id: `AUTO-SALE-${shiftMap.size + 1}`,
          employee_id: sale.employee_id,
          employee_name: sale.employee_name || `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim(),
          role: employee?.role || "Server",
          hourly_rate: employee?.hourly_rate ?? 0,
          shift_date: shiftDate !== "UNDATED" ? shiftDate : "",
          clock_in: "",
          clock_out: "",
          break_minutes: 0,
          hours_worked: 0
        });
      }
    });

    scenario.shifts = [...shiftMap.values()];

    if (scenario.shifts.length) {
      flags.push({
        code: "SHIFTS_DERIVED_FROM_SALES",
        severity: "review",
        message:
          "No labor/timecard sheet was found. Shift placeholders were created from sales rows; hours may be missing and need review."
      });
    }
  }

  function enrichEmployeeNamesFromActivity(scenario, flags) {
    const nameById = new Map();

    function noteName(employeeId, name) {
      const trimmed = String(name || "").trim();
      if (!employeeId || !trimmed || looksLikeEmployeeId(trimmed)) {
        return;
      }

      const existing = nameById.get(employeeId);
      if (!existing || trimmed.length > existing.length) {
        nameById.set(employeeId, trimmed);
      }
    }

    scenario.shifts.forEach((shift) => noteName(shift.employee_id, shift.employee_name));
    scenario.pos_sales.forEach((sale) => noteName(sale.employee_id, sale.employee_name));

    scenario.employees.forEach((employee) => {
      const current = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
      if (current && !looksLikeEmployeeId(current)) {
        return;
      }

      const resolved = nameById.get(employee.employee_id);
      if (!resolved) {
        return;
      }

      const names = splitFullName(resolved);
      employee.first_name = names.first_name;
      employee.last_name = names.last_name;

      if (current && looksLikeEmployeeId(current)) {
        flags.push({
          code: "EMPLOYEE_NAME_ENRICHED",
          severity: "info",
          employee_id: employee.employee_id,
          message: `Resolved display name "${resolved}" from shift/sales data instead of roster value "${current}".`
        });
      }
    });
  }

  function employeeDisplayName(employee) {
    return recordDisplayName({
      first_name: employee.first_name,
      last_name: employee.last_name,
      full_name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
    });
  }

  function preferCanonicalEmployeeId(left, right) {
    const leftId = normalizeEmployeeId(left);
    const rightId = normalizeEmployeeId(right);
    if (!leftId) {
      return rightId;
    }
    if (!rightId) {
      return leftId;
    }

    const score = (employeeId) => {
      if (/^E\d+$/i.test(employeeId)) {
        return 3;
      }
      if (/^\d+$/.test(employeeId)) {
        return 2;
      }
      if (/^EMP-/i.test(employeeId)) {
        return 1;
      }
      return 2;
    };

    const leftScore = score(leftId);
    const rightScore = score(rightId);
    if (leftScore !== rightScore) {
      return leftScore > rightScore ? leftId : rightId;
    }

    return leftId.localeCompare(rightId) <= 0 ? leftId : rightId;
  }

  function mergeEmployeesByName(scenario, flags) {
    const idsByName = new Map();

    function noteName(employeeId, name) {
      const id = normalizeEmployeeId(employeeId);
      const displayName = String(name || "").trim();
      if (!id || !displayName || looksLikeEmployeeId(displayName)) {
        return;
      }

      const nameKey = normalizeKey(displayName);
      if (!idsByName.has(nameKey)) {
        idsByName.set(nameKey, new Set());
      }
      idsByName.get(nameKey).add(id);
    }

    scenario.employees.forEach((employee) => noteName(employee.employee_id, employeeDisplayName(employee)));
    scenario.shifts.forEach((shift) => noteName(shift.employee_id, shift.employee_name));
    scenario.pos_sales.forEach((sale) => noteName(sale.employee_id, sale.employee_name));

    const reassign = new Map();
    idsByName.forEach((ids) => {
      if (ids.size <= 1) {
        return;
      }

      const idList = [...ids];
      let canonical = idList[0];
      for (let index = 1; index < idList.length; index += 1) {
        canonical = preferCanonicalEmployeeId(canonical, idList[index]);
      }

      idList.forEach((id) => {
        if (id !== canonical) {
          reassign.set(id, canonical);
        }
      });
    });

    if (!reassign.size) {
      return;
    }

    function resolveId(employeeId) {
      let resolved = normalizeEmployeeId(employeeId);
      const seen = new Set();
      while (reassign.has(resolved) && !seen.has(resolved)) {
        seen.add(resolved);
        resolved = reassign.get(resolved);
      }
      return resolved;
    }

    scenario.shifts.forEach((shift) => {
      shift.employee_id = resolveId(shift.employee_id);
    });
    scenario.pos_sales.forEach((sale) => {
      sale.employee_id = resolveId(sale.employee_id);
    });
    scenario.employees.forEach((employee) => {
      employee.employee_id = resolveId(employee.employee_id);
    });

    const relatedByCanonical = new Map();
    reassign.forEach((canonical, alias) => {
      if (!relatedByCanonical.has(canonical)) {
        relatedByCanonical.set(canonical, new Set());
      }
      relatedByCanonical.get(canonical).add(alias);
    });

    scenario.employees = dedupeEmployeesById(scenario.employees);
    scenario.employees.forEach((employee) => {
      const related = relatedByCanonical.get(employee.employee_id);
      if (related?.size) {
        employee.related_employee_ids = [...related].sort();
      }
    });

    flags.push({
      code: "DUPLICATE_EMPLOYEE_IDS_MERGED",
      severity: "info",
      message: `Merged ${reassign.size} alternate Employee_id value(s) into one canonical ID per matching employee name.`
    });
  }

  function buildRosterIdByName(scenario) {
    const rosterIdByName = new Map();

    function register(employeeId, name) {
      const id = normalizeEmployeeId(employeeId);
      const displayName = String(name || "").trim();
      if (!id || !displayName || looksLikeEmployeeId(displayName)) {
        return;
      }
      const nameKey = normalizeKey(displayName);
      const existing = rosterIdByName.get(nameKey);
      rosterIdByName.set(nameKey, existing ? preferCanonicalEmployeeId(existing, id) : id);
    }

    scenario.employees.forEach((employee) => {
      register(
        employee.employee_id,
        recordDisplayName({
          first_name: employee.first_name,
          last_name: employee.last_name,
          full_name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
        })
      );
    });

    scenario.shifts.forEach((shift) => register(shift.employee_id, shift.employee_name));
    scenario.pos_sales.forEach((sale) => register(sale.employee_id, sale.employee_name));

    return rosterIdByName;
  }

  function resolveActivityEmployeeIds(scenario, flags) {
    const rosterIdByName = buildRosterIdByName(scenario);
    let resolvedCount = 0;
    let unresolvedCount = 0;

    function resolveRecord(record, entity) {
      const currentId = normalizeEmployeeId(record.employee_id);
      if (currentId) {
        record.employee_id = currentId;
        registerRosterMapping(rosterIdByName, currentId, record.employee_name || recordDisplayName(record));
        return true;
      }

      const name = String(record.employee_name || recordDisplayName(record) || "").trim();
      if (!name || looksLikeEmployeeId(name)) {
        unresolvedCount += 1;
        flags.push({
          code: "MISSING_EMPLOYEE_ID",
          severity: "review",
          entity,
          message: `${entity} row skipped because Employee_id is missing and no roster match was found for "${name}".`
        });
        return false;
      }

      const rosterId = rosterIdByName.get(normalizeKey(name));
      if (!rosterId) {
        unresolvedCount += 1;
        flags.push({
          code: "MISSING_EMPLOYEE_ID",
          severity: "review",
          entity,
          message: `${entity} row skipped because Employee_id is missing and "${name}" is not on the roster sheet.`
        });
        return false;
      }

      record.employee_id = rosterId;
      resolvedCount += 1;
      return true;
    }

    function registerRosterMapping(map, employeeId, name) {
      const id = normalizeEmployeeId(employeeId);
      const displayName = String(name || "").trim();
      if (!id || !displayName || looksLikeEmployeeId(displayName)) {
        return;
      }
      map.set(normalizeKey(displayName), id);
    }

    scenario.shifts = scenario.shifts.filter((shift) => resolveRecord(shift, "shifts"));
    scenario.pos_sales = scenario.pos_sales.filter((sale) => resolveRecord(sale, "pos_sales"));

    if (resolvedCount) {
      flags.push({
        code: "EMPLOYEE_ID_RESOLVED_FROM_ROSTER",
        severity: "info",
        message: `Resolved Employee_id for ${resolvedCount} shift/sales row(s) using the roster Employee_id map.`
      });
    }

    if (unresolvedCount) {
      flags.push({
        code: "UNRESOLVED_ACTIVITY_ROWS",
        severity: "review",
        message: `Skipped ${unresolvedCount} shift/sales row(s) that had no Employee_id and no roster match.`
      });
    }
  }

  function forwardFillEmployeeIds(records) {
    let lastEmployeeId = "";

    records.forEach((record) => {
      const currentId = normalizeEmployeeId(record.employee_id);
      if (currentId) {
        lastEmployeeId = currentId;
        record.employee_id = currentId;
        return;
      }

      if (lastEmployeeId) {
        record.employee_id = lastEmployeeId;
      }
    });
  }

  function forwardFillEmployeeNames(records) {
    let lastName = "";

    records.forEach((record) => {
      const name = recordDisplayName(record);
      if (name) {
        lastName = name;
        return;
      }

      if (lastName) {
        record.full_name = lastName;
      }
    });
  }

  function mergeEmployeeRecords(existing, incoming) {
    const merged = { ...existing };
    const existingName = recordDisplayName(existing);
    const incomingName = recordDisplayName(incoming);

    if (!existingName && incomingName) {
      const names = splitFullName(incomingName);
      merged.first_name = names.first_name;
      merged.last_name = names.last_name;
    }

    if ((!merged.role || merged.role === "Server") && incoming.role) {
      merged.role = incoming.role;
    }

    if (!merged.hourly_rate && incoming.hourly_rate) {
      merged.hourly_rate = incoming.hourly_rate;
    }

    if (incoming.tip_eligible === true) {
      merged.tip_eligible = true;
    }

    return merged;
  }

  function dedupeEmployeesById(employees) {
    const byId = new Map();

    employees.forEach((employee) => {
      const employeeId = normalizeEmployeeId(employee.employee_id);
      if (!employeeId) {
        return;
      }

      employee.employee_id = employeeId;
      const existing = byId.get(employeeId);
      byId.set(employeeId, existing ? mergeEmployeeRecords(existing, employee) : employee);
    });

    return [...byId.values()];
  }

  function buildEmployeeFromActivitySource(employeeId, source) {
    const name = String(source.employee_name || recordDisplayName(source) || "").trim();
    const names =
      name && !looksLikeEmployeeId(name) ? splitFullName(name) : { first_name: "", last_name: "" };
    const role = source.role || "Server";
    const hourlyRate = toNumber(source.hourly_rate);

    return {
      employee_id: employeeId,
      first_name: names.first_name,
      last_name: names.last_name,
      role,
      hourly_rate: hourlyRate ?? 0,
      tip_eligible: ["Server", "Bartender"].includes(role)
    };
  }

  function enrichEmployeeFromActivity(employee, source) {
    const name = String(source.employee_name || recordDisplayName(source) || "").trim();
    if (name && !looksLikeEmployeeId(name)) {
      const existingName = recordDisplayName(employee);
      if (!existingName) {
        const names = splitFullName(name);
        employee.first_name = names.first_name;
        employee.last_name = names.last_name;
      }
    }

    if ((!employee.role || employee.role === "Server") && source.role) {
      employee.role = source.role;
    }

    if (!employee.hourly_rate && toNumber(source.hourly_rate) !== null) {
      employee.hourly_rate = toNumber(source.hourly_rate);
    }

    if (source.credit_card_tips !== undefined || source.net_sales !== undefined) {
      employee.tip_eligible = true;
    }
  }

  function syncEmployeesFromActivity(scenario, flags) {
    const employeeById = new Map(
      dedupeEmployeesById(scenario.employees).map((employee) => [employee.employee_id, employee])
    );
    const rosterCount = employeeById.size;
    let added = 0;

    function noteActivity(employeeId, source) {
      const id = normalizeEmployeeId(employeeId);
      if (!id) {
        return;
      }

      if (!employeeById.has(id)) {
        employeeById.set(id, buildEmployeeFromActivitySource(id, source));
        added += 1;
        return;
      }

      enrichEmployeeFromActivity(employeeById.get(id), source);
    }

    scenario.shifts.forEach((shift) => noteActivity(shift.employee_id, shift));
    scenario.pos_sales.forEach((sale) => noteActivity(sale.employee_id, sale));

    scenario.employees = [...employeeById.values()];

    if (!rosterCount && scenario.employees.length) {
      flags.push({
        code: "EMPLOYEES_DERIVED_FROM_ACTIVITY",
        severity: "review",
        message:
          "No employee roster sheet was found. Employee records were derived from shift and sales data."
      });
      return;
    }

    if (added) {
      flags.push({
        code: "EMPLOYEES_ADDED_FROM_ACTIVITY",
        severity: "review",
        message: `Added ${added} employee record(s) from shift/sales data that were missing from the roster sheet.`
      });
    }
  }

  function dedupeShifts(shifts, flags) {
    const seen = new Map();
    const unique = [];
    let duplicateCount = 0;

    shifts.forEach((shift) => {
      const key = [
        shift.employee_id,
        shift.shift_date,
        shift.hours_worked,
        shift.clock_in,
        shift.clock_out
      ].join("|");
      if (seen.has(key)) {
        duplicateCount += 1;
        return;
      }
      seen.set(key, true);
      unique.push(shift);
    });

    if (duplicateCount) {
      flags.push({
        code: "DUPLICATE_SHIFT",
        severity: "review",
        message: `Removed ${duplicateCount} duplicate shift row(s) with matching employee, date, hours, and clock times.`
      });
    }

    return unique;
  }

  function saleDedupeKey(sale) {
    const transactionId = String(sale.transaction_id || "").trim();
    const autoTransaction = /^AUTO-T\d+$/i.test(transactionId);

    return [
      sale.employee_id,
      sale.shift_date,
      autoTransaction ? "" : transactionId,
      sale.net_sales,
      sale.credit_card_tips,
      sale.cash_tips
    ].join("|");
  }

  function dedupePosSales(sales, flags) {
    const seen = new Map();
    const unique = [];
    let duplicateCount = 0;

    sales.forEach((sale) => {
      const key = saleDedupeKey(sale);
      if (seen.has(key)) {
        duplicateCount += 1;
        return;
      }
      seen.set(key, true);
      unique.push(sale);
    });

    if (duplicateCount) {
      flags.push({
        code: "DUPLICATE_SALE",
        severity: "review",
        message: `Removed ${duplicateCount} duplicate sales row(s) with matching employee, transaction, and tip amounts.`
      });
    }

    return unique;
  }

  function ensureAllReferencedEmployees(scenario, flags) {
    const employeeIds = new Set(
      scenario.employees.map((employee) => normalizeEmployeeId(employee.employee_id)).filter(Boolean)
    );
    let added = 0;

    function ensure(employeeId, source) {
      const resolvedId = normalizeEmployeeId(employeeId);
      if (!resolvedId || employeeIds.has(resolvedId)) {
        return;
      }

      if (source) {
        source.employee_id = resolvedId;
      }

      scenario.employees.push(
        buildEmployeeFromActivitySource(resolvedId, source || { employee_id: resolvedId })
      );
      employeeIds.add(resolvedId);
      added += 1;
    }

    scenario.shifts.forEach((shift) => ensure(shift.employee_id, shift));
    scenario.pos_sales.forEach((sale) => ensure(sale.employee_id, sale));

    if (added) {
      flags.push({
        code: "EMPLOYEES_AUTO_CREATED",
        severity: "review",
        message: `Auto-created ${added} employee record(s) for Employee_id values found in shift/sales rows but missing from the roster.`
      });
    }
  }

  function defaultEmployeeFields(scenario, flags) {
    let missingRoles = 0;

    scenario.employees.forEach((employee) => {
      if (!employee.role) {
        employee.role = "Server";
        missingRoles += 1;
      }

      if (!Number.isFinite(Number(employee.hourly_rate))) {
        employee.hourly_rate = 0;
      }
    });

    if (missingRoles) {
      flags.push({
        code: "MISSING_ROLE_DEFAULTED",
        severity: "review",
        message: `Defaulted missing role to Server for ${missingRoles} employee(s).`
      });
    }
  }

  function finalizeScenario(scenario, flags) {
    scenario.employees = dedupeEmployeesById(scenario.employees);
    resolveActivityEmployeeIds(scenario, flags);
    syncEmployeesFromActivity(scenario, flags);
    deriveShiftsFromSales(scenario, flags);
    enrichEmployeeNamesFromActivity(scenario, flags);
    scenario.employees = dedupeEmployeesById(scenario.employees);
    mergeEmployeesByName(scenario, flags);
    resolveActivityEmployeeIds(scenario, flags);
    syncEmployeesFromActivity(scenario, flags);
    ensureAllReferencedEmployees(scenario, flags);
    defaultEmployeeFields(scenario, flags);
    scenario.employees = dedupeEmployeesById(scenario.employees);
    mergeEmployeesByName(scenario, flags);
    scenario.shifts = dedupeShifts(scenario.shifts, flags);
    scenario.pos_sales = dedupePosSales(scenario.pos_sales, flags);
    repairCrossReferences(scenario, flags);
  }

  function repairCrossReferences(scenario, flags) {
    ensureAllReferencedEmployees(scenario, flags);
    defaultEmployeeFields(scenario, flags);
    scenario.employees = dedupeEmployeesById(scenario.employees);

    const employeeIds = new Set(scenario.employees.map((employee) => employee.employee_id));

    scenario.shifts.forEach((shift) => {
      if (shift.employee_id && !employeeIds.has(shift.employee_id)) {
        flags.push({
          code: "UNRESOLVED_SHIFT_EMPLOYEE",
          severity: "review",
          employee_id: shift.employee_id,
          shift_id: shift.shift_id,
          message: `Shift references employee_id ${shift.employee_id} that could not be resolved to a roster row.`
        });
      }
    });

    scenario.pos_sales.forEach((sale) => {
      if (sale.employee_id && !employeeIds.has(sale.employee_id)) {
        flags.push({
          code: "UNRESOLVED_SALE_EMPLOYEE",
          severity: "review",
          employee_id: sale.employee_id,
          transaction_id: sale.transaction_id,
          message: `Sales row references employee_id ${sale.employee_id} that could not be resolved to a roster row.`
        });
      }
    });
  }

  function validateCrossReferences(scenario, flags) {
    repairCrossReferences(scenario, flags);
  }

  function looksLikeStructuredScenario(text) {
    const trimmed = text.trim();
    return (
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      /\bexport\s+const\b/.test(trimmed) ||
      (trimmed.includes("\"employees\"") && trimmed.includes("\"shifts\""))
    );
  }

  function ingest(rawText, structuredParser) {
    const flags = [];
    const mappings = [];
    const trimmed = String(rawText || "").trim();

    if (!trimmed) {
      return {
        agent: "data_ingestion",
        status: "failed",
        detected_format: "empty",
        flags: [{ code: "EMPTY_INPUT", severity: "blocking", message: "No input provided." }],
        scenario: null
      };
    }

    if (looksLikeStructuredScenario(trimmed) && structuredParser) {
      try {
        const scenario = structuredParser(trimmed);
        finalizeScenario(scenario, flags);
        return {
          agent: "data_ingestion",
          status: flags.some((flag) => flag.severity === "blocking") ? "blocked" : "success",
          detected_format: "structured_json_or_export_const",
          mappings: [{ section: "structured", mapping: "existing parser" }],
          flags,
          scenario,
          summary: {
            employees: scenario.employees.length,
            shifts: scenario.shifts.length,
            pos_sales: scenario.pos_sales.length,
            flag_count: flags.length,
            sections: 1
          }
        };
      } catch (error) {
        flags.push({
          code: "STRUCTURED_PARSE_FAILED",
          severity: "blocking",
          message: error.message
        });
      }
    }

    const sections = splitSections(trimmed);
    const scenario = {
      scenario_id: "ingested-scenario",
      scenario_name: "Ingested payroll scenario",
      employees: [],
      shifts: [],
      pos_sales: [],
      payroll_rules: {}
    };

    sections.forEach((section) => {
      const part = ingestTable(section.label, section.body, flags, mappings);
      scenario.employees.push(...part.employees);
      scenario.shifts.push(...part.shifts);
      scenario.pos_sales.push(...part.pos_sales);
    });

    finalizeScenario(scenario, flags);

    const blocking = flags.some((flag) => flag.severity === "blocking");
    const hasData =
      scenario.employees.length > 0 || scenario.shifts.length > 0 || scenario.pos_sales.length > 0;

    return {
      agent: "data_ingestion",
      status: !hasData ? "failed" : blocking ? "blocked" : flags.length ? "partial" : "success",
      detected_format: sections.length > 1 ? "sectioned_csv" : "csv_or_tsv",
      mappings,
      flags,
      scenario: hasData ? scenario : null,
      summary: {
        employees: scenario.employees.length,
        shifts: scenario.shifts.length,
        pos_sales: scenario.pos_sales.length,
        flag_count: flags.length,
        sections: sections.length
      }
    };
  }

  return { ingest, finalizeScenario, parseDelimitedTable, mapHeader, detectDatasetType };
})();
