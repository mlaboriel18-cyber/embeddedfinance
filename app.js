const employees = [
  { employee_id: "E001", first_name: "Maya", last_name: "Rivera", role: "Server", hourly_rate: 10.65, tip_eligible: true },
  { employee_id: "E002", first_name: "Jordan", last_name: "Lee", role: "Server", hourly_rate: 10.65, tip_eligible: true },
  { employee_id: "E003", first_name: "Andre", last_name: "Brooks", role: "Server", hourly_rate: 10.65, tip_eligible: true },
  { employee_id: "E004", first_name: "Sofia", last_name: "Martinez", role: "Bartender", hourly_rate: 12.00, tip_eligible: true },
  { employee_id: "E005", first_name: "Nia", last_name: "Thomas", role: "Host", hourly_rate: 16.00, tip_eligible: false },
  { employee_id: "E006", first_name: "Carlos", last_name: "Reyes", role: "Cook", hourly_rate: 22.00, tip_eligible: false },
  { employee_id: "E007", first_name: "Elena", last_name: "Nguyen", role: "Cook", hourly_rate: 22.00, tip_eligible: false },
  { employee_id: "E008", first_name: "Marcus", last_name: "Green", role: "Dishwasher", hourly_rate: 18.00, tip_eligible: false },
  { employee_id: "E009", first_name: "Priya", last_name: "Patel", role: "Manager", hourly_rate: 30.00, tip_eligible: false },
  { employee_id: "E010", first_name: "Chris", last_name: "Johnson", role: "Server", hourly_rate: 10.65, tip_eligible: true }
];

const shifts = [
  { employee_id: "E001", hours_worked: 8.0 },
  { employee_id: "E001", hours_worked: 8.5 },
  { employee_id: "E001", hours_worked: 9.5 },
  { employee_id: "E002", hours_worked: 7.0 },
  { employee_id: "E002", hours_worked: 6.5 },
  { employee_id: "E002", hours_worked: 8.0 },
  { employee_id: "E003", hours_worked: 7.5 },
  { employee_id: "E003", hours_worked: 8.5 },
  { employee_id: "E004", hours_worked: 8.5 },
  { employee_id: "E004", hours_worked: 9.0 },
  { employee_id: "E004", hours_worked: 10.5 },
  { employee_id: "E005", hours_worked: 5.0 },
  { employee_id: "E006", hours_worked: 8.0 },
  { employee_id: "E007", hours_worked: 9.0 },
  { employee_id: "E008", hours_worked: 6.5 },
  { employee_id: "E009", hours_worked: 9.0 }
];

const posSales = [
  { employee_id: "E001", net_sales: 1195.50, credit_card_tips: 210.25, cash_tips: 35.00 },
  { employee_id: "E001", net_sales: 1326.25, credit_card_tips: 242.10, cash_tips: 48.00 },
  { employee_id: "E001", net_sales: 1480.20, credit_card_tips: 265.50, cash_tips: 52.00 },
  { employee_id: "E002", net_sales: 960.00, credit_card_tips: 170.00, cash_tips: 25.00 },
  { employee_id: "E002", net_sales: 1060.60, credit_card_tips: 185.75, cash_tips: 30.00 },
  { employee_id: "E002", net_sales: 1350.00, credit_card_tips: 260.00, cash_tips: 45.00 },
  { employee_id: "E003", net_sales: 850.00, credit_card_tips: 145.00, cash_tips: 20.00 },
  { employee_id: "E003", net_sales: 1200.00, credit_card_tips: 225.00, cash_tips: 0.00 },
  { employee_id: "E004", net_sales: 1750.00, credit_card_tips: 320.00, cash_tips: 80.00 },
  { employee_id: "E004", net_sales: 1960.00, credit_card_tips: 375.00, cash_tips: 95.00 },
  { employee_id: "E004", net_sales: 2350.00, credit_card_tips: 480.00, cash_tips: 120.00 }
];

const payrollRules = {
  weekly_regular_hour_cap: 40,
  overtime_multiplier: 1.5,
  tip_out_rates: {
    Server: 0.03,
    Bartender: 0.02,
    Host: 0,
    Cook: 0,
    Dishwasher: 0,
    Manager: 0
  }
};

const sampleScenario = {
  scenario_id: "ct-sample-payroll",
  scenario_name: "Connecticut sample payroll",
  employees,
  shifts,
  pos_sales: posSales,
  payroll_rules: payrollRules
};

let activeScenario = null;
let uploadedSources = [];

function isExcelFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");
}


function combineUploadedSources(sources) {
  if (!sources.length) {
    return { name: null, text: null, format: null, fileCount: 0, sectionCount: 0 };
  }

  if (sources.length === 1) {
    const source = sources[0];
    const sectionCount = (source.text.match(/^#{1,3}\s/mg) || []).length || 1;
    return {
      name: source.name,
      text: source.text,
      format: source.format,
      fileCount: 1,
      sectionCount
    };
  }

  const combinedText = sources
    .map((source) => {
      const sections = source.text.split(/\n\n(?=#)/);
      return sections
        .map((section) => {
          const trimmed = section.trim();
          if (!trimmed) {
            return "";
          }
          if (trimmed.startsWith("#")) {
            return trimmed.replace(/^#\s*/, `# ${source.name} :: `);
          }
          return `# ${source.name}\n${trimmed}`;
        })
        .filter(Boolean)
        .join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n\n");

  const sectionCount = (combinedText.match(/^#{1,3}\s/mg) || []).length || sources.length;
  const totalSheets = sources.reduce((sum, source) => sum + (source.sheetCount || 0), 0);
  const excelSources = sources.filter((source) => source.format?.startsWith("excel"));

  return {
    name: `${sources.length} files (${sources.map((source) => source.name).join(", ")})`,
    text: combinedText,
    format: excelSources.length
      ? `batch (${sources.length} files, ${totalSheets || sectionCount} section${(totalSheets || sectionCount) === 1 ? "" : "s"})`
      : `batch (${sources.length} files, ${sectionCount} section${sectionCount === 1 ? "" : "s"})`,
    fileCount: sources.length,
    sectionCount
  };
}

async function readUploadedFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) {
    return [];
  }

  const sources = [];
  for (const file of files) {
    if (!isExcelFile(file)) {
      sources.push({
        name: file.name,
        text: await file.text(),
        format: null,
        sheetCount: 0
      });
      continue;
    }

    if (typeof XLSX === "undefined") {
      throw new Error("Excel parser failed to load. Refresh the page and try again.");
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    if (!workbook.SheetNames.length) {
      throw new Error(`${file.name} contains no worksheets.`);
    }

    const sections = workbook.SheetNames.map((sheetName) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false }).trim();
      return csv ? `# ${file.name} :: ${sheetName}\n${csv}` : "";
    }).filter(Boolean);

    if (!sections.length) {
      throw new Error(`${file.name} worksheets are empty.`);
    }

    sources.push({
      name: file.name,
      text: sections.join("\n\n"),
      format: `excel (${workbook.SheetNames.length} sheet${workbook.SheetNames.length === 1 ? "" : "s"})`,
      sheetCount: workbook.SheetNames.length
    });
  }

  return sources;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sumByEmployee(records, valueKey) {
  return records.reduce((totals, record) => {
    totals[record.employee_id] = (totals[record.employee_id] || 0) + Number(record[valueKey] || 0);
    return totals;
  }, {});
}

function splitCentsEvenly(totalAmount, recipients) {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / recipients.length);
  const remainder = totalCents % recipients.length;

  return recipients.reduce((allocations, employee, index) => {
    allocations[employee.employee_id] = roundMoney((baseCents + (index < remainder ? 1 : 0)) / 100);
    return allocations;
  }, {});
}

function getRecipients(mode, hoursByEmployee, scenarioEmployees) {
  const activeEmployees = scenarioEmployees.filter((employee) => (hoursByEmployee[employee.employee_id] || 0) > 0);

  if (mode === "activeNonManager") {
    return activeEmployees.filter((employee) => employee.role !== "Manager");
  }

  if (mode === "allActive") {
    return activeEmployees;
  }

  return activeEmployees.filter((employee) => employee.tip_eligible);
}

function findLiteralEnd(source, startIndex) {
  const opener = source[startIndex];
  const matching = { "{": "}", "[": "]" };
  const stack = [matching[opener]];
  let quote = null;
  let escaped = false;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(matching[char]);
      continue;
    }

    if (char === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) {
        return index + 1;
      }
    }
  }

  throw new Error("Could not find the end of an export const literal.");
}

function extractConstLiteral(source, constName) {
  const pattern = new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*=`, "m");
  const match = source.match(pattern);

  if (!match || match.index === undefined) {
    return null;
  }

  let literalStart = match.index + match[0].length;
  while (/\s/.test(source[literalStart])) {
    literalStart += 1;
  }

  if (!["{", "["].includes(source[literalStart])) {
    throw new Error(`${constName} must be assigned to an object or array literal.`);
  }

  return source.slice(literalStart, findLiteralEnd(source, literalStart));
}

function stripJavaScriptComments(source) {
  let result = "";
  let quote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        index += 1;
      } else if (char === "\n") {
        result += char;
      }
      continue;
    }

    if (quote) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function parseLooseLiteral(literal) {
  const jsonish = stripJavaScriptComments(literal)
    .trim()
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => `"${value.replace(/"/g, '\\"')}"`)
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(jsonish);
}

