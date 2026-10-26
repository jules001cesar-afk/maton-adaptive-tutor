// Cloudflare Pages Function: POST /api/check
import { handleCheck } from "../../shared/api.ts";

export const onRequestPost = ({ request }: { request: Request }) => handleCheck(request);
