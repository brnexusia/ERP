-- Defense in depth for multi-tenant data consistency.
-- Application services already scope operational queries by organizationId; these guards
-- prevent a direct database write from linking a child row to a parent from another tenant.

CREATE OR REPLACE FUNCTION erp_enforce_same_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_id TEXT;
  parent_org TEXT;
BEGIN
  parent_id := to_jsonb(NEW) ->> TG_ARGV[1];

  IF parent_id IS NULL OR parent_id = '' THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT "organizationId" FROM %I WHERE "id" = $1', TG_ARGV[0])
    INTO parent_org
    USING parent_id;

  -- Let the ordinary foreign key report a missing parent. This trigger only adds tenant consistency.
  IF parent_org IS NULL THEN
    RETURN NEW;
  END IF;

  IF parent_org IS DISTINCT FROM NEW."organizationId" THEN
    RAISE EXCEPTION
      'tenant mismatch on %.%: parent % belongs to %, child belongs to %',
      TG_TABLE_NAME,
      TG_ARGV[1],
      parent_id,
      parent_org,
      NEW."organizationId"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION erp_enforce_session_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM "Membership"
     WHERE "organizationId" = NEW."activeOrganizationId"
       AND "userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION
      'tenant mismatch on Session: user % is not a member of organization %',
      NEW."userId",
      NEW."activeOrganizationId"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_guard_session_membership
BEFORE INSERT OR UPDATE ON "Session"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_session_membership();

CREATE TRIGGER tenant_guard_client_segment
BEFORE INSERT OR UPDATE ON "Client"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ClientSegment', 'segmentId');

CREATE TRIGGER tenant_guard_client_seller
BEFORE INSERT OR UPDATE ON "Client"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Membership', 'responsibleSellerMembershipId');

CREATE TRIGGER tenant_guard_client_address
BEFORE INSERT OR UPDATE ON "ClientAddress"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_credit_account_client
BEFORE INSERT OR UPDATE ON "ClientCreditAccount"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_credit_movement_client
BEFORE INSERT OR UPDATE ON "ClientCreditMovement"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_credit_movement_account
BEFORE INSERT OR UPDATE ON "ClientCreditMovement"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ClientCreditAccount', 'accountId');

CREATE TRIGGER tenant_guard_vale_account_client
BEFORE INSERT OR UPDATE ON "ClientValeAccount"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_vale_movement_client
BEFORE INSERT OR UPDATE ON "ClientValeMovement"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_vale_movement_account
BEFORE INSERT OR UPDATE ON "ClientValeMovement"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ClientValeAccount', 'accountId');

CREATE TRIGGER tenant_guard_crm_client
BEFORE INSERT OR UPDATE ON "ClientCrmEntry"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_category_parent
BEFORE INSERT OR UPDATE ON "ProductCategory"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ProductCategory', 'parentId');

CREATE TRIGGER tenant_guard_product_category
BEFORE INSERT OR UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ProductCategory', 'categoryId');

CREATE TRIGGER tenant_guard_product_subcategory
BEFORE INSERT OR UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ProductCategory', 'subcategoryId');

CREATE TRIGGER tenant_guard_product_photo
BEFORE INSERT OR UPDATE ON "ProductPhoto"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Product', 'productId');

CREATE TRIGGER tenant_guard_product_stock
BEFORE INSERT OR UPDATE ON "ProductStock"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Product', 'productId');

CREATE TRIGGER tenant_guard_sale_client
BEFORE INSERT OR UPDATE ON "Sale"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_sale_seller
BEFORE INSERT OR UPDATE ON "Sale"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Membership', 'sellerMembershipId');

CREATE TRIGGER tenant_guard_sale_item_sale
BEFORE INSERT OR UPDATE ON "SaleItem"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Sale', 'saleId');

CREATE TRIGGER tenant_guard_sale_item_product
BEFORE INSERT OR UPDATE ON "SaleItem"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Product', 'productId');

CREATE TRIGGER tenant_guard_sale_payment
BEFORE INSERT OR UPDATE ON "SalePayment"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Sale', 'saleId');

CREATE TRIGGER tenant_guard_support_client
BEFORE INSERT OR UPDATE ON "SupportRecord"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client', 'clientId');

CREATE TRIGGER tenant_guard_support_sale
BEFORE INSERT OR UPDATE ON "SupportRecord"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Sale', 'saleId');

CREATE TRIGGER tenant_guard_delivery_sale
BEFORE INSERT OR UPDATE ON "SaleDelivery"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Sale', 'saleId');
