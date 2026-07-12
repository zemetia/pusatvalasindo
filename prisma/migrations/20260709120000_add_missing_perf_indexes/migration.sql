-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "BankMutation_bankAccountId_createdAt_idx" ON "BankMutation"("bankAccountId", "createdAt");
