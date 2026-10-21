/**
 * VAT dashboard — erp_analysis.tax.get_vat_dashboard (desk-aligned ZATCA categories).
 */

export type VatDocumentRow = {
  id: string;
  doctype?: string;
  name: string;
  posting_date?: string;
  vat_amount: number;
  grand_total?: number;
  net_total?: number;
  taxable_amount?: number;
  /** Customer (sales) or supplier (purchase) display name */
  party_name?: string;
  customer?: string;
  customer_name?: string;
  supplier?: string;
  supplier_name?: string;
  territory?: string;
  company?: string;
  branch?: string;
  zatca_status?: string;
  zatca_error?: string;
  zatca_rejection?: string;
  docstatus?: number;
  currency?: string;
};

export type VatMonthlyTrend = {
  labels: string[];
  output_current: number[];
  output_previous: number[];
  input_current: number[];
  input_previous: number[];
  net_current: number[];
  net_previous: number[];
};

export type VatDrillBucket = {
  /** Stable key for drill navigation */
  key: string;
  title: string;
  subtitle?: string;
  section: "output" | "input" | "not_submitted";
  vat_amount: number;
  count?: number;
  documents: VatDocumentRow[];
};

export type VatDashboard = {
  company?: string;
  period?: string;
  from_date?: string;
  to_date?: string;
  territory?: string | null;
  territory_note?: string;
  output_vat_total: number;
  input_vat_total: number;
  net_vat_due: number;
  output_categories: VatDrillBucket[];
  input_categories: VatDrillBucket[];
  not_submitted: VatDrillBucket[];
  monthly_trend?: VatMonthlyTrend | null;
  currency: string;
};

function zNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function zStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function pickFirst(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function linkPartyLabel(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return zStr(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return zStr(
      pickFirst(o, [
        "customer_name",
        "supplier_name",
        "party_name",
        "name",
        "title",
        "label",
      ])
    );
  }
  return "";
}

function partyDisplay(o: Record<string, unknown>): string | undefined {
  const flat = zStr(
    pickFirst(o, [
      "customer_name",
      "party_name",
      "buyer_name",
      "supplier_name",
      "party",
      "title",
    ])
  );
  if (flat) return flat;
  const fromCustomer =
    linkPartyLabel(o.customer) || linkPartyLabel(o.customer_link);
  if (fromCustomer) return fromCustomer;
  const fromSupplier =
    linkPartyLabel(o.supplier) || linkPartyLabel(o.supplier_link);
  if (fromSupplier) return fromSupplier;
  const custStr = zStr(o.customer);
  const supStr = zStr(o.supplier);
  if (custStr && !custStr.startsWith("CUST-") && custStr.length > 3) {
    return custStr;
  }
  if (supStr && !supStr.startsWith("SUP-") && supStr.length > 3) {
    return supStr;
  }
  return undefined;
}

function normalizeDocuments(raw: unknown): VatDocumentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, idx) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const name = zStr(
        pickFirst(o, [
          "name",
          "invoice",
          "invoice_no",
          "voucher_no",
          "id",
          "document",
        ])
      );
      if (!name) return null;
      const party = partyDisplay(o);
      return {
        id: zStr(pickFirst(o, ["name", "id"])) || `doc-${idx}`,
        doctype: zStr(pickFirst(o, ["doctype", "document_type"])) || undefined,
        name,
        posting_date:
          zStr(pickFirst(o, ["posting_date", "date", "transaction_date"])) ||
          undefined,
        vat_amount: zNum(
          pickFirst(o, [
            "vat_amount",
            "vat",
            "tax_amount",
            "total_taxes_and_charges",
            "amount",
          ])
        ),
        grand_total:
          zNum(pickFirst(o, ["grand_total", "total", "rounded_total"])) ||
          undefined,
        net_total:
          zNum(pickFirst(o, ["net_total", "base_net_total", "net_amount"])) ||
          undefined,
        taxable_amount:
          zNum(
            pickFirst(o, ["taxable_amount", "base_total", "total_before_tax"])
          ) || undefined,
        party_name: party,
        customer:
          zStr(pickFirst(o, ["customer", "customer_name"])) || undefined,
        customer_name:
          zStr(pickFirst(o, ["customer_name", "customer"])) || undefined,
        supplier:
          zStr(pickFirst(o, ["supplier", "supplier_name"])) || undefined,
        supplier_name:
          zStr(pickFirst(o, ["supplier_name", "supplier"])) || undefined,
        territory: zStr(pickFirst(o, ["territory"])) || undefined,
        company: zStr(pickFirst(o, ["company"])) || undefined,
        branch: zStr(pickFirst(o, ["branch"])) || undefined,
        zatca_status:
          zStr(
            pickFirst(o, [
              "zatca_status",
              "zatca",
              "zatca_clearance_status",
              "status",
            ])
          ) || undefined,
        zatca_error:
          zStr(
            pickFirst(o, [
              "zatca_error",
              "zatca_rejection_reason",
              "zatca_message",
              "clearance_remarks",
            ])
          ) || undefined,
        zatca_rejection:
          zStr(pickFirst(o, ["zatca_rejection", "rejection_reason"])) ||
          undefined,
        docstatus:
          o.docstatus != null ? zNum(o.docstatus) : undefined,
        currency: zStr(pickFirst(o, ["currency"])) || undefined,
      };
    })
    .filter(Boolean) as VatDocumentRow[];
}

