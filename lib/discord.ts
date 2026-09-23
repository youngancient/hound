import "server-only";

/**
 * Fire-and-forget post to Discord via the bot API (not an incoming
 * webhook) on search failure only. Never blocks or throws into the run's
 * own failure handling — a Discord outage or missing config must never
 * fail a search. See artifact/design.md Section 8.
 */
export function postSearchFailure(params: { runId: string; objective: string; error: string }): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!botToken || !channelId) return Promise.resolve();

  const appUrl = process.env.APP_URL ?? "";

  // Returned so callers can wait for delivery (Inngest steps, after()); it
  // never rejects, so a Discord problem can't fail anything.
  return fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: [
        "**Search didn't finish**",
        `objective: ${params.objective}`,
        appUrl ? `search: ${appUrl}/searches/${params.runId}` : `search id: ${params.runId}`,
        `reason: ${params.error}`,
      ].join("\n"),
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error("Discord bot message post failed:", res.status, await res.text());
      }
    })
    .catch((err) => {
      console.error("Discord bot message post failed:", err);
    });
}
