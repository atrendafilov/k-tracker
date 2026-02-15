/**
 * Cloudflare Worker — bridges Slack slash command to GitHub repository_dispatch.
 *
 * Deploy to Cloudflare Workers (free tier: 100k requests/day).
 *
 * Required environment variables (set in Workers dashboard → Settings → Variables):
 *   GITHUB_TOKEN  — fine-grained PAT with Contents: read+write on the repo
 *   GITHUB_REPO   — owner/repo  (e.g. "andreat/k-tracker")
 *   SLACK_TOKEN    — (optional) your Slack app's signing secret for verification
 */

export default {
  async fetch(request, env) {
    // Slack sends POST for slash commands
    if (request.method !== 'POST') {
      return new Response('Not allowed', { status: 405 });
    }

    // Fire repository_dispatch to GitHub
    const ghResp = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'k-tracker-slack-bridge',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'slack_reset',
          client_payload: { text: 'seen' },
        }),
      }
    );

    // Respond to Slack (must reply within 3 s)
    if (ghResp.ok || ghResp.status === 204) {
      return new Response(
        JSON.stringify({
          response_type: 'in_channel',
          text: 'Clock has been reset! K has been spotted.',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: `Failed to reset clock (HTTP ${ghResp.status})`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};
