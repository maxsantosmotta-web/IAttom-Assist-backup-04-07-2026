import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export interface StripeProductRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string> | null;
}

export interface StripePriceRow {
  id: string;
  product: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
  active: boolean;
  metadata: Record<string, string> | null;
}

export interface StripeSubscriptionRow {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
  items: unknown;
}

export async function getSubscriptionByCustomerId(
  customerId: string,
): Promise<StripeSubscriptionRow | null> {
  try {
    const result = await db.execute(
      sql`SELECT id, customer, status, cancel_at_period_end, current_period_end, items
          FROM stripe.subscriptions
          WHERE customer = ${customerId}
          ORDER BY created DESC
          LIMIT 1`,
    );
    return (result.rows[0] as unknown as StripeSubscriptionRow) ?? null;
  } catch {
    return null;
  }
}

export async function getPlansWithPrices(): Promise<
  Array<{
    product: StripeProductRow;
    prices: StripePriceRow[];
  }>
> {
  try {
    const result = await db.execute(
      sql`SELECT
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.active as product_active,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active
          FROM stripe.products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true
            AND p.metadata->>'plan' IS NOT NULL
          ORDER BY pr.unit_amount ASC NULLS LAST`,
    );

    const map = new Map<
      string,
      { product: StripeProductRow; prices: StripePriceRow[] }
    >();

    for (const row of result.rows as Record<string, unknown>[]) {
      const productId = row.product_id as string;
      if (!map.has(productId)) {
        map.set(productId, {
          product: {
            id: productId,
            name: row.product_name as string,
            description: (row.product_description as string) ?? null,
            active: row.product_active as boolean,
            metadata: (row.product_metadata as Record<string, string>) ?? null,
          },
          prices: [],
        });
      }
      if (row.price_id) {
        map.get(productId)!.prices.push({
          id: row.price_id as string,
          product: productId,
          unit_amount: row.unit_amount as number | null,
          currency: row.currency as string,
          recurring: row.recurring as StripePriceRow["recurring"],
          active: row.price_active as boolean,
          metadata: null,
        });
      }
    }

    return Array.from(map.values());
  } catch {
    return [];
  }
}
