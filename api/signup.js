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

  try {
    const { name, phone, email } = parseBody(req);
    const trimmedName = String(name ?? "").trim();
    const trimmedPhone = String(phone ?? "").trim();
    const trimmedEmail = String(email ?? "").trim();

    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ error: "이름을 2자 이상 입력해 주세요." });
    }

    if (!validatePhone(trimmedPhone)) {
      return res.status(400).json({ error: "올바른 연락처를 입력해 주세요." });
    }

    if (!validateEmail(trimmedEmail)) {
      return res.status(400).json({ error: "올바른 이메일을 입력해 주세요." });
    }

    console.log("[signup]", {
      name: trimmedName,
      phone: trimmedPhone.replace(/\d(?=\d{4})/g, "*"),
      email: trimmedEmail.replace(/(^.).+(@.+$)/, "$1***$2"),
      at: new Date().toISOString(),
    });

    return res.status(200).json({
      ok: true,
      message: "가입 신청이 접수되었습니다.",
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
}