function parseExportConstScenario(source) {
  const employeesLiteral = extractConstLiteral(source, "employees");
  const shiftsLiteral = extractConstLiteral(source, "shifts");
  const posSalesLiteral =
    extractConstLiteral(source, "pos_sales") || extractConstLiteral(source, "posSales");
  const payrollRulesLiteral =
    extractConstLiteral(source, "payrollRules") || extractConstLiteral(source, "payroll_rules");

  if (!employeesLiteral && !shiftsLiteral && !posSalesLiteral && !payrollRulesLiteral) {
    throw new Error("Expected JSON or export const declarations for employees, shifts, and pos_sales.");
  }

  return {
    scenario_id: "imported-export-const-scenario",
    scenario_name: "Imported export const scenario",
    employees: employeesLiteral ? parseLooseLiteral(employeesLiteral) : [],
    shifts: shiftsLiteral ? parseLooseLiteral(shiftsLiteral) : [],
    pos_sales: posSalesLiteral ? parseLooseLiteral(posSalesLiteral) : [],
    payroll_rules: payrollRulesLiteral ? parseLooseLiteral(payrollRulesLiteral) : payrollRules
  };
}

function parseScenarioText(source) {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    throw new Error("Scenario input is empty.");
  }

  try {
    return JSON.parse(trimmedSource);
  } catch (jsonError) {
    if (/\bexport\s+const\b|\bconst\s+/.test(trimmedSource)) {
      try {
        return parseExportConstScenario(trimmedSource);
      } catch (importError) {
        throw new Error(`Could not import export const scenario: ${importError.message}`);
      }
    }

    throw jsonError;
  }
}

function normalizeScenario(rawScenario) {
  const scenario = rawScenario && typeof rawScenario === "object" ? rawScenario : {};
  const rules = scenario.payroll_rules || scenario.payrollRules || {};

  return {
    scenario_id: scenario.scenario_id || scenario.scenarioId || "custom-scenario",
    scenario_name: scenario.scenario_name || scenario.scenarioName || "Custom scenario",
    employees: Array.isArray(scenario.employees) ? scenario.employees : [],
    shifts: Array.isArray(scenario.shifts) ? scenario.shifts : [],
    pos_sales: Array.isArray(scenario.pos_sales)
      ? scenario.pos_sales
      : Array.isArray(scenario.posSales)
        ? scenario.posSales
        : [],
    payroll_rules: {
      ...payrollRules,
      ...rules,
      tip_out_rates: {
        ...payrollRules.tip_out_rates,
        ...(rules.tip_out_rates || rules.tipOutRates || {})
      }
    }
  };
}

function validateScenario(scenario) {
  const errors = [];

  if (!scenario.employees.length && !scenario.shifts.length && !scenario.pos_sales.length) {
    errors.push("No recognizable payroll data was found in the upload.");
    return errors;
  }

  if (!scenario.employees.length) {
    errors.push(
      `No employees could be resolved. Found ${scenario.shifts.length} shifts and ${scenario.pos_sales.length} sales rows — check for an Employee or Employee_id column.`
    );
  }

  if (!scenario.shifts.length && !scenario.pos_sales.length) {
    errors.push(
      `No shift hours or sales/tip rows found. Found ${scenario.employees.length} employees — include hours or sales data.`
    );
  }

  return errors;
}

const REVIEW_FLAG_LABELS = {
  TIP_ALLOCATION_MISMATCH: "Tip allocation mismatch",
  TIP_ALLOCATION_CRITICAL: "Critical allocation gap",
  TIP_ALLOCATION_ROW_MISMATCH: "Row allocation mismatch",
  TIP_ALLOCATION_ROW_CRITICAL: "Critical row allocation gap",
  MANUAL_TIP_ADJUSTMENT: "Manual tip adjustment",
  MISSING_TIP_ALLOCATION: "Missing tip allocation",
  OVERTIME_HOURS: "Overtime hours",
  TIP_TOTAL_MISMATCH: "Tip total mismatch",
  CASH_TIP_HEAVY: "Cash-heavy tips",
  LOW_SALES_PER_HOUR: "Low sales/hour",
  HIGH_SALES_PER_HOUR: "High sales/hour",
  MISSING_TIPS_ON_TIPPED_ROLE: "Missing tips",
  DUPLICATE_SHIFT_PATTERN: "Duplicate shift",
  EXCESSIVE_SHIFT_LENGTH: "Excessive shift length",
  CHECK_LEVEL_TIP_SPIKE: "Check-level tip spike",
  DUPLICATE_EMPLOYEE_RECORD: "Duplicate employee record",
  EMPLOYEE_ID_DERIVED_FROM_NAME: "Derived employee ID",
  MISSING_HOURS: "Missing hours",
  UNKNOWN_SHIFT_EMPLOYEE: "Unknown shift employee",
  UNKNOWN_SALE_EMPLOYEE: "Unknown sale employee",
  MINIMUM_WAGE_SHORTFALL: "Below minimum wage"
};

