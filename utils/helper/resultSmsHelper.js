// utils/sms/resultSmsHelper.js
const axios = require("axios");

// Updated to BulkSMSBD credentials and URL
const SMS_API_KEY = process.env.SMS_API_KEY || "wuJuWj95YfnbuMU9WQhU";
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || "8809617624586";
const SMS_BASE_URL =
  process.env.SMS_API_URL || "http://bulksmsbd.net/api/smsapi";
const SMS_TYPE = "text"; // plain text

/**
 * Send an SMS with substituted variables.
 *
 * @param {Object} opts
 * @param {string} opts.phone       - destination phone number (e.g. 01761043883)
 * @param {string} opts.message     - template with {var} placeholders
 * @param {Object} [opts.variables] - values to substitute into {var}
 *
 * @returns {Promise<{success:boolean, message:string, details?:Object}>}
 */
const sendResultSms = async ({ phone, message, variables = {} }) => {
  try {
    if (!phone || String(phone).trim() === "") {
      return {
        success: false,
        message: "Phone number is required",
      };
    }

    if (!message || String(message).trim() === "") {
      return {
        success: false,
        message: "Message is required",
      };
    }

    // Normalize phone: strip spaces, dashes, leading +88
    let normalizedPhone = String(phone).replace(/[\s\-\(\)]/g, "");
    if (normalizedPhone.startsWith("+88")) {
      normalizedPhone = normalizedPhone.slice(3);
    }
    if (normalizedPhone.startsWith("88") && normalizedPhone.length > 11) {
      normalizedPhone = normalizedPhone.slice(2);
    }

    // Substitute {var} placeholders
    let finalMessage = message;
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      finalMessage = finalMessage.replace(
        regex,
        variables[key] === null || variables[key] === undefined
          ? ""
          : String(variables[key])
      );
    });
    // Remove any leftover unfilled placeholders
    finalMessage = finalMessage.replace(/\{[^}]+\}/g, "");

    // Build URL for BulkSMSBD (Non-Masking)
    const url =
      `${SMS_BASE_URL}?api_key=${encodeURIComponent(SMS_API_KEY)}` +
      `&type=${encodeURIComponent(SMS_TYPE)}` +
      `&number=${encodeURIComponent(normalizedPhone)}` +
      `&senderid=${encodeURIComponent(SMS_SENDER_ID)}` +
      `&message=${encodeURIComponent(finalMessage)}`;

    const response = await axios.post(url, null, { timeout: 10000 });

    // Parse BulkSMSBD gateway response
    const raw = response.data;
    const rawStr =
      typeof raw === "string" ? raw : JSON.stringify(raw || "");
      
    // BulkSMSBD returns a JSON object with response_code = 202 on success
    const responseCode = response.data?.response_code;
    const ok = Number(responseCode) === 202 || rawStr.includes("202");

    return {
      success: ok,
      message: ok ? "SMS sent successfully" : `SMS gateway response: ${rawStr}`,
      details: {
        to: normalizedPhone,
        message: finalMessage,
        messageLength: finalMessage.length,
        gatewayResponse: raw,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("sendResultSms error:", error?.message);

    let errorMessage = "Failed to send SMS";
    if (error.response) {
      errorMessage = `SMS gateway ${error.response.status}: ${JSON.stringify(
        error.response.data
      )}`;
    } else if (error.code === "ECONNABORTED") {
      errorMessage = "SMS gateway timeout";
    } else if (error.request) {
      errorMessage = "No response from SMS gateway";
    } else {
      errorMessage = error.message;
    }

    return {
      success: false,
      message: errorMessage,
      details: {
        to: phone,
        timestamp: new Date().toISOString(),
      },
    };
  }
}; 

/**
 * Build the SMS body for a result entry.
 * Customize the text here — this is the only place you edit wording.
 */
const buildResultSmsMessage = ({
  studentName,
  examName,
  cq,
  mcq,
  total,
  totalMark,
}) => {
  // Build the display name: take the first word; if it's shorter than 3
  // characters (e.g. "K M Abdullah"), include words until we have a
  // name of at least 3 characters, then stop.
  const words = String(studentName || "").trim().split(/\s+/).filter(Boolean);
  let displayName = words[0] || "";
  if (displayName.length < 3) {
    let i = 1;
    while (i < words.length && displayName.length < 3) {
      displayName += " " + words[i];
      i++;
    }
  }

  // Compact multi-line format, keeps each message well under 70 chars.
  // Example (~59 chars):
  // Dear Shakidul,
  // M-1
  // CQ:33
  // MCQ:33
  // Total:66/100-CG(Sawgat Sir)
  console.log( `Dear ${displayName},\n` +
    `${examName}\n` +
    `CQ:${cq}\n` +
    `MCQ:${mcq}\n` +
    `Total:${total}/${totalMark}\n-CG(Sawgat Sir)`)
  return (
    `Dear ${displayName},\n` +
    `${examName}\n` +
    `CQ:${cq}\n` +
    `MCQ:${mcq}\n` +
    `Total:${total}/${totalMark}\n-CG(Sawgat Sir)`
  );
};

module.exports = {
  sendResultSms,
  buildResultSmsMessage,
};




module.exports = {
  sendResultSms,
  buildResultSmsMessage,
};