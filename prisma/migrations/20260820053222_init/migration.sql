-- CreateIndex
CREATE INDEX "alerts_roomId_idx" ON "alerts"("roomId");

-- CreateIndex
CREATE INDEX "stock_movements_fromRoomId_idx" ON "stock_movements"("fromRoomId");

-- CreateIndex
CREATE INDEX "stock_movements_toRoomId_idx" ON "stock_movements"("toRoomId");