function summarizeEmployeeReviewReasons(row) {
  const reasons = (row.review_flags || []).map((flag) => ({
    code: flag.code,
    source: flag.source,
    severity: flag.severity || "review",
    label: REVIEW_FLAG_LABELS[flag.code] || flag.code.replace(/_/g, " ").toLowerCase(),
    message: flag.message,
    likely_cause: flag.likely_cause || ""
  }));

  if (row.status === "requires_review" && row.minimum_wage_compliant === false) {
    reasons.push({
      code: "MINIMUM_WAGE_SHORTFALL",
      source: "payroll",
      severity: "blocking",
      label: REVIEW_FLAG_LABELS.MINIMUM_WAGE_SHORTFALL,
      message: `Effective rate ${currency.format(row.effective_hourly_rate)}/hr is below the configured minimum wage.`,
      likely_cause: "Tip credit or allocation may leave this employee under minimum wage."
    });
  }

  if (row.status === "no_shifts_in_period") {
    reasons.push({
      code: "NO_SHIFTS",
      source: "payroll",
      severity: "review",
      label: "No shifts",
      message: "No hours recorded in the pay period.",
      likely_cause: "Missing timecard data or inactive employee."
    });
  }

  const seen = new Set();
  const unique = reasons.filter((reason) => {
    const key = `${reason.code}|${reason.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const grouped = new Map();
  unique.forEach((reason) => {
    if (!grouped.has(reason.code)) {
      grouped.set(reason.code, { ...reason, count: 1 });
      return;
    }

    const existing = grouped.get(reason.code);
    existing.count += 1;
  });

  return [...grouped.values()].map((reason) => ({
    ...reason,
    message:
      reason.count > 1
        ? `${reason.label} flagged across ${reason.count} records. ${reason.message}`
        : reason.message
  }));
}

function formatReviewReasonsCell(row) {
  const reasons = row.review_reasons || [];

  if (!reasons.length) {
    return `<span class="muted-text">—</span>`;
  }

  return `<ul class="review-reason-list">${reasons
    .map((reason) => {
      const severityClass =
        reason.severity === "critical" || reason.severity === "blocking"
          ? "critical"
          : reason.severity === "info"
            ? "info"
            : "review";
      return `<li class="review-reason ${severityClass}">
        <span class="reason-tag ${severityClass}">${escapeHtml(reason.label)}</span>
        <span class="reason-detail">${escapeHtml(reason.message)}</span>
      </li>`;
    })
    .join("")}</ul>`;
}

function payrollRowClass(row) {
  if (row.status === "critical_review") {
    return "payroll-row critical";
  }
  if (row.status === "requires_review" || row.status === "no_shifts_in_period") {
    return "payroll-row review";
  }
  return "payroll-row compliant";
}

function sortPayrollRows(rows) {
  const rank = {
    critical_review: 0,
    requires_review: 1,
    no_shifts_in_period: 2,
    compliant: 3
  };

  return rows.slice().sort((left, right) => {
    const leftRank = rank[left.status] ?? 4;
    const rightRank = rank[right.status] ?? 4;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return String(left.display_name || left.employee_id).localeCompare(
      String(right.display_name || right.employee_id)
    );
  });
}

function buildEmployeesRequiringReview(employeePayroll) {
  return employeePayroll
    .filter(
      (row) =>
        row.status === "no_shifts_in_period" ||
        isFraudVerdictBlocking(row.fraud_verdict) ||
        row.fraud_verdict === "advisory"
    )
    .map((row) => ({
      employee_id: row.employee_id,
      name: row.display_name || row.name || "Name unavailable",
      employee_label: row.employee_label || row.employee_id,
      role: row.role,
      status: row.status,
      anomaly_findings: row.anomaly_findings || [],
      reasons: (row.review_reasons || []).map((reason) => ({
        code: reason.code,
        label: reason.label,
        severity: reason.severity,
        message: reason.message,
        likely_cause: reason.likely_cause || undefined
      }))
    }));
}

function buildEmployeeReviewFlags(ingestionAudit, anomalyAudit) {
  const byEmployee = new Map();

  function addFlag(employeeId, flag) {
    if (!employeeId) {
      return;
    }

    if (!byEmployee.has(employeeId)) {
      byEmployee.set(employeeId, []);
    }

    const existing = byEmployee.get(employeeId);
    const duplicate = existing.some(
      (entry) => entry.source === flag.source && entry.code === flag.code && entry.message === flag.message
    );
    if (!duplicate) {
      existing.push(flag);
    }
  }

  (ingestionAudit?.flags || []).forEach((flag) => {
    if (!flag.employee_id) {
      return;
    }

    addFlag(flag.employee_id, {
      source: "ingestion",
      code: flag.code,
      severity: flag.severity || "review",
      message: flag.message
    });
  });

  (anomalyAudit?.findings || []).forEach((finding) => {
    const flag = {
      source: "anomaly",
      code: finding.code,
      severity: finding.severity || "review",
      message: finding.message,
      likely_cause: finding.likely_cause,
      employee_name: finding.employee_name,
      employee_label: finding.employee_label
    };

    if (finding.employee_id) {
      addFlag(finding.employee_id, flag);
    }

    (finding.employee_ids || []).forEach((employeeId) => addFlag(employeeId, flag));
  });

  return byEmployee;
}

function resolveEmployeePayrollStatus(minimumWageCompliant, reviewFlags) {
  const hasCritical = reviewFlags.some((flag) => ["critical", "blocking"].includes(flag.severity));
  const hasReview = reviewFlags.some((flag) =>
    ["critical", "blocking", "review", "info"].includes(flag.severity)
  );

  if (hasCritical) {
    return "critical_review";
  }

  if (!minimumWageCompliant || hasReview) {
    return "requires_review";
  }

  return "compliant";
}

function formatEmployeeStatusPill(row) {
  if (row.status === "no_shifts_in_period") {
    return { className: "warn", text: "No shifts", title: "No hours recorded in the pay period." };
  }

  const flags = row.review_flags || [];
  const title = flags.length
    ? flags
        .map((flag) => `${REVIEW_FLAG_LABELS[flag.code] || flag.code}: ${flag.message}`)
        .join("\n")
    : row.status === "requires_review"
      ? "Minimum wage top-up applied or compliance review required."
      : "No ingestion or anomaly flags for this employee.";

  if (row.status === "critical_review") {
    return { className: "block", text: flags.length ? `Critical (${flags.length})` : "Critical", title };
  }

  if (row.status === "requires_review") {
    return { className: "warn", text: flags.length ? `Review (${flags.length})` : "Review", title };
  }

  return { className: "ok", text: "Compliant", title };
}

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

function buildEmployeeDirectory(scenario) {
  const normalized = normalizeScenario(scenario);
  const directory = new Map();

  normalized.employees.forEach((employee) => {
    directory.set(employee.employee_id, {
      employee_id: employee.employee_id,
      display_name: resolveEmployeeDisplayName(employee, normalized),
      role: employee.role || ""
    });
  });

  const noteActivityRecord = (record) => {
    const employeeId = record.employee_id;
    if (!employeeId || directory.has(employeeId)) {
      return;
    }

    const displayName =
      record.employee_name && !looksLikeEmployeeId(record.employee_name)
        ? String(record.employee_name).trim()
        : "";

    directory.set(employeeId, {
      employee_id: employeeId,
      display_name: displayName,
      role: record.role || ""
    });
  };

  normalized.shifts.forEach(noteActivityRecord);
  normalized.pos_sales.forEach(noteActivityRecord);

  return directory;
}

function nameFromDerivedEmployeeId(employeeId) {
  if (!/^EMP-/i.test(String(employeeId || ""))) {
    return "";
  }

  return String(employeeId)
    .replace(/^EMP-/i, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getEmployeeIdentity(employeeId, directory, reviewFlags = []) {
  const entry = directory instanceof Map ? directory.get(employeeId) : null;
  let displayName = entry?.display_name && !looksLikeEmployeeId(entry.display_name) ? entry.display_name : "";

  if (!displayName) {
    displayName = nameFromDerivedEmployeeId(employeeId);
  }

  if (!displayName) {
    const derivedFlag = reviewFlags.find((flag) => flag.code === "EMPLOYEE_ID_DERIVED_FROM_NAME");
    const match = derivedFlag?.message?.match(/employee name "([^"]+)"/i);
    if (match?.[1]) {
      displayName = match[1];
    }
  }

  if (!displayName) {
    const namedFlag = reviewFlags.find((flag) => flag.employee_name && !looksLikeEmployeeId(flag.employee_name));
    displayName = namedFlag?.employee_name || "";
  }

  return {
    employee_id: employeeId,
    display_name: displayName,
    role: entry?.role || "",
    label: displayName ? `${displayName} · ${employeeId}` : employeeId
  };
}

const FRAUD_VERDICT_RANK = {
  critical_review_required: 4,
  review_recommended: 3,
  advisory: 2,
  compliant: 1
};

function collectReviewFlags(employeeReviewFlags, employeeId, relatedIds = []) {
  const merged = [];
  const seen = new Set();

  [employeeId, ...(relatedIds || [])].filter(Boolean).forEach((id) => {
    (employeeReviewFlags.get(id) || []).forEach((flag) => {
      const key = `${flag.code}|${flag.message}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(flag);
    });
  });

  return merged;
}

