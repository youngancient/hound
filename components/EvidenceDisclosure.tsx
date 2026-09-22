type ToolCall = {
  id: string;
  tool_name: string;
  purpose: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

/** Collapsed by default — the technical evidence trail, for anyone who wants to verify, not forced onto the primary view. */
export function EvidenceDisclosure({ sourceUrls, toolCalls }: { sourceUrls: string[]; toolCalls: ToolCall[] }) {
  return (
    <details className="rounded-sm border border-rule p-4 text-sm">
      <summary className="cursor-pointer text-ash">See how Hound found this</summary>
      <div className="mt-3 flex flex-col gap-4">
        {sourceUrls.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-ash">Sources</p>
            <ul className="flex flex-col gap-1">
              {sourceUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {toolCalls.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-ash">Activity</p>
            <ul className="flex flex-col gap-1 font-mono text-xs text-ash">
              {toolCalls.map((call) => (
                <li key={call.id}>
                  {call.tool_name} — {call.status}
                  {call.error_message ? `: ${call.error_message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
