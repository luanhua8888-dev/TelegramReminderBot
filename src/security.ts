// Bộ lọc bảo mật: chặn thông tin tài chính nhạy cảm (mật khẩu, PIN, OTP, CVV)
// và nội dung khiêu dâm / nhạy cảm người lớn.

export type SensitiveReason = "banking" | "nsfw";

export type SensitiveCheckResult =
  | { safe: true }
  | {
      safe: false;
      reason: SensitiveReason;
      message: string;
    };

export class SensitiveContentError extends Error {
  readonly reason: SensitiveReason;
  constructor(reason: SensitiveReason, message: string) {
    super(message);
    this.name = "SensitiveContentError";
    this.reason = reason;
  }
}

export const MSG_BANKING_BLOCKED =
  "🔒 Để bảo vệ tài sản, bot từ chối lưu mật khẩu, mã PIN, OTP hoặc thông tin ngân hàng. Vui lòng không chia sẻ thông tin tài chính nhạy cảm!";

export const MSG_NSFW_BLOCKED =
  "⚠️ Nội dung chứa từ ngữ nhạy cảm / người lớn không phù hợp. Vui lòng thử lại với nội dung khác.";

/** Chuẩn hoá tiếng Việt: bỏ dấu, chữ thường, chuyển @ thành a */
export function normalizeSecurityText(str: string): { raw: string; normalized: string; cleaned: string } {
  const raw = str.toLowerCase();
  const normalized = str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/@/g, "a")
    .toLowerCase();

  // Bỏ dấu chấm, gạch, sao nằm xen kẽ giữa các ký tự chữ cái (ví dụ: m.ậ.t, s-a-c-o-m, p.a.s.s, s*x)
  const dePunct = normalized.replace(/([a-z0-9])[._\-*~]+(?=[a-z0-9])/gi, (_match, p1: string) => p1);

  // Gom các chữ cái đơn lẻ cách nhau bằng khoảng trắng (ví dụ: s e x -> sex, p a s s -> pass, m a t -> mat)
  const cleaned = dePunct.replace(/\b([a-z](?:\s+[a-z])+)\b/gi, (m) => m.replace(/\s+/g, ""));

  return { raw, normalized, cleaned };
}

// Từ khoá / thực thể tài chính hoặc ngân hàng (sau khi bỏ dấu)
const BANK_ENTITIES = [
  // Sacombank và các biến thể phiên âm vui / tiếng lóng
  /s[ax]a?\s*c[oöôơ]m\s*ban[hk]/i,
  /sacombank/i,
  // Vietcombank
  /viet\s*com\s*ban[hk]/i,
  /vietcombank/i,
  /\bvcb\b/i,
  // Techcombank
  /tech\s*com\s*ban[hk]/i,
  /techcombank/i,
  /\btcb\b/i,
  // MB Bank
  /\bmbbank\b/i,
  /\bmb\s*bank\b/i,
  /\bmb\b/i,
  // Agribank
  /agri\s*ban[hk]/i,
  /agribank/i,
  // BIDV
  /\bbidv\b/i,
  // ACB / Á Châu
  /\bacb\b/i,
  /\ba\s*chau\b/i,
  // VPBank
  /\bvp\s*bank\b/i,
  /\bvpbank\b/i,
  // TPBank
  /\btp\s*bank\b/i,
  /\btpbank\b/i,
  /tien\s*phong\s*ban[hk]/i,
  // Vietinbank / CTG
  /viet\s*in\s*ban[hk]/i,
  /vietinbank/i,
  /\bctg\b/i,
  // Các ngân hàng khác
  /\bshb\b/i,
  /\bhdbank\b/i,
  /\bhd\s*bank\b/i,
  /\bvib\b/i,
  /\bscb\b/i,
  /\bocb\b/i,
  /\bmsb\b/i,
  /\bseabank\b/i,
  /\blpbank\b/i,
  /\bbacabank\b/i,
  /\bpvcombank\b/i,
  /\bnamabank\b/i,
  /\bkienlongbank\b/i,
  /\bbvbank\b/i,
  /\bdongabank\b/i,
  // Ví điện tử
  /\bmomo\b/i,
  /\bzalopay\b/i,
  /viettel\s*money/i,
  /\bviettelpay\b/i,
  /\bshopeepay\b/i,
  // Thuật ngữ ngân hàng / thẻ / tài khoản chung
  /ngan\s*han[gk]/i,
  /internet\s*banking/i,
  /\bibanking\b/i,
  /mobile\s*banking/i,
  /app\s*ngan\s*han[gk]/i,
  /the\s*ngan\s*han[gk]/i,
  /the\s*tin\s*dung/i,
  /the\s*visa/i,
  /the\s*mastercard/i,
  /the\s*atm/i,
  /\batm\b/i,
  /tai\s*khoan\s*ngan\s*han[gk]/i,
  /tk\s*ngan\s*han[gk]/i,
];

