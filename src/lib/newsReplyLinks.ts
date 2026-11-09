export interface GeneratedComment {
  author?: string;
  content?: string;
  likes?: number;
  replyToAuthor?: string;
  replyToIndex?: number;
}

const nickKey = (nick: string) => nick.trim().replace(/^@/, "").normalize("NFC").toLocaleLowerCase("pl-PL");

/** Resolve before filtering: legacy indices must refer to the original AI batch. */
export function generatedReplyParents(
  comments: GeneratedComment[],
  ids: string[],
  target?: { author: string; id: string },
): (string | undefined)[] {
  return comments.map((comment, index) => {
    if (typeof comment.replyToAuthor === "string") {
      const key = nickKey(comment.replyToAuthor);
      if (!key) return target?.id;
      for (let previous = index - 1; previous >= 0; previous--) {
        if (nickKey(comments[previous].author || "anon") === key) return ids[previous];
      }
      // An unknown nick must never fall back to a potentially conflicting index.
      return target && nickKey(target.author) === key ? target.id : undefined;
    }
    const previous = comment.replyToIndex;
    return typeof previous === "number" && Number.isInteger(previous) && previous >= 0 && previous < index
      ? ids[previous]
      : target?.id;
  });
}