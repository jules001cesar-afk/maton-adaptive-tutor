// Cloudflare Pages Function: POST /api/analyze
import { handleAnalyze, type Env } from "../../shared/api.ts";

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleAnalyze(request, env);
