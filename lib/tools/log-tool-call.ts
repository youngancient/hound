import "server-only";
import { supabaseService } from "../supabase/service";

/**
 * Every tool call gets logged, even on failure and even when the
 * downstream save fails — the log is the source of truth for "what did
 * this run actually attempt" (design.md Section 6). Never throws: a
 * logging failure must not take down the tool call it's describing.
 */
export async function logToolCall(params: {
  runId: string;
  leadId?: string | null;
  toolName: string;
  purpose: string;
  inputSummary: unknown;
  resultSummary: unknown;
  status: "success" | "error";
  errorMessage?: string | null;
  costUsd?: number | null;
}): Promise<void> {
  try {
    await supabaseService()
      .from("tool_calls")
      .insert({
        run_id: params.runId,
        lead_id: params.leadId ?? null,
        tool_name: params.toolName,
        purpose: params.purpose,
        input_summary: params.inputSummary,
        result_summary: params.resultSummary,
        status: params.status,
        error_message: params.errorMessage ?? null,
        cost_usd: params.costUsd ?? null,
      });
  } catch (err) {
    console.error("logToolCall failed:", err);
  }
}
