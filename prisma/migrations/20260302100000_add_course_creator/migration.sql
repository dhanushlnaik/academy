-- Add nullable creatorId column to Course and set up foreign key

-- Add column (nullable so existing rows aren’t broken)
ALTER TABLE "public"."Course" ADD COLUMN "creatorId" TEXT;
ALTER TABLE "public"."Course" ADD COLUMN "category" TEXT;

-- Create index to speed up lookups by creatorId
CREATE INDEX "Course_creatorId_idx" ON "public"."Course"("creatorId");

-- Add foreign key constraint to User table
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_creatorId_fkey" 
  FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
