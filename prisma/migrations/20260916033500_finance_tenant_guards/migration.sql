-- Extend database-level tenant consistency to financial reconciliation links.
-- The generic guard function is created by 20260916032000_tenant_consistency_guards.

CREATE TRIGGER tenant_guard_bank_reconciliation_entry
BEFORE INSERT OR UPDATE ON "BankReconciliation"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('BankStatementEntry', 'bankEntryId');

CREATE TRIGGER tenant_guard_bank_reconciliation_sale_payment
BEFORE INSERT OR UPDATE ON "BankReconciliation"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('SalePayment', 'salePaymentId');

CREATE TRIGGER tenant_guard_bank_reconciliation_payable
BEFORE INSERT OR UPDATE ON "BankReconciliation"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('AccountPayable', 'accountPayableId');
