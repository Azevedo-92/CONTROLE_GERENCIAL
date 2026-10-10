// Edge Function: gerencia quem tem acesso ao painel de pedidos.
// Só responde a sócios já autorizados (tabela pedidos_admins).
// Ações: listar | adicionar {email, senha?} | senha {email, senha} | remover {email}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quem está chamando?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await sb.auth.getUser(token);
  const meuEmail = quem?.user?.email?.toLowerCase();
  if (!meuEmail) return json({ erro: "Entre no painel novamente." }, 401);
  const { data: souAdmin } = await sb.from("pedidos_admins").select("email").eq("email", meuEmail).maybeSingle();
  if (!souAdmin) return json({ erro: "Seu e-mail não tem permissão para gerenciar sócios." }, 403);

  let body: { acao?: string; email?: string; senha?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const acao = body.acao ?? "listar";
  const email = (body.email ?? "").trim().toLowerCase();
  const senha = body.senha ?? "";

  // Procura contas pelo e-mail (percorre as páginas de usuários do projeto)
  async function contas(alvos?: Set<string>) {
    const mapa = new Map<string, { id: string; ultimoAcesso: string | null }>();
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) {
        const e = (u.email ?? "").toLowerCase();
        if (!alvos || alvos.has(e)) mapa.set(e, { id: u.id, ultimoAcesso: u.last_sign_in_at ?? null });
      }
      if (alvos && [...alvos].every((a) => mapa.has(a))) break;
      if (data.users.length < 1000) break;
    }
    return mapa;
  }

  try {
    if (acao === "listar") {
      const { data: lista, error } = await sb.from("pedidos_admins").select("email").order("email");
      if (error) throw error;
      const emails = new Set((lista ?? []).map((l) => l.email));
      const mapa = await contas(emails);
      return json({
        voce: meuEmail,
        socios: [...emails].map((e) => ({ email: e, temConta: mapa.has(e), ultimoAcesso: mapa.get(e)?.ultimoAcesso ?? null })),
      });
    }

    if (!EMAIL.test(email)) return json({ erro: "Informe um e-mail válido." }, 400);

    if (acao === "adicionar") {
      const existente = (await contas(new Set([email]))).get(email);
      let criouConta = false;
      if (!existente) {
        if (senha.length < 8) return json({ erro: "Essa pessoa ainda não tem conta. Defina uma senha inicial com pelo menos 8 caracteres." }, 400);
        const { error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true });
        if (error) return json({ erro: "Não foi possível criar a conta: " + error.message }, 400);
        criouConta = true;
      }
      const { error } = await sb.from("pedidos_admins").upsert({ email });
      if (error) throw error;
      return json({ ok: true, criouConta });
    }

    if (acao === "senha") {
      if (senha.length < 8) return json({ erro: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
      const { data: ehSocio } = await sb.from("pedidos_admins").select("email").eq("email", email).maybeSingle();
      if (!ehSocio) return json({ erro: "Esse e-mail não está na lista de sócios." }, 400);
      const conta = (await contas(new Set([email]))).get(email);
      if (!conta) return json({ erro: "Essa pessoa ainda não tem conta. Remova e adicione de novo com uma senha." }, 400);
      const { error } = await sb.auth.admin.updateUserById(conta.id, { password: senha });
      if (error) return json({ erro: "Não foi possível trocar a senha: " + error.message }, 400);
      return json({ ok: true });
    }

    if (acao === "remover") {
      if (email === meuEmail) return json({ erro: "Você não pode remover o seu próprio acesso." }, 400);
      const { error } = await sb.from("pedidos_admins").delete().eq("email", email);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: "Erro inesperado. Tente de novo." }, 500);
  }
});
