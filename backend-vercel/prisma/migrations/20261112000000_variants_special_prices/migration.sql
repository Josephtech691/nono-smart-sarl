-- Variantes de produit (poids), prix speciaux par client, livraison a tarif unique (zone facultative).

-- Variantes d'un produit
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prix fixe par client
CREATE TABLE "customer_product_prices" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_product_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_product_prices_customerId_idx" ON "customer_product_prices"("customerId");
CREATE INDEX "customer_product_prices_productId_idx" ON "customer_product_prices"("productId");
ALTER TABLE "customer_product_prices" ADD CONSTRAINT "customer_product_prices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_product_prices" ADD CONSTRAINT "customer_product_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_product_prices" ADD CONSTRAINT "customer_product_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lignes de commande : variante choisie
ALTER TABLE "order_items" ADD COLUMN "variantId" TEXT;
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Commandes recurrentes : la zone n'est plus obligatoire (livraison a 1000 FCFA partout)
ALTER TABLE "recurring_orders" ALTER COLUMN "deliveryZoneId" DROP NOT NULL;