function normalizePayrollName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function preferCanonicalEmployeeId(left, right) {
  const leftId = String(left || "").trim();
  const rightId = String(right || "").trim();
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

function mergePayrollRows(rows) {
  if (rows.length <= 1) {
    return rows[0];
  }

  const canonicalId = rows.reduce(
    (best, row) => preferCanonicalEmployeeId(best, row.employee_id),
    rows[0].employee_id
  );
  const primary = rows.find((row) => row.employee_id === canonicalId) || rows[0];
  const relatedIds = [
    ...new Set(
      rows.flatMap((row) => [row.employee_id, ...(row.related_employee_ids || [])]).filter((id) => id !== canonicalId)
    )
  ].sort();

  const merged = {
    ...primary,
    employee_id: canonicalId,
    related_employee_ids: relatedIds,
    review_flags: [],
    anomaly_findings: [],
    review_reasons: []
  };

  const sumFields = [
    "hours",
    "regular_pay",
    "overtime_pay",
    "reported_tips",
    "source_tip_out",
    "tip_out_received",
    "net_tips",
    "minimum_wage_top_up",
    "gross_pay",
    "employer_cash_disbursement"
  ];

  rows.forEach((row) => {
    sumFields.forEach((field) => {
      merged[field] = roundMoney((merged[field] || 0) + (row[field] || 0));
    });
    merged.review_flags.push(...(row.review_flags || []));
    merged.anomaly_findings.push(...(row.anomaly_findings || []));
  });

  if (merged.hours > 0) {
    merged.effective_hourly_rate = roundMoney(merged.gross_pay / merged.hours);
    merged.minimum_wage_compliant = merged.effective_hourly_rate >= (primary.minimum_wage_used || merged.effective_hourly_rate);
  }

  let worstVerdict = rows[0];
  rows.forEach((row) => {
    if ((FRAUD_VERDICT_RANK[row.fraud_verdict] || 0) > (FRAUD_VERDICT_RANK[worstVerdict.fraud_verdict] || 0)) {
      worstVerdict = row;
    }
  });
  merged.fraud_verdict = worstVerdict.fraud_verdict;
  merged.fraud_status_label = worstVerdict.fraud_status_label;
  merged.fraud_status_class = worstVerdict.fraud_status_class;
  merged.fraud_status_summary = worstVerdict.fraud_status_summary;
  merged.review_reasons = summarizeEmployeeReviewReasons(merged);

  return merged;
}

function consolidatePayrollRows(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const nameKey =
      row.display_name && !looksLikeEmployeeId(row.display_name)
        ? normalizePayrollName(row.display_name)
        : `id:${row.employee_id}`;
    if (!groups.has(nameKey)) {
      groups.set(nameKey, []);
    }
    groups.get(nameKey).push(row);
  });

  return [...groups.values()].map((group) => (group.length === 1 ? group[0] : mergePayrollRows(group)));
}

function getFraudVerdictForEmployee(anomalyAudit, employeeId, relatedIds = []) {
  const ids = [employeeId, ...(relatedIds || [])].filter(Boolean);
  let best = null;

  ids.forEach((id) => {
    const verdict = anomalyAudit?.employee_verdicts?.[id];
    if (!verdict) {
      return;
    }
    if (!best || (FRAUD_VERDICT_RANK[verdict.verdict] || 0) > (FRAUD_VERDICT_RANK[best.verdict] || 0)) {
      best = verdict;
    }
  });

  if (best) {
    return best;
  }

  return {
    employee_id: employeeId,
    verdict: "compliant",
    label: "Compliant",
    status_class: "ok",
    finding_count: 0,
    findings: [],
    summary: "No anomaly or fraud findings for this employee."
  };
}

function buildAnomalyFindingsByEmployee(anomalyAudit) {
  return anomalyAudit?.findings_by_employee || {};
}

function resolveEmployeeDisplayName(employee, scenario) {
  const fromRecord = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  if (fromRecord && !looksLikeEmployeeId(fromRecord)) {
    return fromRecord;
  }

  const candidates = [];
  scenario.shifts.forEach((shift) => {
    if (shift.employee_id === employee.employee_id && shift.employee_name) {
      candidates.push(String(shift.employee_name).trim());
    }
  });
  scenario.pos_sales.forEach((sale) => {
    if (sale.employee_id === employee.employee_id && sale.employee_name) {
      candidates.push(String(sale.employee_name).trim());
    }
  });

  const validNames = candidates.filter((name) => name && !looksLikeEmployeeId(name));
  if (validNames.length) {
    return validNames.sort((left, right) => right.length - left.length)[0];
  }

  return nameFromDerivedEmployeeId(employee.employee_id);
}

function formatPayrollEmployeeName(row) {
  const name = (row.display_name || row.name || nameFromDerivedEmployeeId(row.employee_id) || "").trim();
  if (name && !looksLikeEmployeeId(name)) {
    return escapeHtml(name);
  }
  return `<span class="muted-text">Name unavailable</span>`;
}

function formatPayrollEmployeeId(row) {
  return escapeHtml(row.employee_id);
}

function isFraudVerdictBlocking(verdict) {
  return verdict === "review_recommended" || verdict === "critical_review_required";
}

function buildDevilsAdvocateAudit({
  canPostPayroll,
  complianceFlags,
  anomalyAudit,
  employeePayroll,
  splitMode,
  ingestionAudit
}) {
  const challenges = [];
  const resolutions = [];
  const fraudFlagged = employeePayroll.filter((row) => isFraudVerdictBlocking(row.fraud_verdict));
  const criticalFraud = employeePayroll.filter((row) => row.fraud_verdict === "critical_review_required");
  const blockingCompliance = complianceFlags.filter((flag) => flag.severity === "blocking");
  const reviewCompliance = complianceFlags.filter((flag) => flag.severity === "review");

  blockingCompliance.forEach((flag) => {
    challenges.push(flag.message);
  });

  reviewCompliance.forEach((flag) => {
    challenges.push(flag.message);
  });

  if (anomalyAudit?.status === "critical_review_required") {
    challenges.push(
      `Anomaly & Fraud Review found ${anomalyAudit.summary?.critical || 0} critical finding(s) requiring investigation before payroll posting.`
    );
  } else if (anomalyAudit?.status === "review_recommended") {
    challenges.push(
      `Anomaly & Fraud Review recommended review for ${anomalyAudit.summary?.employees_flagged || fraudFlagged.length} employee(s).`
    );
  }

  if (fraudFlagged.length) {
    const ids = fraudFlagged.map((row) => row.employee_id).join(", ");
    challenges.push(`Flagged employees: ${ids}.`);
  }

  if (ingestionAudit?.flags?.some((flag) => flag.severity === "blocking")) {
    challenges.push("Data ingestion reported blocking issues that weaken payroll defensibility.");
  }

  if (!challenges.length) {
    challenges.push(
      splitMode === "allActive"
        ? "But what happens if all active staff share the tip pool while tipped employees remain below full minimum wage?"
        : "But what happens if managers or back-of-house workers share the tip pool while tipped employees rely on tip credit?"
    );
  }

  if (canPostPayroll) {
    resolutions.push(
      "Devil's Advocate clearance: Connecticut minimum wage top-ups are applied, the selected tip-out mode is internally consistent, and Anomaly & Fraud Review returned no blocking employee verdicts."
    );
  } else if (criticalFraud.length) {
    resolutions.push(
      `Do not post payroll until critical fraud/anomaly findings are cleared for ${criticalFraud.map((row) => row.employee_id).join(", ")}.`
    );
  } else if (fraudFlagged.length) {
    resolutions.push(
      `Resolve Anomaly & Fraud Review findings for ${fraudFlagged.map((row) => row.employee_id).join(", ")} before posting payroll.`
    );
  } else if (blockingCompliance.length) {
    resolutions.push(blockingCompliance[0].message);
  } else {
    resolutions.push(
      "Adjust the tip-out allocation mode or confirm a compliant wage policy before posting this payroll payload."
    );
  }

  let status = "approved";
  if (blockingCompliance.length || criticalFraud.length || anomalyAudit?.status === "critical_review_required") {
    status = "blocked";
  } else if (!canPostPayroll || fraudFlagged.length || anomalyAudit?.status === "review_recommended") {
    status = "review";
  }

  return {
    agent: "devils_advocate",
    status,
    challenge: challenges.join(" "),
    resolution: resolutions.join(" "),
    fraud_flagged_count: fraudFlagged.length,
    can_post_payroll: canPostPayroll
  };
}