function extractDocumentsFromNode(node: unknown): VatDocumentRow[] {
  if (Array.isArray(node)) return normalizeDocuments(node);
  if (!node || typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const keys = [
    "documents",
    "items",
    "invoices",
    "invoice_list",
    "invoice_details",
    "document_list",
    "sales_invoices",
    "purchase_invoices",
    "rows",
    "details",
    "lines",
    "records",
    "list",
    "data",
    "results",
  ];
  for (const k of keys) {
    const docs = normalizeDocuments(o[k]);
    if (docs.length) return docs;
  }
  return [];
}

function bucketFromNode(
  key: string,
  title: string,
  section: VatDrillBucket["section"],
  node: unknown,
  subtitle?: string
): VatDrillBucket | null {
  if (!node || typeof node !== "object") return null;
  const o = node as Record<string, unknown>;
  const vat_amount = zNum(
    pickFirst(o, ["vat_amount", "vat", "total_vat", "amount", "value"])
  );
  const count =
    o.count != null
      ? zNum(o.count)
      : o.doc_count != null
        ? zNum(o.doc_count)
        : undefined;
  const documents = extractDocumentsFromNode(o);
  const docVat = documents.reduce((s, d) => s + d.vat_amount, 0);
  const amount = vat_amount || docVat;
  if (amount <= 0 && (!count || count <= 0) && documents.length === 0) {
    return null;
  }
  return {
    key,
    title,
    subtitle,
    section,
    vat_amount: amount,
    count: count ?? (documents.length || undefined),
    documents,
  };
}

function categoriesFromSection(
  section: unknown,
  prefix: string,
  bucketSection: "output" | "input"
): VatDrillBucket[] {
  if (!section || typeof section !== "object") return [];
  const o = section as Record<string, unknown>;
  const cats = o.categories ?? o.breakdown ?? o.by_category ?? o.rows;
  if (Array.isArray(cats)) {
    return cats
      .map((row, i) => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        const label = zStr(
          pickFirst(r, ["label", "category", "name", "zatca_category", "key"])
        );
        const key = zStr(pickFirst(r, ["key", "category", "name"])) || `${prefix}-${i}`;
        return bucketFromNode(
          `${prefix}.${key}`,
          label || key,
          bucketSection,
          row
        );
      })
      .filter(Boolean) as VatDrillBucket[];
  }
  if (typeof cats === "object" && cats) {
    return Object.entries(cats as Record<string, unknown>)
      .map(([k, v]) =>
        bucketFromNode(`${prefix}.${k}`, k.replace(/_/g, " "), bucketSection, v)
      )
      .filter(Boolean) as VatDrillBucket[];
  }
  return [];
}

