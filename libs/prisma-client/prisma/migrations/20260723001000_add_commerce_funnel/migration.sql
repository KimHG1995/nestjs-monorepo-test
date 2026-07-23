CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_in_minor_units" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_activities" ADD COLUMN "product_id" TEXT;

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_deleted_at_created_at_idx"
ON "products"("deleted_at", "created_at");
CREATE INDEX "user_activities_product_id_activity_type_occurred_at_idx"
ON "user_activities"("product_id", "activity_type", "occurred_at");
CREATE INDEX "user_activities_user_id_product_id_occurred_at_idx"
ON "user_activities"("user_id", "product_id", "occurred_at");

ALTER TABLE "user_activities"
ADD CONSTRAINT "user_activities_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
