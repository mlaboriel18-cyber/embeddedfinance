/**
 * Anomaly & Fraud Review Agent
 * Detects suspicious payroll/tip patterns and ranks records for review.
 */
const AnomalyFraudAgent = (() => {
  const SALES_PER_HOUR_LOW = 35;
  const SALES_PER_HOUR_HIGH = 450;
  const CASH_TIP_RATIO_HIGH = 0.65;
  const ALLOCATION_TOLERANCE = 0.05;
  const ALLOCATION_MISMATCH_REVIEW = 5;
  const ALLOCATION_MISMATCH_CRITICAL = 25;

  function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = Number(String(value).replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
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

  function directoryEntry(directory, employeeId) {
    if (!directory || !employeeId) {
      return null;
    }
    if (directory instanceof Map) {
      return directory.get(employeeId) || null;
    }
    if (Array.isArray(directory)) {
      return directory.find((entry) => entry.employee_id === employeeId) || null;
    }
    return directory[employeeId] || null;
  }

  function resolveEmployeeIdentity(employeeId, directory, scenario) {
    const entry = directoryEntry(directory, employeeId);
    if (entry?.display_name && !looksLikeEmployeeId(entry.display_name)) {
      return {
        employee_id: employeeId,
        employee_name: entry.display_name,
        role: entry.role || "",
        employee_label: `${entry.display_name} · ${employeeId}`
      };
    }

    const derivedName = String(employeeId || "")
      .replace(/^EMP-/i, "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");

    if (derivedName && /^EMP-/i.test(employeeId)) {
      return {
        employee_id: employeeId,
        employee_name: derivedName,
        role: entry?.role || "",
        employee_label: `${derivedName} · ${employeeId}`
      };
    }

    const employee = (scenario?.employees || []).find((record) => record.employee_id === employeeId);
    if (employee) {
      const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
      if (name && !looksLikeEmployeeId(name)) {
        return {
          employee_id: employeeId,
          employee_name: name,
          role: employee.role || "",
          employee_label: `${name} · ${employeeId}`
        };
      }
    }

    const activityName = [...(scenario?.shifts || []), ...(scenario?.pos_sales || [])]
      .filter((record) => record.employee_id === employeeId && record.employee_name)
      .map((record) => String(record.employee_name).trim())
      .find((name) => name && !looksLikeEmployeeId(name));

    if (activityName) {
      return {
        employee_id: employeeId,
        employee_name: activityName,
        role: employee?.role || "",
        employee_label: `${activityName} · ${employeeId}`
      };
    }

    return {
      employee_id: employeeId,
      employee_name: "",
      role: employee?.role || entry?.role || "",
      employee_label: employeeId
    };
  }

  function attachEmployeeIdentity(finding, directory, scenario) {
    if (finding.employee_id) {
      const identity = resolveEmployeeIdentity(finding.employee_id, directory, scenario);
      finding.employee_name = identity.employee_name;
      finding.employee_label = identity.employee_label;
      finding.role = identity.role;
    }

    if (finding.employee_ids?.length) {
      finding.employee_labels = finding.employee_ids.map((employeeId) =>
        resolveEmployeeIdentity(employeeId, directory, scenario).employee_label
      );
    }

    return finding;
  }

  function buildEmployeeMetrics(scenario) {
    const hoursByEmployee = {};
    const salesByEmployee = {};
    const tipsByEmployee = { credit: {}, cash: {}, total: {} };
    const allocationByEmployee = {
      expected: {},
      actual: {},
      adjustmentCount: {},
      adjustmentAmount: {}
    };

    scenario.shifts.forEach((shift) => {
      hoursByEmployee[shift.employee_id] =
        (hoursByEmployee[shift.employee_id] || 0) + Number(shift.hours_worked || 0);
    });

    scenario.pos_sales.forEach((sale) => {
      const employeeId = sale.employee_id;
      salesByEmployee[employeeId] = (salesByEmployee[employeeId] || 0) + Number(sale.net_sales || 0);
      tipsByEmployee.credit[employeeId] =
        (tipsByEmployee.credit[employeeId] || 0) + Number(sale.credit_card_tips || 0);
      tipsByEmployee.cash[employeeId] =
        (tipsByEmployee.cash[employeeId] || 0) + Number(sale.cash_tips || 0);
      tipsByEmployee.total[employeeId] =
        (tipsByEmployee.total[employeeId] || 0) +
        Number(sale.credit_card_tips || 0) +
        Number(sale.cash_tips || 0);

      const expected = toNumber(sale.expected_tip_share);
      const actual = toNumber(sale.actual_tip_paid);
      const adjustment = toNumber(sale.manual_adjustment_amount);

      if (expected !== null) {
        allocationByEmployee.expected[employeeId] =
          (allocationByEmployee.expected[employeeId] || 0) + expected;
      }
      if (actual !== null) {
        allocationByEmployee.actual[employeeId] =
          (allocationByEmployee.actual[employeeId] || 0) + actual;
      }
      if (adjustment !== null && Math.abs(adjustment) > ALLOCATION_TOLERANCE) {
        allocationByEmployee.adjustmentCount[employeeId] =
          (allocationByEmployee.adjustmentCount[employeeId] || 0) + 1;
        allocationByEmployee.adjustmentAmount[employeeId] =
          round((allocationByEmployee.adjustmentAmount[employeeId] || 0) + adjustment);
      }
    });

    return { hoursByEmployee, salesByEmployee, tipsByEmployee, allocationByEmployee };
  }

  function employeeHasAllocationData(metrics, employeeId) {
    const allocation = metrics.allocationByEmployee;
    return (
      allocation.expected[employeeId] !== undefined ||
      allocation.actual[employeeId] !== undefined ||
      (allocation.adjustmentCount[employeeId] || 0) > 0
    );
  }

  function allocationDeltaMessage(label, expected, actual) {
    const delta = round(actual - expected);
    if (delta > ALLOCATION_TOLERANCE) {
      return `${label} was over-allocated by $${Math.abs(delta)} (expected $${expected}, paid $${actual}).`;
    }
    if (delta < -ALLOCATION_TOLERANCE) {
      return `${label} was under-allocated by $${Math.abs(delta)} (expected $${expected}, paid $${actual}).`;
    }
    return `${label} allocation matches expected share ($${expected}).`;
  }

  function findDuplicateEmployees(employees) {
    const byId = new Map();
    const findings = [];

    employees.forEach((employee) => {
      const employeeId = String(employee.employee_id || "").trim();
      if (!employeeId) {
        return;
      }

      if (!byId.has(employeeId)) {
        byId.set(employeeId, 0);
      }
      byId.set(employeeId, byId.get(employeeId) + 1);
    });

    byId.forEach((count, employeeId) => {
      if (count > 1) {
        findings.push({
          code: "DUPLICATE_EMPLOYEE_RECORD",
          severity: "review",
          priority_score: 55,
          employee_id: employeeId,
          likely_cause: "Duplicate roster rows for the same Employee_id",
          message: `Employee_id ${employeeId} appears ${count} times in the roster.`
        });
      }
    });

    return findings;
  }

  function reviewEmployeePatterns(scenario, metrics, directory) {
    const findings = [];

    scenario.employees.forEach((employee) => {
      const employeeId = employee.employee_id;
      const identity = resolveEmployeeIdentity(employeeId, directory, scenario);
      const label = identity.employee_label;
      const hours = round(metrics.hoursByEmployee[employeeId] || 0);
      const sales = round(metrics.salesByEmployee[employeeId] || 0);
      const totalTips = round(metrics.tipsByEmployee.total[employeeId] || 0);
      const cashTips = round(metrics.tipsByEmployee.cash[employeeId] || 0);
      const salesPerHour = hours > 0 ? round(sales / hours) : 0;
      const cashRatio = totalTips > 0 ? round(cashTips / totalTips) : 0;
      const hasAllocation = employeeHasAllocationData(metrics, employeeId);
      const expectedShare = round(metrics.allocationByEmployee.expected[employeeId] || 0);
      const actualPaid = round(metrics.allocationByEmployee.actual[employeeId] || 0);
      const adjustmentCount = metrics.allocationByEmployee.adjustmentCount[employeeId] || 0;
      const adjustmentAmount = round(metrics.allocationByEmployee.adjustmentAmount[employeeId] || 0);

      if (hasAllocation && expectedShare > 0) {
        const delta = round(actualPaid - expectedShare);
        const absDelta = Math.abs(delta);

        if (absDelta > ALLOCATION_TOLERANCE) {
          if (absDelta >= ALLOCATION_MISMATCH_CRITICAL) {
            findings.push(
              attachEmployeeIdentity(
                {
                  code: "TIP_ALLOCATION_CRITICAL",
                  severity: "critical",
                  priority_score: 92,
                  employee_id: employeeId,
                  metric: `$${absDelta} allocation gap`,
                  likely_cause: "Tip pool share does not match expected allocation; manual adjustment or pool split error",
                  message: allocationDeltaMessage(label, expectedShare, actualPaid)
                },
                directory,
                scenario
              )
            );
          } else if (absDelta >= ALLOCATION_MISMATCH_REVIEW) {
            findings.push(
              attachEmployeeIdentity(
                {
                  code: "TIP_ALLOCATION_MISMATCH",
                  severity: "review",
                  priority_score: 70,
                  employee_id: employeeId,
                  metric: `$${absDelta} allocation gap`,
                  likely_cause: "Rounding, pool weighting, or partial shift allocation mismatch",
                  message: allocationDeltaMessage(label, expectedShare, actualPaid)
                },
                directory,
                scenario
              )
            );
          }
        }
      }

      if (adjustmentCount > 0) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "MANUAL_TIP_ADJUSTMENT",
              severity: Math.abs(adjustmentAmount) >= ALLOCATION_MISMATCH_CRITICAL ? "critical" : "review",
              priority_score: Math.abs(adjustmentAmount) >= ALLOCATION_MISMATCH_CRITICAL ? 88 : 74,
              employee_id: employeeId,
              metric: `${adjustmentCount} manual adjustment${adjustmentCount === 1 ? "" : "s"}`,
              likely_cause: "Manager or comptroller manually changed tip allocation",
              message: `${label} has ${adjustmentCount} manual tip adjustment${adjustmentCount === 1 ? "" : "s"} totaling $${Math.abs(adjustmentAmount)}.`
            },
            directory,
            scenario
          )
        );
      }

      if (hours > 0 && sales > 0 && salesPerHour <= SALES_PER_HOUR_LOW) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "LOW_SALES_PER_HOUR",
              severity: "review",
              priority_score: 60,
              employee_id: employeeId,
              metric: `$${salesPerHour}/hr sales`,
              likely_cause: "Slow shift, training period, or hours/sales attribution mismatch",
              message: `${label} logged ${hours} hours but only $${sales} in net sales.`
            },
            directory,
            scenario
          )
        );
      }

      if (hours > 0 && sales > 0 && salesPerHour >= SALES_PER_HOUR_HIGH) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "HIGH_SALES_PER_HOUR",
              severity: "review",
              priority_score: 64,
              employee_id: employeeId,
              metric: `$${salesPerHour}/hr sales`,
              likely_cause: "Compressed shift data, missing hours, or POS check reassignment",
              message: `${label} shows unusually high sales productivity at $${salesPerHour}/hr.`
            },
            directory,
            scenario
          )
        );
      }

      if (employee.tip_eligible && totalTips > 0 && cashRatio >= CASH_TIP_RATIO_HIGH) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "CASH_TIP_HEAVY",
              severity: "review",
              priority_score: 72,
              employee_id: employeeId,
              metric: `${Math.round(cashRatio * 100)}% cash tips`,
              likely_cause: "Under-reported card tips, cash handling policy issue, or tip pooling mismatch",
              message: `${label} received ${Math.round(cashRatio * 100)}% of tips in cash.`
            },
            directory,
            scenario
          )
        );
      }

      if (hours > 40) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "OVERTIME_HOURS",
              severity: "info",
              priority_score: 35,
              employee_id: employeeId,
              metric: `${hours} hours`,
              likely_cause: "Expected overtime; verify timeclock and POS attribution",
              message: `${label} worked ${hours} hours in the pay period.`
            },
            directory,
            scenario
          )
        );
      }

      if (employee.tip_eligible && hours > 0) {
        if (hasAllocation && expectedShare > 0 && actualPaid <= ALLOCATION_TOLERANCE) {
          findings.push(
            attachEmployeeIdentity(
              {
                code: "MISSING_TIP_ALLOCATION",
                severity: "review",
                priority_score: 62,
                employee_id: employeeId,
                metric: "$0 paid vs expected share",
                likely_cause: "Tip pool payout missing or allocation not applied",
                message: `${label} is owed $${expectedShare} in tip allocation but received $${actualPaid}.`
              },
              directory,
              scenario
            )
          );
        } else if (!hasAllocation && totalTips === 0) {
          findings.push(
            attachEmployeeIdentity(
              {
                code: "MISSING_TIPS_ON_TIPPED_ROLE",
                severity: "review",
                priority_score: 58,
                employee_id: employeeId,
                metric: "$0 tips",
                likely_cause: "Missing POS sales export or tip mapping failure",
                message: `${label} is tip-eligible but has no reported tips.`
              },
              directory,
              scenario
            )
          );
        }
      }
    });

    return findings;
  }

  function reviewShiftPatterns(scenario, directory) {
    const findings = [];
    const seen = new Map();

    scenario.shifts.forEach((shift) => {
      const key = `${shift.employee_id}|${shift.shift_date}|${shift.hours_worked}`;
      if (seen.has(key)) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "DUPLICATE_SHIFT_PATTERN",
              severity: "review",
              priority_score: 70,
              employee_id: shift.employee_id,
              shift_id: shift.shift_id,
              likely_cause: "Duplicate import from timeclock and POS labor report",
              message: `Duplicate shift pattern on ${shift.shift_date}.`
            },
            directory,
            scenario
          )
        );
      } else {
        seen.set(key, shift.shift_id);
      }

      if (Number(shift.hours_worked) > 14) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "EXCESSIVE_SHIFT_LENGTH",
              severity: "critical",
              priority_score: 88,
              employee_id: shift.employee_id,
              shift_id: shift.shift_id,
              likely_cause: "Timeclock error, missed punch-out, or policy violation",
              message: `Shift ${shift.shift_id} reports ${shift.hours_worked} hours in one day.`
            },
            directory,
            scenario
          )
        );
      }
    });

    return findings;
  }

  function reviewSalesPatterns(scenario, directory) {
    const findings = [];

    scenario.pos_sales.forEach((sale) => {
      const expected = toNumber(sale.expected_tip_share);
      const actual = toNumber(sale.actual_tip_paid);
      const adjustment = toNumber(sale.manual_adjustment_amount);
      const totalTips = Number(sale.credit_card_tips || 0) + Number(sale.cash_tips || 0);

      if (expected !== null && actual !== null && expected > 0) {
        const delta = round(actual - expected);
        const absDelta = Math.abs(delta);

        if (absDelta > ALLOCATION_TOLERANCE) {
          if (absDelta >= ALLOCATION_MISMATCH_CRITICAL) {
            findings.push(
              attachEmployeeIdentity(
                {
                  code: "TIP_ALLOCATION_ROW_CRITICAL",
                  severity: "critical",
                  priority_score: 86,
                  employee_id: sale.employee_id,
                  transaction_id: sale.transaction_id,
                  likely_cause: "Transaction-level tip share does not match payout",
                  message: `Transaction ${sale.transaction_id}: expected $${expected} tip share, paid $${actual}.`
                },
                directory,
                scenario
              )
            );
          } else if (absDelta >= ALLOCATION_MISMATCH_REVIEW) {
            findings.push(
              attachEmployeeIdentity(
                {
                  code: "TIP_ALLOCATION_ROW_MISMATCH",
                  severity: "review",
                  priority_score: 66,
                  employee_id: sale.employee_id,
                  transaction_id: sale.transaction_id,
                  likely_cause: "Partial pool weighting or rounding on this check",
                  message: `Transaction ${sale.transaction_id}: expected $${expected} tip share, paid $${actual}.`
                },
                directory,
                scenario
              )
            );
          }
        }
      }

      if (adjustment !== null && Math.abs(adjustment) > ALLOCATION_TOLERANCE) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "MANUAL_TIP_ADJUSTMENT",
              severity: Math.abs(adjustment) >= ALLOCATION_MISMATCH_CRITICAL ? "critical" : "review",
              priority_score: Math.abs(adjustment) >= ALLOCATION_MISMATCH_CRITICAL ? 84 : 68,
              employee_id: sale.employee_id,
              transaction_id: sale.transaction_id,
              likely_cause: "Manual tip adjustment recorded on this transaction",
              message: `Transaction ${sale.transaction_id} has a manual tip adjustment of $${adjustment}.`
            },
            directory,
            scenario
          )
        );
      }

      if (sale.net_sales > 0 && totalTips === 0 && expected === null && actual === null) {
        findings.push(
          attachEmployeeIdentity(
            {
              code: "ZERO_TIP_SALE",
              severity: "info",
              priority_score: 25,
              employee_id: sale.employee_id,
              transaction_id: sale.transaction_id,
              likely_cause: "Takeout, cash check, or missing tip capture",
              message: `Transaction ${sale.transaction_id} has sales but no recorded tips.`
            },
            directory,
            scenario
          )
        );
      }
    });

    return findings;
  }

  function buildFindingsByEmployee(findings) {
    const grouped = new Map();

    findings.forEach((finding) => {
      const employeeIds = finding.employee_ids || (finding.employee_id ? [finding.employee_id] : []);
      employeeIds.forEach((employeeId) => {
        if (!grouped.has(employeeId)) {
          grouped.set(employeeId, []);
        }
        grouped.get(employeeId).push({
          code: finding.code,
          severity: finding.severity,
          priority_score: finding.priority_score,
          message: finding.message,
          likely_cause: finding.likely_cause
        });
      });
    });

    return Object.fromEntries(grouped.entries());
  }

  function resolveVerdictFromFindings(findings) {
    if (!findings.length) {
      return {
        verdict: "compliant",
        label: "Compliant",
        status_class: "ok"
      };
    }

    if (findings.some((finding) => finding.severity === "critical")) {
      return {
        verdict: "critical_review_required",
        label: "Critical",
        status_class: "block"
      };
    }

    if (findings.some((finding) => finding.severity === "review")) {
      return {
        verdict: "review_recommended",
        label: "Review",
        status_class: "warn"
      };
    }

    return {
      verdict: "advisory",
      label: "Advisory",
      status_class: "warn"
    };
  }

  function buildEmployeeVerdicts(scenario, findings) {
    const findingsByEmployee = buildFindingsByEmployee(findings);
    const verdicts = {};

    scenario.employees.forEach((employee) => {
      const employeeFindings = findingsByEmployee[employee.employee_id] || [];
      const resolved = resolveVerdictFromFindings(employeeFindings);
      verdicts[employee.employee_id] = {
        employee_id: employee.employee_id,
        ...resolved,
        finding_count: employeeFindings.length,
        findings: employeeFindings,
        summary: employeeFindings.length
          ? employeeFindings.map((finding) => finding.message).join(" ")
          : "No anomaly or fraud findings for this employee."
      };
    });

    return verdicts;
  }

  function analyze(scenario, options = {}) {
    if (!scenario) {
      return {
        agent: "anomaly_fraud_review",
        status: "skipped",
        findings: [],
        review_queue: [],
        findings_by_employee: {},
        employee_verdicts: {},
        employee_directory: []
      };
    }

    const directory = options.employeeDirectory || null;
    const metrics = buildEmployeeMetrics(scenario);
    const findings = [
      ...findDuplicateEmployees(scenario.employees),
      ...reviewEmployeePatterns(scenario, metrics, directory),
      ...reviewShiftPatterns(scenario, directory),
      ...reviewSalesPatterns(scenario, directory)
    ];

    const reviewQueue = findings
      .slice()
      .sort((left, right) => right.priority_score - left.priority_score)
      .map((finding, index) => ({
        rank: index + 1,
        ...finding
      }));

    const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
    const reviewCount = findings.filter((finding) => finding.severity === "review").length;
    const employeeDirectory = directory instanceof Map
      ? [...directory.values()]
      : Array.isArray(directory)
        ? directory
        : Object.values(directory || {});

    return {
      agent: "anomaly_fraud_review",
      status: criticalCount ? "critical_review_required" : reviewCount ? "review_recommended" : "clear",
      summary: {
        total_findings: findings.length,
        critical: criticalCount,
        review: reviewCount,
        info: findings.filter((finding) => finding.severity === "info").length,
        employees_flagged: Object.keys(buildFindingsByEmployee(findings)).length
      },
      employee_directory: employeeDirectory,
      findings_by_employee: buildFindingsByEmployee(findings),
      employee_verdicts: buildEmployeeVerdicts(scenario, findings),
      findings,
      review_queue: reviewQueue.slice(0, 10)
    };
  }

  return { analyze, resolveEmployeeIdentity };
})();