function renderDevilsAdvocateAudit(audit) {
  const badgeType =
    audit.status === "approved"
      ? "ok"
      : audit.status === "review"
        ? "warn"
        : audit.status === "idle"
          ? "ok"
          : "block";

  setAgentBadge("#devilsAdvocateStatus", audit.status, badgeType);
  document.querySelector("#auditChallenge").textContent = audit.challenge;
  document.querySelector("#auditResolution").textContent = audit.resolution;
}

function calculatePayroll({ minimumWage, splitMode, ingestionAudit, anomalyAudit, employeeDirectory }) {
  const scenario = normalizeScenario(activeScenario);
  const directory = employeeDirectory || buildEmployeeDirectory(scenario);
  const anomalyFindingsByEmployee = buildAnomalyFindingsByEmployee(anomalyAudit);
  const scenarioEmployees = scenario.employees;
  const scenarioRules = scenario.payroll_rules;
  const hoursByEmployee = sumByEmployee(scenario.shifts, "hours_worked");
  const netSalesByEmployee = sumByEmployee(scenario.pos_sales, "net_sales");
  const creditTipsByEmployee = sumByEmployee(scenario.pos_sales, "credit_card_tips");
  const cashTipsByEmployee = sumByEmployee(scenario.pos_sales, "cash_tips");

  const sourceTipOutByEmployee = scenarioEmployees.reduce((sourceTipOuts, employee) => {
    const rate = scenarioRules.tip_out_rates[employee.role] || 0;
    sourceTipOuts[employee.employee_id] = roundMoney((netSalesByEmployee[employee.employee_id] || 0) * rate);
    return sourceTipOuts;
  }, {});

  const totalTipOutPool = roundMoney(
    Object.values(sourceTipOutByEmployee).reduce((sum, amount) => sum + amount, 0)
  );
  const recipients = getRecipients(splitMode, hoursByEmployee, scenarioEmployees);
  const tipOutReceivedByEmployee = recipients.length
    ? splitCentsEvenly(totalTipOutPool, recipients)
    : {};

  const employeeReviewFlags = buildEmployeeReviewFlags(ingestionAudit, anomalyAudit);
  const complianceFlags = [];
  const tipCreditInUse = scenarioEmployees.some((employee) => {
    const hours = hoursByEmployee[employee.employee_id] || 0;
    return employee.tip_eligible && hours > 0 && employee.hourly_rate < minimumWage;
  });
  const includesManager = recipients.some((employee) => employee.role === "Manager");
  const includesBackOfHouse = recipients.some((employee) =>
    ["Cook", "Dishwasher"].includes(employee.role)
  );
  const includesNonTipEligible = recipients.some((employee) => !employee.tip_eligible);

  if (includesManager) {
    complianceFlags.push({
      code: "MANAGER_INCLUDED_IN_TIP_POOL",
      severity: "blocking",
      message: "Managers cannot participate in employee tip pools."
    });
  }

  if (tipCreditInUse && includesNonTipEligible) {
    complianceFlags.push({
      code: "TIP_CREDIT_POOL_SCOPE_RISK",
      severity: "blocking",
      message:
        "Because tipped staff are paid below the full minimum wage, the tip pool should not include non-tip-eligible staff."
    });
  } else if (includesBackOfHouse) {
    complianceFlags.push({
      code: "BACK_OF_HOUSE_TIP_POOL_REVIEW",
      severity: "review",
      message:
        "Back-of-house tip sharing needs policy review and full-minimum-wage confirmation."
    });
  }

  const employeePayroll = consolidatePayrollRows(
    scenarioEmployees.map((employee) => {
    const relatedIds = employee.related_employee_ids || [];
    const hours = roundMoney(hoursByEmployee[employee.employee_id] || 0);

    if (hours === 0) {
      const reviewFlags = collectReviewFlags(employeeReviewFlags, employee.employee_id, relatedIds);
      const identity = getEmployeeIdentity(employee.employee_id, directory, reviewFlags);
      const fraudVerdict = getFraudVerdictForEmployee(anomalyAudit, employee.employee_id, relatedIds);
      const payrollRow = {
        employee_id: employee.employee_id,
        related_employee_ids: relatedIds,
        name: identity.display_name,
        display_name: identity.display_name,
        employee_label: identity.label,
        role: employee.role,
        hours: 0,
        anomaly_findings: relatedIds
          .flatMap((id) => anomalyFindingsByEmployee[id] || [])
          .concat(anomalyFindingsByEmployee[employee.employee_id] || []),
        fraud_verdict: fraudVerdict.verdict,
        fraud_status_label: fraudVerdict.label,
        fraud_status_class: fraudVerdict.status_class,
        fraud_status_summary: fraudVerdict.summary,
        status: "no_shifts_in_period",
        review_flags: reviewFlags
      };
      payrollRow.review_reasons = summarizeEmployeeReviewReasons(payrollRow);
      return payrollRow;
    }

    const regularHours = Math.min(hours, scenarioRules.weekly_regular_hour_cap);
    const overtimeHours = Math.max(hours - scenarioRules.weekly_regular_hour_cap, 0);
    const regularPay = roundMoney(regularHours * employee.hourly_rate);
    const overtimePay = roundMoney(
      overtimeHours * employee.hourly_rate * scenarioRules.overtime_multiplier
    );
    const reportedTips = roundMoney(
      (creditTipsByEmployee[employee.employee_id] || 0) +
        (cashTipsByEmployee[employee.employee_id] || 0)
    );
    const sourceTipOut = sourceTipOutByEmployee[employee.employee_id] || 0;
    const tipOutReceived = tipOutReceivedByEmployee[employee.employee_id] || 0;
    const netTips = roundMoney(reportedTips - sourceTipOut + tipOutReceived);
    const preTopUpGross = roundMoney(regularPay + overtimePay + netTips);
    const requiredMinimumPay = roundMoney(hours * minimumWage);
    const minimumWageTopUp = roundMoney(Math.max(requiredMinimumPay - preTopUpGross, 0));
    const grossPay = roundMoney(preTopUpGross + minimumWageTopUp);
    const effectiveHourlyRate = roundMoney(grossPay / hours);
    const cashTipsReported = roundMoney(cashTipsByEmployee[employee.employee_id] || 0);
    const employerCashDisbursement = roundMoney(grossPay - cashTipsReported);

    const reviewFlags = collectReviewFlags(employeeReviewFlags, employee.employee_id, relatedIds);
    const identity = getEmployeeIdentity(employee.employee_id, directory, reviewFlags);
    const fraudVerdict = getFraudVerdictForEmployee(anomalyAudit, employee.employee_id, relatedIds);
    const payrollStatus = resolveEmployeePayrollStatus(
      effectiveHourlyRate >= minimumWage,
      reviewFlags
    );
    const payrollRow = {
      employee_id: employee.employee_id,
      related_employee_ids: relatedIds,
      name: identity.display_name,
      display_name: identity.display_name,
      employee_label: identity.label,
      role: employee.role,
      hours,
      regular_pay: regularPay,
      overtime_pay: overtimePay,
      reported_tips: reportedTips,
      source_tip_out: sourceTipOut,
      tip_out_received: tipOutReceived,
      net_tips: netTips,
      minimum_wage_top_up: minimumWageTopUp,
      gross_pay: grossPay,
      effective_hourly_rate: effectiveHourlyRate,
      minimum_wage_compliant: effectiveHourlyRate >= minimumWage,
      minimum_wage_used: minimumWage,
      employer_cash_disbursement: employerCashDisbursement,
      review_flags: reviewFlags,
      anomaly_findings: relatedIds
        .flatMap((id) => anomalyFindingsByEmployee[id] || [])
        .concat(anomalyFindingsByEmployee[employee.employee_id] || []),
      fraud_verdict: fraudVerdict.verdict,
      fraud_status_label: fraudVerdict.label,
      fraud_status_class: fraudVerdict.status_class,
      fraud_status_summary: fraudVerdict.summary,
      status: payrollStatus
    };
    payrollRow.review_reasons = summarizeEmployeeReviewReasons(payrollRow);
    return payrollRow;
  })
  );

  const totals = employeePayroll.reduce(
    (accumulator, row) => {
      if (row.status === "no_shifts_in_period") {
        return accumulator;
      }

      [
        "hours",
        "regular_pay",
        "overtime_pay",
        "reported_tips",
        "source_tip_out",
        "tip_out_received",
        "net_tips",
        "minimum_wage_top_up",
        "gross_pay",
        "employer_cash_disbursement"
      ].forEach((key) => {
        accumulator[key] = roundMoney(accumulator[key] + row[key]);
      });

      return accumulator;
    },
    {
      hours: 0,
      regular_pay: 0,
      overtime_pay: 0,
      reported_tips: 0,
      source_tip_out: 0,
      tip_out_received: 0,
      net_tips: 0,
      minimum_wage_top_up: 0,
      gross_pay: 0,
      employer_cash_disbursement: 0
    }
  );

  const flaggedEmployees = employeePayroll.filter((row) => isFraudVerdictBlocking(row.fraud_verdict)).length;

  const canPostPayroll =
    complianceFlags.every((flag) => flag.severity !== "blocking") &&
    employeePayroll.every(
      (row) => row.status === "no_shifts_in_period" || !isFraudVerdictBlocking(row.fraud_verdict)
    ) &&
    employeePayroll.every(
      (row) => row.status === "no_shifts_in_period" || row.minimum_wage_compliant
    );

  const employeesRequiringReview = buildEmployeesRequiringReview(employeePayroll);
  const devilsAdvocateAudit = buildDevilsAdvocateAudit({
    canPostPayroll,
    complianceFlags,
    anomalyAudit,
    employeePayroll,
    splitMode,
    ingestionAudit
  });

  return {
    workflow: "payroll_tip_calculation",
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.scenario_name,
    status: canPostPayroll ? "approved_with_adjustments" : "blocked_for_review",
    can_post_payroll: canPostPayroll,
    flagged_employee_count: flaggedEmployees,
    employees_requiring_review: employeesRequiringReview,
    minimum_wage: {
      jurisdiction: "Connecticut",
      effective_year: 2026,
      standard_minimum_wage: minimumWage,
      service_employee_cash_wage_floor: 6.38,
      bartender_cash_wage_floor: 8.23
    },
    tip_out_allocation: {
      total_tip_out_pool: totalTipOutPool,
      allocation_method: splitMode,
      recipients: recipients.map((employee) => {
        const identity = getEmployeeIdentity(employee.employee_id, directory);
        return {
          employee_id: employee.employee_id,
          name: identity.display_name || identity.label,
          employee_label: identity.label,
          role: employee.role,
          tip_out_received: tipOutReceivedByEmployee[employee.employee_id] || 0
        };
      })
    },
    employee_payroll: employeePayroll,
    employee_directory: [...directory.values()],
    payroll_totals: totals,
    compliance_flags: complianceFlags,
    devils_advocate_audit: devilsAdvocateAudit
  };
}

