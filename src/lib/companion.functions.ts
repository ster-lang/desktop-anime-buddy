import { createServerFn } from "@tanstack/react-start";

import { CommentInput, generateComment } from "./companion.server";

export const getCompanionComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CommentInput.parse(input))
  .handler(async ({ data }) => generateComment(data));