function notSubmittedBuckets(raw: unknown): VatDrillBucket[] {
  if (!raw || typeof raw !== "object") return [];
  const ns = raw as Record<string, unknown>;
  const out: VatDrillBucket[] = [];

  const sales = ns.sales;
  if (sales && typeof sales === "object") {
    const s = sales as Record<string, unknown>;
    for (const [k, v] of Object.entries(s)) {
      const title =
        k === "draft"
          ? "Sales — Draft (not posted)"
          : k === "zatca_pending"
            ? "Sales — ZATCA not cleared"
            : `Sales — ${k.replace(/_/g, " ")}`;
      const b = bucketFromNode(
        `not_submitted.sales.${k}`,
        title,
        "not_submitted",
        v,
        "Territory-scoped when a territory filter applies"
      );
      if (b) out.push(b);
    }
  }

  const purchase = ns.purchase;
  if (purchase && typeof purchase === "object") {
    const p = purchase as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      const title =
        k === "draft"
          ? "Purchase — Draft"
          : k === "cancelled"
            ? "Purchase — Cancelled"
            : `Purchase — ${k.replace(/_/g, " ")}`;
      const b = bucketFromNode(
        `not_submitted.purchase.${k}`,
        title,
        "not_submitted",
        v,
        "Company-wide (no territory on Purchase Invoice)"
      );
      if (b) out.push(b);
    }
  }

  return out;
}

function numericArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => zNum(v));
}

function stringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => zStr(v)).filter(Boolean);
}

function trendFromMonthlyRows(raw: unknown): VatMonthlyTrend | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const labels: string[] = [];
  const output_current: number[] = [];
  const output_previous: number[] = [];
  const input_current: number[] = [];
  const input_previous: number[] = [];
  const net_current: number[] = [];
  const net_previous: number[] = [];

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    labels.push(
      zStr(
        pickFirst(r, [
          "month",
          "month_label",
          "label",
          "period",
          "month_name",
        ])
      ) || `M${labels.length + 1}`
    );
    output_current.push(
      zNum(pickFirst(r, ["output_vat", "output", "sales_vat", "output_amount"]))
    );
    output_previous.push(
      zNum(
        pickFirst(r, [
          "output_vat_ly",
          "output_ly",
          "output_vat_previous",
          "sales_vat_ly",
        ])
      )
    );
    input_current.push(
      zNum(pickFirst(r, ["input_vat", "input", "purchase_vat", "input_amount"]))
    );
    input_previous.push(
      zNum(
        pickFirst(r, [
          "input_vat_ly",
          "input_ly",
          "input_vat_previous",
          "purchase_vat_ly",
        ])
      )
    );
    net_current.push(
      zNum(
        pickFirst(r, ["net_vat", "net", "net_vat_due", "net_amount"]) ||
          (output_current[output_current.length - 1] ?? 0) -
            (input_current[input_current.length - 1] ?? 0)
      )
    );
    net_previous.push(
      zNum(
        pickFirst(r, [
          "net_vat_ly",
          "net_ly",
          "net_vat_previous",
          "net_vat_due_ly",
        ])
      )
    );
  }

  if (!labels.length) return null;
  return {
    labels,
    output_current,
    output_previous,
    input_current,
    input_previous,
    net_current,
    net_previous,
  };
}

