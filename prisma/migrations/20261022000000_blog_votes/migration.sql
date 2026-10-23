-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "downvoteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upvoteCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BlogPostVote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "isUpvote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPostVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogPostVote_postId_idx" ON "BlogPostVote"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostVote_postId_visitorHash_key" ON "BlogPostVote"("postId", "visitorHash");

-- AddForeignKey
ALTER TABLE "BlogPostVote" ADD CONSTRAINT "BlogPostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
