// Cloudflare Pages Function: GET/POST /api/whatsapp (WhatsApp Cloud API webhook)
import { diagnoseWork } from "../../shared/diagnose.ts";
import { handleWhatsApp, type WhatsAppEnv } from "../../shared/whatsapp.ts";

type Context = { request: Request; env: WhatsAppEnv; waitUntil: (p: Promise<unknown>) => void };

export const onRequest = ({ request, env, waitUntil }: Context) =>
  handleWhatsApp(request, env, { fetch: (input, init) => fetch(input, init), diagnoseWork, waitUntil });