// Từ khoá xác thực / bảo mật (sau khi bỏ dấu)
const CREDENTIAL_KEYWORDS = [
  /m[aâăáàảãạ]?\s*t?[\s._\-]*k\s*h\s*a\s*u/i, // mat khau
  /\bmatkhau\b/i,
  /\bmk\b/i,
  /\bm[\s._\-]+k\b/i,
  /pass\s*word/i,
  /pass\s*wd/i,
  /\bp[\s._\-]*a[\s._\-]*s[\s._\-]*s\b/i, // pass, p.a.s.s
  /\bpass\b/i,
  /\bpwd\b/i,
  /m[aáàảãạ]?\s*pin/i, // ma pin, pin code
  /\bpin\s*(?:code)?\b/i,
  /m[aáàảãạ]?\s*otp/i, // ma otp
  /\botp\b/i,
  /m[aáàảãạ]?\s*xac\s*thuc/i,
  /m[aáàảãạ]?\s*cvv/i, // ma cvv
  /\bcvv\b/i,
  /\bcvc\b/i,
  /m[aáàảãạ]?\s*bao\s*mat/i,
];

// Ngoại lệ không coi là credential (ví dụ "pass lại đồ", "thi pass", "pass qua")
const PASS_BENIGN_CONTEXT =
  /\bpass\s+(?:lai|do|cai|chiec|ao|quan|dam|vay|xe|phong\s*van|qua|mon|bai|ky\s*thi)\b/i;

// Từ khoá / nội dung người lớn (NSFW)
const NSFW_PATTERNS = [
  // Biến thể của sex: sex, s.e.x, s*x, s-e-x, sexxx
  /\bse+x+\b/i,
  /\bs[\s._\-]*e[\s._\-]*x+\b/i,
  /\bs[\s._\-]*\*+[\s._\-]*x+\b/i,
  /\bs\*+x\b/i,
  // Phim / ảnh / truyện / web người lớn
  /\b(?:phim|clip|chat|video|link|hinh|anh|truyen|web)\s*sex\b/i,
  /khieu\s*dam/i,
  /\bporn(?:o|ography)?\b/i,
  /\bxxx\b/i,
  /\bhentai\b/i,
  /\bjav\b/i,
  /\bnude\b/i,
  /khoa\s*than/i,
  /lo\s*clip\s*(?:nong|sex)?/i,
  /clip\s*nong/i,
  // Mại dâm / dịch vụ tình dục
  /gai\s*goi/i,
  /\bcall\s*girl\b/i,
  /ban\s*dam/i,
  /mua\s*dam/i,
  /mai\s*dam/i,
  // Thủ dâm
  /thu\s*dam/i,
  /soc\s*lo/i,
  /tham\s*du/i,
  // Tội phạm tình dục / loạn luân
  /loan\s*luan/i,
  /hiep\s*dam/i,
  /cuong\s*dam/i,
  // Từ lóng quan hệ tình dục
  /(?:ga|ru|di|thich|muon)\s*(?:di\s*)?chich\b/i,
  /chich\s*(?:nhau|em|gai|dao)\b/i,
  /(?:ga|ru|di|thich|muon)\s*(?:di\s*)?xoac\b/i,
  /xoac\s*(?:nhau|em|gai)\b/i,
  /(?:ga|ru|di|thich|muon)\s*(?:di\s*)?nen\b/i,
];

/**
 * Kiểm tra xem nội dung văn bản có chứa mật khẩu ngân hàng hoặc từ ngữ nhạy cảm hay không.
 */
export function checkSensitiveContent(input: string): SensitiveCheckResult {
  if (!input || typeof input !== "string") return { safe: true };

  const { raw, normalized, cleaned } = normalizeSecurityText(input);
  const targets = [input, raw, normalized, cleaned];

  // 1. Kiểm tra từ ngữ nhạy cảm / NSFW
  for (const pat of NSFW_PATTERNS) {
    if (targets.some((t) => pat.test(t))) {
      return {
        safe: false,
        reason: "nsfw",
        message: MSG_NSFW_BLOCKED,
      };
    }
  }

  // 2. Kiểm tra thông tin nhạy cảm ngân hàng:
  // Nếu có ngữ cảnh pass benign ("pass lại áo...") thì không tính "pass" là credential
  const isBenignPass = targets.some((t) => PASS_BENIGN_CONTEXT.test(t));

  // Kiểm tra CVV độc lập: CVV là mã bí mật thẻ cực kỳ đặc trưng
  if (targets.some((t) => /\b(?:ma\s*)?cvv\b/i.test(t) || /\b(?:ma\s*)?cvc\b/i.test(t))) {
    return {
      safe: false,
      reason: "banking",
      message: MSG_BANKING_BLOCKED,
    };
  }

  const hasBankEntity = BANK_ENTITIES.some((p) => targets.some((t) => p.test(t)));
  if (hasBankEntity) {
    const hasCredential = CREDENTIAL_KEYWORDS.some((p) => {
      // Nếu là chữ "pass" nhưng đang trong ngữ cảnh bán đồ / thi đỗ thì bỏ qua
      if (isBenignPass && p.source.includes("pass")) return false;
      return targets.some((t) => p.test(t));
    });

    if (hasCredential) {
      return {
        safe: false,
        reason: "banking",
        message: MSG_BANKING_BLOCKED,
      };
    }
  }

  return { safe: true };
}

/**
 * Ném ngoại lệ SensitiveContentError nếu phát hiện nội dung không an toàn.
 */
export function assertSafeContent(input: string): void {
  const res = checkSensitiveContent(input);
  if (!res.safe) {
    throw new SensitiveContentError(res.reason, res.message);
  }
}
