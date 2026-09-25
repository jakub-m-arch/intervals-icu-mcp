import { z } from 'zod';
import { unwrap } from '../api/client.js';
import { defineTool } from './define-tool.js';
import { activityId } from './schemas.js';

export const addActivityComment = defineTool({
  name: 'add_activity_comment',
  title: 'Comment on an activity',
  description:
    'Add a comment to an activity, e.g. a post-session note. Comments are visible to anyone ' +
    'who can see the activity (followers, coach). Show the exact text to the user and get ' +
    'agreement before posting.',
  toolset: 'chats',
  access: 'write',
  operations: ['sendActivityMessage'],
  input: z.object({
    id: activityId,
    text: z.string().min(1).max(5000),
  }),
  output: z.object({ posted: z.boolean(), activity_id: z.string() }),
  async handler(args, ctx) {
    unwrap(
      await ctx.api.POST('/api/v1/activity/{id}/messages', {
        params: { path: { id: args.id } },
        body: { content: args.text },
      }),
    );
    return { posted: true, activity_id: args.id };
  },
});
