-- AddForeignKey
ALTER TABLE "course_purchase" ADD CONSTRAINT "course_purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
