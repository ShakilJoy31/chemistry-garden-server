// utils/sms/resultSmsHelper.js
const axios = require("axios");

const SMS_API_KEY = process.env.SMS_API_KEY || "C40010236a00bf0b2478e3.57108417";
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || "Ring Tel";
const SMS_BASE_URL =
  process.env.SMS_BASE_URL || "https://msg.mram.com.bd/smsapi";
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

    // Build URL
    const url =
      `${SMS_BASE_URL}?api_key=${encodeURIComponent(SMS_API_KEY)}` +
      `&type=${encodeURIComponent(SMS_TYPE)}` +
      `&contacts=${encodeURIComponent(normalizedPhone)}` +
      `&senderid=${encodeURIComponent(SMS_SENDER_ID)}` +
      `&msg=${encodeURIComponent(finalMessage)}`;

    const response = await axios.post(url, null, { timeout: 10000 });

    // Parse gateway response (mram.com.bd returns string like "SMS SUBMITTED: 100")
    const raw = response.data;
    const rawStr =
      typeof raw === "string" ? raw : JSON.stringify(raw || "");
    const ok =
      rawStr.includes("SMS SUBMITTED") ||
      rawStr.includes("SUCCESS") ||
      rawStr.includes("SENT") ||
      rawStr.includes("100");

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
const buildResultSmsMessage = ({ studentName, cq, mcq, total }) => {
  return (
    `Dear ${studentName},\n` +
    `Exam - 1\n` +
    `CQ: ${cq}/50\nMCQ: ${mcq}/25\nTotal: ${total}/10`
  );
};

module.exports = {
  sendResultSms,
  buildResultSmsMessage,
};