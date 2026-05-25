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

let activeScenario = JSON.parse(JSON.stringify(sampleScenario));

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

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
  const employeeIds = new Set(scenario.employees.map((employee) => employee.employee_id));

  if (!scenario.employees.length) {
    errors.push("employees must contain at least one employee.");
  }

  if (!scenario.shifts.length) {
    errors.push("shifts must contain at least one shift.");
  }

  scenario.employees.forEach((employee, index) => {
    if (!employee.employee_id) errors.push(`employees[${index}] is missing employee_id.`);
    if (!employee.role) errors.push(`employees[${index}] is missing role.`);
    if (!Number.isFinite(Number(employee.hourly_rate))) {
      errors.push(`employees[${index}] is missing a numeric hourly_rate.`);
    }
  });

  scenario.shifts.forEach((shift, index) => {
    if (!employeeIds.has(shift.employee_id)) {
      errors.push(`shifts[${index}] references unknown employee_id ${shift.employee_id || "(blank)"}.`);
    }
    if (!Number.isFinite(Number(shift.hours_worked))) {
      errors.push(`shifts[${index}] is missing numeric hours_worked.`);
    }
  });

  scenario.pos_sales.forEach((sale, index) => {
    if (!employeeIds.has(sale.employee_id)) {
      errors.push(`pos_sales[${index}] references unknown employee_id ${sale.employee_id || "(blank)"}.`);
    }
  });

  return errors;
}

function calculatePayroll({ minimumWage, splitMode }) {
  const scenario = normalizeScenario(activeScenario);
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

  const employeePayroll = scenarioEmployees.map((employee) => {
    const hours = roundMoney(hoursByEmployee[employee.employee_id] || 0);

    if (hours === 0) {
      return {
        employee_id: employee.employee_id,
        name: `${employee.first_name} ${employee.last_name}`,
        role: employee.role,
        hours: 0,
        status: "no_shifts_in_period"
      };
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

    return {
      employee_id: employee.employee_id,
      name: `${employee.first_name} ${employee.last_name}`,
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
      employer_cash_disbursement: employerCashDisbursement,
      status: effectiveHourlyRate >= minimumWage ? "compliant" : "requires_review"
    };
  });

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

  const canPostPayroll =
    complianceFlags.every((flag) => flag.severity !== "blocking") &&
    employeePayroll.every((row) => row.status === "no_shifts_in_period" || row.minimum_wage_compliant);

  return {
    workflow: "payroll_tip_calculation",
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.scenario_name,
    status: canPostPayroll ? "approved_with_adjustments" : "blocked_for_review",
    can_post_payroll: canPostPayroll,
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
      recipients: recipients.map((employee) => ({
        employee_id: employee.employee_id,
        name: `${employee.first_name} ${employee.last_name}`,
        role: employee.role,
        tip_out_received: tipOutReceivedByEmployee[employee.employee_id] || 0
      }))
    },
    employee_payroll: employeePayroll,
    payroll_totals: totals,
    compliance_flags: complianceFlags,
    devils_advocate_audit: {
      challenge:
        "But what happens if 'staff' includes managers or back-of-house workers while servers and bartenders are paid below full minimum wage? Legally, this creates tip-pool and tip-credit exposure.",
      resolution: canPostPayroll
        ? "The payroll payload excludes managers/back-of-house from the tip-out split, applies Connecticut minimum wage, and adds any required top-up."
        : "The selected allocation mode creates a compliance risk. Switch to active tip-eligible staff or confirm a compliant no-tip-credit policy before posting."
    }
  };
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
  document.querySelector("#employeeCount").textContent =
    `${payload.employee_payroll.length} employees`;

  const rows = payload.employee_payroll
    .map((row) => {
      if (row.status === "no_shifts_in_period") {
        return `
          <tr>
            <td>${row.name}</td>
            <td>${row.role}</td>
            <td>0.0</td>
            <td>${currency.format(0)}</td>
            <td>${currency.format(0)}</td>
            <td>${currency.format(0)}</td>
            <td>--</td>
            <td><span class="pill warn">No shifts</span></td>
          </tr>
        `;
      }

      const statusClass = row.minimum_wage_compliant ? "ok" : "block";
      const statusText = row.minimum_wage_compliant ? "Compliant" : "Review";

      return `
        <tr>
          <td>${row.name}</td>
          <td>${row.role}</td>
          <td>${row.hours.toFixed(1)}</td>
          <td>${currency.format(row.tip_out_received)}</td>
          <td>${currency.format(row.minimum_wage_top_up)}</td>
          <td>${currency.format(row.gross_pay)}</td>
          <td>${currency.format(row.effective_hourly_rate)}</td>
          <td><span class="pill ${statusClass}">${statusText}</span></td>
        </tr>
      `;
    })
    .join("");

  document.querySelector("#payrollRows").innerHTML = rows;
  document.querySelector("#jsonOutput").textContent = JSON.stringify(payload, null, 2);
}

function setScenarioStatus(message, type = "ok") {
  const status = document.querySelector("#scenarioStatus");
  status.textContent = message;
  status.className = `scenario-status ${type}`;
}

function loadScenarioIntoEditor(scenario) {
  document.querySelector("#scenarioInput").value = JSON.stringify(scenario, null, 2);
}

function readScenarioFromEditor() {
  try {
    const parsedScenario = parseScenarioText(document.querySelector("#scenarioInput").value);
    const scenario = normalizeScenario(parsedScenario);
    const errors = validateScenario(scenario);

    if (errors.length) {
      setScenarioStatus(`Scenario blocked: ${errors[0]}`, "error");
      return null;
    }

    activeScenario = scenario;

    const scenarioMinimumWage = Number(
      scenario.payroll_rules.local_minimum_wage ?? scenario.payroll_rules.minimum_wage
    );

    if (Number.isFinite(scenarioMinimumWage) && scenarioMinimumWage > 0) {
      document.querySelector("#minimumWageInput").value = scenarioMinimumWage.toFixed(2);
    }

    setScenarioStatus(
      `${scenario.scenario_name} loaded: ${scenario.employees.length} employees, ${scenario.shifts.length} shifts, ${scenario.pos_sales.length} sales records.`,
      "ok"
    );
    return scenario;
  } catch (error) {
    setScenarioStatus(`Scenario blocked: ${error.message}`, "error");
    return null;
  }
}

function runPayrollAudit() {
  if (!readScenarioFromEditor()) {
    return;
  }

  const minimumWage = Number(document.querySelector("#minimumWageInput").value);
  const splitMode = document.querySelector("#tipSplitMode").value;
  const payload = calculatePayroll({ minimumWage, splitMode });
  renderPayroll(payload);
}

document.querySelector("#loadSampleButton").addEventListener("click", () => {
  activeScenario = JSON.parse(JSON.stringify(sampleScenario));
  loadScenarioIntoEditor(activeScenario);
  setScenarioStatus("Sample scenario loaded.", "ok");
  runPayrollAudit();
});
document.querySelector("#validateScenarioButton").addEventListener("click", runPayrollAudit);
document.querySelector("#runButton").addEventListener("click", runPayrollAudit);
document.querySelector("#copyButton").addEventListener("click", async () => {
  const output = document.querySelector("#jsonOutput").textContent;
  await navigator.clipboard.writeText(output);
  document.querySelector("#copyButton").textContent = "Copied";
  setTimeout(() => {
    document.querySelector("#copyButton").textContent = "Copy JSON";
  }, 1200);
});

loadScenarioIntoEditor(activeScenario);
runPayrollAudit();
