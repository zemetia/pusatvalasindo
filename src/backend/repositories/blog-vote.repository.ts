import prisma from "@/lib/prisma";

export type VoteStatus = "up" | "down" | null;

export const blogVoteRepository = {
  /** Mencari vote pengunjung saat ini untuk artikel tertentu. */
  async findUserVote(postId: string, visitorHash: string): Promise<VoteStatus> {
    const row = await prisma.blogPostVote.findUnique({
      where: { postId_visitorHash: { postId, visitorHash } },
      select: { isUpvote: true },
    });
    if (!row) return null;
    return row.isUpvote ? "up" : "down";
  },

  /** Mengambil jumlah upvote & downvote artikel saat ini. */
  async getCounts(postId: string): Promise<{ upvoteCount: number; downvoteCount: number }> {
    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { upvoteCount: true, downvoteCount: true },
    });
    return {
      upvoteCount: Math.max(0, post?.upvoteCount ?? 0),
      downvoteCount: Math.max(0, post?.downvoteCount ?? 0),
    };
  },

  /**
   * Mencatat tanggapan pengunjung (upvote / downvote "Apakah artikel ini membantu?").
   * Transaksional dan idempoten:
   * - Mengklik opsi yang sama membatalkan (toggle off) vote.
   * - Mengklik opsi yang berlawanan memindahkan vote dari down ke up atau sebaliknya.
   */
  async recordVote(
    postId: string,
    visitorHash: string,
    targetVote: VoteStatus
  ): Promise<{ upvoteCount: number; downvoteCount: number; userVote: VoteStatus }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.blogPostVote.findUnique({
        where: { postId_visitorHash: { postId, visitorHash } },
      });

      let nextUserVote: VoteStatus = null;

      if (targetVote === "up") {
        if (!existing) {
          await tx.blogPostVote.create({
            data: { postId, visitorHash, isUpvote: true },
          });
          await tx.blogPost.update({
            where: { id: postId },
            data: { upvoteCount: { increment: 1 } },
          });
          nextUserVote = "up";
        } else if (existing.isUpvote) {
          // Toggle off
          await tx.blogPostVote.delete({ where: { id: existing.id } });
          await tx.blogPost.update({
            where: { id: postId },
            data: { upvoteCount: { decrement: 1 } },
          });
          nextUserVote = null;
        } else {
          // Switch dari downvote ke upvote
          await tx.blogPostVote.update({
            where: { id: existing.id },
            data: { isUpvote: true },
          });
          await tx.blogPost.update({
            where: { id: postId },
            data: { upvoteCount: { increment: 1 }, downvoteCount: { decrement: 1 } },
          });
          nextUserVote = "up";
        }
      } else if (targetVote === "down") {
        if (!existing) {
          await tx.blogPostVote.create({
            data: { postId, visitorHash, isUpvote: false },
          });
          await tx.blogPost.update({
            where: { id: postId },
            data: { downvoteCount: { increment: 1 } },
          });
          nextUserVote = "down";
        } else if (!existing.isUpvote) {
          // Toggle off
          await tx.blogPostVote.delete({ where: { id: existing.id } });
          await tx.blogPost.update({
            where: { id: postId },
            data: { downvoteCount: { decrement: 1 } },
          });
          nextUserVote = null;
        } else {
          // Switch dari upvote ke downvote
          await tx.blogPostVote.update({
            where: { id: existing.id },
            data: { isUpvote: false },
          });
          await tx.blogPost.update({
            where: { id: postId },
            data: { upvoteCount: { decrement: 1 }, downvoteCount: { increment: 1 } },
          });
          nextUserVote = "down";
        }
      } else {
        // targetVote === null -> hapus bila ada
        if (existing) {
          await tx.blogPostVote.delete({ where: { id: existing.id } });
          await tx.blogPost.update({
            where: { id: postId },
            data: existing.isUpvote
              ? { upvoteCount: { decrement: 1 } }
              : { downvoteCount: { decrement: 1 } },
          });
        }
        nextUserVote = null;
      }

      const post = await tx.blogPost.findUnique({
        where: { id: postId },
        select: { upvoteCount: true, downvoteCount: true },
      });

      // Normalisasi nilai agar tidak negatif karena anomali
      const up = Math.max(0, post?.upvoteCount ?? 0);
      const down = Math.max(0, post?.downvoteCount ?? 0);

      if ((post?.upvoteCount ?? 0) < 0 || (post?.downvoteCount ?? 0) < 0) {
        await tx.blogPost.update({
          where: { id: postId },
          data: { upvoteCount: up, downvoteCount: down },
        });
      }

      return {
        upvoteCount: up,
        downvoteCount: down,
        userVote: nextUserVote,
      };
    });
  },
};
