-- Keep client financial state valid even if data is written outside the application service layer.
ALTER TABLE "ClientCreditAccount"
  ADD CONSTRAINT "ClientCreditAccount_creditLimit_nonnegative" CHECK ("creditLimit" >= 0),
  ADD CONSTRAINT "ClientCreditAccount_usedAmount_nonnegative" CHECK ("usedAmount" >= 0),
  ADD CONSTRAINT "ClientCreditAccount_used_within_limit" CHECK ("usedAmount" <= "creditLimit");

ALTER TABLE "ClientValeAccount"
  ADD CONSTRAINT "ClientValeAccount_balance_nonnegative" CHECK ("balance" >= 0);

ALTER TABLE "ClientCreditMovement"
  ADD CONSTRAINT "ClientCreditMovement_usedBefore_nonnegative" CHECK ("usedBefore" >= 0),
  ADD CONSTRAINT "ClientCreditMovement_usedAfter_nonnegative" CHECK ("usedAfter" >= 0);

ALTER TABLE "ClientValeMovement"
  ADD CONSTRAINT "ClientValeMovement_balanceBefore_nonnegative" CHECK ("balanceBefore" >= 0),
  ADD CONSTRAINT "ClientValeMovement_balanceAfter_nonnegative" CHECK ("balanceAfter" >= 0);

ALTER TABLE "ClientModuleSettings"
  ADD CONSTRAINT "ClientModuleSettings_inactivityDays_positive" CHECK ("inactivityDays" IS NULL OR "inactivityDays" > 0);
