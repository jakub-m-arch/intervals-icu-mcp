import type { McpServer } from '@modelcontextprotocol/server';
import { getAthleteProfile } from '../tools/athlete.js';
import type { ToolContext } from '../tools/define-tool.js';

/**
 * Resources are read by the client application (e.g. attached as context by the user),
 * unlike tools which the model calls itself.
 */
export function registerResources(server: McpServer, context: ToolContext): void {
  server.registerResource(
    'athlete-profile',
    'intervals://athlete/profile',
    {
      title: 'Athlete profile',
      description: 'Athlete settings: units, time zone, thresholds and training zones per sport.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(await getAthleteProfile.handler({}, context), null, 2),
        },
      ],
    }),
  );
}