function formatPayrollName(row) {
  const name = row.display_name || row.name || "";
  return name && !looksLikeEmployeeId(name) ? escapeHtml(name) : "—";
}

function formatPayrollEmployeeId(row) {
  const related = row.related_employee_ids || [];
  const allIds = [row.employee_id, ...related].filter(Boolean);
  const title = related.length ? `Merged IDs: ${allIds.join(", ")}` : row.employee_id;
  const suffix = related.length ? ` <small class="merged-id-note">(+${related.length})</small>` : "";
  return `<span title="${escapeHtml(title)}">${escapeHtml(row.employee_id)}</span>${suffix}`;
}

function renderPayroll(payload) {
  document.querySelector("#workflowStatus").textContent = payload.status;
  document.querySelector("#workflowDetail").textContent = payload.can_post_payroll
    ? "Calculation complete and ready to post"
    : "Compliance review required before posting";
  document.querySelector("#totalHours").textContent = payload.payroll_totals.hours.toFixed(1);
  document.querySelector("#grossPay").textContent = currency.format(payload.payroll_totals.gross_pay);
  document.querySelector("#tipOutPool").textContent = currency.format(
    payload.tip_out_allocation.total_tip_out_pool
  );
  document.querySelector("#complianceStatus").textContent = payload.can_post_payroll
    ? "Approved"
    : "Blocked";
  document.querySelector("#auditChallenge").textContent =
    payload.devils_advocate_audit.challenge;
  document.querySelector("#auditResolution").textContent =
    payload.devils_advocate_audit.resolution;
  renderDevilsAdvocateAudit(payload.devils_advocate_audit);
  document.querySelector("#employeeCount").textContent =
    `${payload.employee_payroll.length} employees`;

  const rows = payload.employee_payroll
    .map((row) => {
      if (row.status === "no_shifts_in_period") {
        const statusClass = row.fraud_status_class || "ok";
        const statusText = row.fraud_status_label || "Compliant";
        return `
          <tr>
            <td>${formatPayrollName(row)}</td>
            <td>${formatPayrollEmployeeId(row)}</td>
            <td>${escapeHtml(row.role)}</td>
            <td>0.0</td>
            <td>${currency.format(0)}</td>
            <td>${currency.format(0)}</td>
            <td>${currency.format(0)}</td>
            <td>--</td>
            <td><span class="pill ${statusClass}" title="${escapeHtml(row.fraud_status_summary || "")}">${statusText}</span></td>
          </tr>
        `;
      }

      const statusClass = row.fraud_status_class || "ok";
      const statusText = row.fraud_status_label || "Compliant";

      return `
        <tr>
          <td>${formatPayrollName(row)}</td>
          <td>${formatPayrollEmployeeId(row)}</td>
          <td>${escapeHtml(row.role)}</td>
          <td>${row.hours.toFixed(1)}</td>
          <td>${currency.format(row.tip_out_received)}</td>
          <td>${currency.format(row.minimum_wage_top_up)}</td>
          <td>${currency.format(row.gross_pay)}</td>
          <td>${currency.format(row.effective_hourly_rate)}</td>
          <td><span class="pill ${statusClass}" title="${escapeHtml(row.fraud_status_summary || "")}">${statusText}</span></td>
        </tr>
      `;
    })
    .join("");

  document.querySelector("#payrollRows").innerHTML = rows;
  const jsonOutput = document.querySelector("#jsonOutput");
  const payrollCount = payload.employee_payroll.length;
  if (payrollCount > 250) {
    jsonOutput.textContent = JSON.stringify(
      {
        status: payload.status,
        can_post_payroll: payload.can_post_payroll,
        source_files: payload.data_ingestion_audit?.source_files || [],
        summary: {
          employees: payrollCount,
          shifts: payload.data_ingestion_audit?.summary?.shifts,
          pos_sales: payload.data_ingestion_audit?.summary?.pos_sales,
          sections: payload.data_ingestion_audit?.summary?.sections,
          ingestion_flags: payload.data_ingestion_audit?.summary?.flag_count,
          anomaly_findings: payload.anomaly_fraud_audit?.summary?.total_findings
        },
        payroll_totals: payload.payroll_totals,
        note: `Full payroll computed for ${payrollCount} employees. Download via Copy JSON uses this summary to keep the page responsive; all rows are rendered in the table above.`
      },
      null,
      2
    );
  } else {
    jsonOutput.textContent = JSON.stringify(payload, null, 2);
  }
}