function normalizeMonthlyTrend(raw: unknown): VatMonthlyTrend | null {
  const fromRows = trendFromMonthlyRows(raw);
  if (fromRows) return fromRows;

  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  let labels = stringArray(
    pickFirst(o, ["labels", "months", "categories", "periods"])
  );

  const series = o.series;
  if (!labels.length && Array.isArray(series) && series.length) {
    const first = series[0] as Record<string, unknown>;
    const pts = (first.points ?? first.data ?? first.values) as unknown;
    if (Array.isArray(pts)) {
      labels = pts
        .map((p) =>
          zStr(
            pickFirst(p as Record<string, unknown>, [
              "label",
              "month",
              "period",
            ])
          )
        )
        .filter(Boolean);
    }
  }

  if (!labels.length) return null;

  const block = (key: string, alt: string[]) => {
    const v = o[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const b = v as Record<string, unknown>;
      return {
        current: numericArray(
          pickFirst(b, ["current", "this_year", "ty", "values", "data"])
        ),
        previous: numericArray(
          pickFirst(b, ["previous", "last_year", "ly", "values_ly"])
        ),
      };
    }
    return {
      current: numericArray(pickFirst(o, [key, ...alt])),
      previous: numericArray(
        pickFirst(o, [`${key}_previous`, `${key}_ly`, `${alt[0]}_previous`])
      ),
    };
  };

  const output = block("output_vat", ["output", "output_current", "sales_vat"]);
  const input = block("input_vat", ["input", "input_current", "purchase_vat"]);
  let net = block("net_vat", ["net", "net_current", "net_vat_due"]);
  if (!net.current.length) {
    net = {
      current: numericArray(
        pickFirst(o, ["current", "values", "net", "net_vat_due"])
      ),
      previous: numericArray(
        pickFirst(o, ["previous", "previous_year", "ly", "values_ly"])
      ),
    };
  }

  const len = labels.length;
  const pad = (arr: number[]) =>
    arr.length >= len
      ? arr.slice(0, len)
      : [...arr, ...Array(len - arr.length).fill(0)];

  const output_current = pad(output.current);
  const output_previous = pad(output.previous);
  const input_current = pad(input.current);
  const input_previous = pad(input.previous);
  let net_current = pad(net.current);
  let net_previous = pad(net.previous);

  if (!net_current.some((v) => v !== 0)) {
    net_current = output_current.map(
      (v, i) => v - (input_current[i] ?? 0)
    );
  }
  if (!net_previous.some((v) => v !== 0) && output_previous.length) {
    net_previous = output_previous.map(
      (v, i) => v - (input_previous[i] ?? 0)
    );
  }

  if (
    !output_current.some((v) => v !== 0) &&
    !net_current.some((v) => v !== 0)
  ) {
    return null;
  }

  return {
    labels,
    output_current,
    output_previous,
    input_current,
    input_previous,
    net_current,
    net_previous,
  };
}

export function findVatBucket(
  dash: VatDashboard,
  bucketKey: string
): VatDrillBucket | undefined {
  const all = [
    ...dash.output_categories,
    ...dash.input_categories,
    ...dash.not_submitted,
  ];
  return all.find((b) => b.key === bucketKey);
}

/** Drill / detail API may return documents only or a full dashboard payload. */
export function parseVatBucketDocuments(
  raw: unknown,
  bucketKey: string
): VatDocumentRow[] {
  if (Array.isArray(raw)) return normalizeDocuments(raw);
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const direct = extractDocumentsFromNode(
    pickFirst(o, ["documents", "invoices", "items", "results", "data"]) ?? o
  );
  if (direct.length) return direct;
  if (o.bucket && typeof o.bucket === "object") {
    const b = bucketFromNode(
      bucketKey,
      bucketKey,
      "not_submitted",
      o.bucket
    );
    if (b?.documents.length) return b.documents;
  }
  const dash = normalizeVatDashboard(raw);
  return findVatBucket(dash, bucketKey)?.documents ?? [];
}

export function normalizeVatDashboard(raw: unknown): VatDashboard {
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const submitted = (root.submitted ?? root.filing ?? root.totals) as
    | Record<string, unknown>
    | undefined;

  const salesBlock = submitted?.sales ?? root.sales ?? root.output;
  const purchaseBlock = submitted?.purchase ?? root.purchase ?? root.input;

  const output_categories = categoriesFromSection(
    salesBlock,
    "submitted.sales",
    "output"
  );
  const input_categories = categoriesFromSection(
    purchaseBlock,
    "submitted.purchase",
    "input"
  );

  const output_vat_total = zNum(
    pickFirst(submitted || {}, ["output_vat", "sales_vat", "output_vat_total"]) ||
      pickFirst(salesBlock as Record<string, unknown>, [
        "total_vat",
        "vat_total",
        "total",
      ]) ||
      output_categories.reduce((s, c) => s + c.vat_amount, 0)
  );

  const input_vat_total = zNum(
    pickFirst(submitted || {}, ["input_vat", "purchase_vat", "input_vat_total"]) ||
      pickFirst(purchaseBlock as Record<string, unknown>, [
        "total_vat",
        "vat_total",
        "total",
      ]) ||
      input_categories.reduce((s, c) => s + c.vat_amount, 0)
  );

  const net_vat_due = zNum(
    pickFirst(submitted || {}, ["net_vat_due", "net_vat", "net"]) ||
      output_vat_total - input_vat_total
  );

  const not_submitted = notSubmittedBuckets(
    root.not_submitted ?? root.notSubmitted ?? root.exceptions
  );

  const monthly_trend = normalizeMonthlyTrend(
    root.monthly_trend ??
      root.vat_monthly_trend ??
      root.trends?.monthly ??
      (root.trends as Record<string, unknown> | undefined)?.monthly_vat
  );

  return {
    company: zStr(root.company) || undefined,
    period: zStr(root.period) || undefined,
    from_date: zStr(root.from_date) || undefined,
    to_date: zStr(root.to_date) || undefined,
    territory: zStr(root.territory) || null,
    territory_note: (() => {
      const direct = zStr(
        pickFirst(root, ["territory_note", "territory_applied_to"])
      );
      if (direct) return direct;
      const meta = root.meta;
      if (meta && typeof meta === "object") {
        return (
          zStr(
            pickFirst(meta as Record<string, unknown>, [
              "territory_applied_to",
              "territory_note",
            ])
          ) || undefined
        );
      }
      return undefined;
    })(),
    output_vat_total,
    input_vat_total,
    net_vat_due,
    output_categories,
    input_categories,
    not_submitted,
    monthly_trend,
    currency: zStr(root.currency) || "SAR",
  };
}

