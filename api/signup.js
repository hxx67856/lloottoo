import { createClient } from "@supabase/supabase-js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits);
}

function normalizePhone(phone) {
  return String(phone).replace(/\D/g, "");
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({
      error:
        "Supabase가 설정되지 않았습니다. Vercel에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 추가해 주세요.",
    });
  }

  try {
    const { name, phone, email } = parseBody(req);
    const trimmedName = String(name ?? "").trim();
    const trimmedPhone = normalizePhone(phone);
    const trimmedEmail = String(email ?? "").trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ error: "이름을 2자 이상 입력해 주세요." });
    }

    if (!validatePhone(trimmedPhone)) {
      return res.status(400).json({ error: "올바른 연락처를 입력해 주세요." });
    }

    if (!validateEmail(trimmedEmail)) {
      return res.status(400).json({ error: "올바른 이메일을 입력해 주세요." });
    }

    const { data, error } = await supabase
      .from("signups")
      .insert({
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "이미 가입 신청된 이메일입니다.",
        });
      }

      throw new Error(error.message);
    }

    return res.status(200).json({
      ok: true,
      id: data.id,
      message: "가입 신청이 접수되었습니다.",
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
}