function renderPayrollReviewSummary(employeesRequiringReview) {
  const banner = document.querySelector("#payrollReviewSummary");

  if (!employeesRequiringReview.length) {
    banner.className = "payroll-review-summary clear";
    banner.innerHTML =
      "<strong>All clear.</strong> No employees require review based on ingestion, anomaly, or payroll checks.";
    return;
  }

  banner.className = "payroll-review-summary flagged";
  banner.innerHTML = `
    <div class="payroll-review-summary-heading">
      <strong>${employeesRequiringReview.length} employee${employeesRequiringReview.length === 1 ? "" : "s"} require review</strong>
      <span>Flagged rows are highlighted below with specific reasons.</span>
    </div>
    <ul class="payroll-review-summary-list">
      ${employeesRequiringReview
        .map((employee) => {
          const reasons = employee.reasons
            .map(
              (reason) =>
                `<li><span class="reason-tag ${reason.severity === "critical" || reason.severity === "blocking" ? "critical" : "review"}">${escapeHtml(reason.label)}</span> ${escapeHtml(reason.message)}</li>`
            )
            .join("");
          return `<li class="payroll-review-summary-item">
            <div class="payroll-review-summary-employee">
              <strong>${escapeHtml(employee.name)}</strong>
              <small>${escapeHtml(employee.employee_id)}</small>
              · ${escapeHtml(employee.role)}
            </div>
            <ul class="payroll-review-summary-reasons">${reasons}</ul>
          </li>`;
        })
        .join("")}
    </ul>
  `;
}

function parseStructuredScenario(text) {
  const parsedScenario = parseScenarioText(text);
  return normalizeScenario(parsedScenario);
}

function setUploadedSources(sources) {
  uploadedSources = sources;
  const combined = combineUploadedSources(sources);

  if (!combined.text) {
    document.querySelector("#uploadedFileMeta").textContent = "No files uploaded yet.";
    return combined;
  }

  const formatLabel = combined.format ? ` · ${combined.format}` : "";
  document.querySelector("#uploadedFileMeta").textContent =
    sources.length === 1
      ? `Loaded: ${combined.name}${formatLabel}`
      : `Loaded ${sources.length} files (${combined.sectionCount} sections)${formatLabel}: ${sources.map((source) => source.name).join(", ")}`;

  return combined;
}

async function loadSampleFile() {
  const response = await fetch("./samples/payroll-export.csv");
  if (!response.ok) {
    setScenarioStatus("Could not load sample file.", "error");
    return;
  }
  const text = await response.text();
  setUploadedSources([{ name: "samples/payroll-export.csv", text, format: null, sheetCount: 0 }]);
  setScenarioStatus("Sample file loaded.", "ok");
  runPayrollAudit();
}

async function handleUploadedFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) {
    return;
  }

  try {
    const sources = await readUploadedFiles(files);
    setUploadedSources(sources);
    setScenarioStatus(`Uploaded ${files.length} file${files.length === 1 ? "" : "s"}.`, "ok");
    runPayrollAudit();
  } catch (error) {
    uploadedSources = [];
    document.querySelector("#uploadedFileMeta").textContent = "Upload failed.";
    setScenarioStatus(`Upload failed: ${error.message}`, "error");
  }
}

function setAgentBadge(elementId, statusText, type = "ok") {
  const badge = document.querySelector(elementId);
  badge.textContent = statusText;
  badge.className = `agent-badge ${type}`;
}

function renderIngestionAudit(ingestionAudit) {
  setAgentBadge(
    "#ingestionStatus",
    ingestionAudit.status,
    ingestionAudit.status === "success" || ingestionAudit.status === "idle"
      ? "ok"
      : ingestionAudit.status === "partial"
        ? "warn"
        : "block"
  );

  document.querySelector("#ingestionSummary").textContent = ingestionAudit.scenario
    ? `${(() => {
        const combined = combineUploadedSources(uploadedSources);
        const sourceLabel = combined.name
          ? `${combined.name}${combined.format ? ` (${combined.format})` : ""}: `
          : "";
        const sectionLabel = ingestionAudit.summary.sections
          ? `${ingestionAudit.summary.sections} section${ingestionAudit.summary.sections === 1 ? "" : "s"}, `
          : "";
        return `${sourceLabel}Detected ${ingestionAudit.detected_format}. Read ${sectionLabel}${ingestionAudit.summary.employees} employees, ${ingestionAudit.summary.shifts} shifts, and ${ingestionAudit.summary.pos_sales} sales rows (${ingestionAudit.summary.flag_count} ingestion flags).`;
      })()}`
    : ingestionAudit.status === "idle"
      ? "Waiting for a POS export file upload."
      : ingestionAudit.flags[0]?.message || "Ingestion failed.";

  const flags = ingestionAudit.flags;
  const flagSummary =
    flags.length > 25
      ? `<li class="flag-summary-note"><strong>${flags.length} total flags</strong> — showing all below. Scroll to review.</li>`
      : "";
  document.querySelector("#ingestionFlags").innerHTML = flags.length
    ? `${flagSummary}${flags
        .map(
          (flag) =>
            `<li><strong>${flag.code}</strong> — ${flag.message}<small>${flag.severity.toUpperCase()}${flag.employee_id ? ` · ${flag.employee_id}` : ""}${flag.section ? ` · ${flag.section}` : ""}</small></li>`
        )
        .join("")}`
    : "<li>No ingestion flags. Data shape looks usable.</li>";
}