export function getDemoVatDashboard(): VatDashboard {
  return normalizeVatDashboard({
    company: "Printechs Advanced Printing Trading Co.",
    period: "ytd",
    from_date: "2026-01-01",
    to_date: "2026-10-20",
    currency: "SAR",
    monthly_trend: {
      labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
      ],
      output_vat: {
        current: [42000, 38000, 51000, 47000, 44000, 39000, 52000, 48000, 46000, 50000],
        previous: [40000, 36000, 49000, 45000, 42000, 37000, 50000, 46000, 44000, 48000],
      },
      input_vat: {
        current: [31000, 29000, 35000, 33000, 32000, 28000, 36000, 34000, 33000, 35000],
        previous: [30000, 28000, 34000, 32000, 31000, 27000, 35000, 33000, 32000, 34000],
      },
    },
    submitted: {
      sales: {
        total_vat: 125000,
        categories: [
          {
            label: "Standard rated",
            vat_amount: 98000,
            count: 2,
            documents: [
              {
                name: "SINV-2026-00421",
                doctype: "Sales Invoice",
                posting_date: "2026-03-15",
                vat_amount: 52500,
                grand_total: 402500,
                territory: "Dammam",
                zatca_status: "REPORTED",
                docstatus: 1,
              },
              {
                name: "SINV-2026-00488",
                doctype: "Sales Invoice",
                posting_date: "2026-05-02",
                vat_amount: 45500,
                territory: "Riyadh",
                zatca_status: "CLEARED",
                docstatus: 1,
              },
            ],
          },
          { label: "Zero rated", vat_amount: 12000, count: 18 },
        ],
      },
      purchase: {
        total_vat: 87000,
        categories: [
          { label: "Standard rated", vat_amount: 82000, count: 310 },
          { label: "Import", vat_amount: 5000, count: 4 },
        ],
      },
      net_vat_due: 38000,
    },
    not_submitted: {
      sales: {
        draft: {
          vat_amount: 413,
          count: 3,
          documents: [
            {
              name: "SINV-2026-00901",
              doctype: "Sales Invoice",
              posting_date: "2026-08-10",
              vat_amount: 150,
              docstatus: 0,
              territory: "Dammam",
            },
          ],
        },
        zatca_pending: {
          vat_amount: 1441,
          count: 2,
          documents: [
            {
              name: "SINV-2026-00812",
              doctype: "Sales Invoice",
              posting_date: "2026-07-01",
              customer_name: "Almarai Company",
              territory: "Riyadh",
              grand_total: 5531,
              net_total: 4810,
              vat_amount: 721,
              docstatus: 1,
              zatca_status: "Not Submitted",
              zatca_error: "Clearance pending — resubmit from Sales Invoice",
            },
            {
              name: "SINV-2026-00844",
              doctype: "Sales Invoice",
              posting_date: "2026-07-18",
              customer_name: "LANDMARK ARABIA CO.",
              territory: "Dammam",
              grand_total: 5520,
              net_total: 4800,
              vat_amount: 720,
              docstatus: 1,
              zatca_status: "Not Submitted",
            },
          ],
        },
      },
      purchase: {
        draft: { vat_amount: 220, count: 1 },
        cancelled: { vat_amount: 0, count: 2 },
      },
    },
  });
}