function highlightPayrollEmployee(employeeId) {
  document.querySelectorAll(".payroll-row-linked").forEach((row) => {
    row.classList.remove("payroll-row-linked");
  });

  if (!employeeId) {
    return;
  }

  const row = document.querySelector(`#payroll-row-${CSS.escape(employeeId)}`);
  if (row) {
    row.classList.add("payroll-row-linked");
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function renderAnomalyAudit(anomalyAudit) {
  setAgentBadge(
    "#anomalyStatus",
    anomalyAudit.status,
    anomalyAudit.status === "clear"
      ? "ok"
      : anomalyAudit.status === "review_recommended"
        ? "warn"
        : "block"
  );

  document.querySelector("#anomalySummary").textContent =
    anomalyAudit.status === "skipped"
      ? "Anomaly review skipped because ingestion did not produce a scenario."
      : `${anomalyAudit.summary.total_findings} findings (${anomalyAudit.summary.critical} critical, ${anomalyAudit.summary.review} review) across ${anomalyAudit.summary.employees_flagged || 0} employees. Click a name to jump to payroll.`;

  const queue = document.querySelector("#anomalyQueue");
  queue.innerHTML = anomalyAudit.review_queue.length
    ? anomalyAudit.review_queue
        .map((finding) => {
          const employeeChip = finding.employee_id
            ? `<button type="button" class="employee-link" data-employee-id="${escapeHtml(finding.employee_id)}" title="View in Employee Payroll">
                <span class="employee-link-name">${escapeHtml(finding.employee_name || "Name unavailable")}</span>
                <span class="employee-link-id">${escapeHtml(finding.employee_id)}</span>
              </button>`
            : finding.employee_labels?.length
              ? `<span class="employee-link-group">${finding.employee_labels
                  .map((label) => `<span class="employee-link-static">${escapeHtml(label)}</span>`)
                  .join("")}</span>`
              : "";

          return `<li class="anomaly-finding" data-employee-id="${escapeHtml(finding.employee_id || "")}">
            <div class="finding-head">
              <strong>#${finding.rank} ${finding.code}</strong>
              ${employeeChip}
            </div>
            <div class="finding-message">${escapeHtml(finding.message)}</div>
            <small>Priority ${finding.priority_score} · Likely cause: ${escapeHtml(finding.likely_cause || "Review required")}</small>
          </li>`;
        })
        .join("")
    : "<li>No anomalies ranked for review.</li>";

  queue.querySelectorAll(".employee-link").forEach((button) => {
    button.addEventListener("click", () => {
      highlightPayrollEmployee(button.dataset.employeeId);
    });
  });
}

function ingestScenarioFromInput() {
  const combined = combineUploadedSources(uploadedSources);
  if (!combined.text) {
    renderIngestionAudit({
      agent: "data_ingestion",
      status: "failed",
      detected_format: "none",
      flags: [{ code: "NO_FILE_UPLOADED", severity: "blocking", message: "Upload a POS export file to begin." }],
      scenario: null
    });
    renderAnomalyAudit(AnomalyFraudAgent.analyze(null));
    setScenarioStatus("Upload a POS export file to begin.", "error");
    return null;
  }

  const ingestionAudit = DataIngestionAgent.ingest(combined.text, parseStructuredScenario);
  ingestionAudit.source_file = combined.name;
  ingestionAudit.source_files = uploadedSources.map((source) => source.name);

  if (!ingestionAudit.scenario) {
    renderIngestionAudit(ingestionAudit);
    renderAnomalyAudit(AnomalyFraudAgent.analyze(null));
    setScenarioStatus(`Scenario blocked: ${ingestionAudit.flags[0]?.message || "Ingestion failed."}`, "error");
    return null;
  }

  const errors = validateScenario(ingestionAudit.scenario);
  if (errors.length) {
    ingestionAudit.flags.push({
      code: "SCENARIO_VALIDATION_FAILED",
      severity: "blocking",
      message: errors[0]
    });
    ingestionAudit.status = "blocked";
    renderIngestionAudit(ingestionAudit);
    renderAnomalyAudit(AnomalyFraudAgent.analyze(null));
    setScenarioStatus(`Scenario blocked: ${errors[0]}`, "error");
    return null;
  }

  activeScenario = ingestionAudit.scenario;
  renderIngestionAudit(ingestionAudit);

  const employeeDirectory = buildEmployeeDirectory(activeScenario);
  const anomalyAudit = AnomalyFraudAgent.analyze(activeScenario, { employeeDirectory });
  renderAnomalyAudit(anomalyAudit);

  const scenarioMinimumWage = Number(
    activeScenario.payroll_rules?.local_minimum_wage ?? activeScenario.payroll_rules?.minimum_wage
  );
  if (Number.isFinite(scenarioMinimumWage) && scenarioMinimumWage > 0) {
    document.querySelector("#minimumWageInput").value = scenarioMinimumWage.toFixed(2);
  }

  setScenarioStatus(
    `${activeScenario.scenario_name} loaded: ${activeScenario.employees.length} employees, ${activeScenario.shifts.length} shifts, ${activeScenario.pos_sales.length} sales records.`,
    ingestionAudit.status === "partial" ? "warn" : "ok"
  );

  return { ingestionAudit, anomalyAudit, employeeDirectory };
}

function setScenarioStatus(message, type = "ok") {
  const status = document.querySelector("#scenarioStatus");
  status.textContent = message;
  status.className = `scenario-status ${type}`;
}

function runPayrollAudit() {
  const agentResults = ingestScenarioFromInput();
  if (!agentResults) {
    renderDevilsAdvocateAudit({
      agent: "devils_advocate",
      status: "blocked",
      challenge: "Payroll audit stopped before Devil's Advocate review because ingestion did not produce a valid scenario.",
      resolution: document.querySelector("#ingestionSummary").textContent
    });
    document.querySelector("#jsonOutput").textContent = JSON.stringify(
      {
        status: "blocked_at_ingestion",
        data_ingestion_audit: document.querySelector("#ingestionSummary").textContent
      },
      null,
      2
    );
    return;
  }

  const minimumWage = Number(document.querySelector("#minimumWageInput").value);
  const splitMode = document.querySelector("#tipSplitMode").value;
  const payload = calculatePayroll({
    minimumWage,
    splitMode,
    ingestionAudit: agentResults.ingestionAudit,
    anomalyAudit: agentResults.anomalyAudit,
    employeeDirectory: agentResults.employeeDirectory
  });
  payload.data_ingestion_audit = agentResults.ingestionAudit;
  payload.anomaly_fraud_audit = agentResults.anomalyAudit;
  renderPayroll(payload);
}

document.querySelector("#loadSampleFileButton").addEventListener("click", loadSampleFile);
document.querySelector("#payrollFileInput").addEventListener("change", async (event) => {
  await handleUploadedFiles(event.target.files);
});
document.querySelector("#validateScenarioButton").addEventListener("click", runPayrollAudit);
document.querySelector("#runButton").addEventListener("click", runPayrollAudit);

const uploadDropzone = document.querySelector("#uploadDropzone");
uploadDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadDropzone.classList.add("dragover");
});
uploadDropzone.addEventListener("dragleave", () => {
  uploadDropzone.classList.remove("dragover");
});
uploadDropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  uploadDropzone.classList.remove("dragover");
  await handleUploadedFiles(event.dataTransfer.files);
});
document.querySelector("#copyButton").addEventListener("click", async () => {
  const output = document.querySelector("#jsonOutput").textContent;
  await navigator.clipboard.writeText(output);
  document.querySelector("#copyButton").textContent = "Copied";
  setTimeout(() => {
    document.querySelector("#copyButton").textContent = "Copy JSON";
  }, 1200);
});

renderIngestionAudit({
  agent: "data_ingestion",
  status: "idle",
  detected_format: "none",
  flags: [],
  scenario: null
});
renderAnomalyAudit(AnomalyFraudAgent.analyze(null));
renderDevilsAdvocateAudit({
  agent: "devils_advocate",
  status: "idle",
  challenge:
    "But what happens if the tip pool includes managers or back-of-house staff while tipped employees are paid below full minimum wage?",
  resolution: "Upload a file and run the audit to produce a defensible payroll payload."
});
document.querySelector("#jsonOutput").textContent = JSON.stringify({ status: "awaiting_file_upload" }, null, 2);
