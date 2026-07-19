"use client";

import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  const [lang, setLang] = useState<"en" | "hi">("en");

  const content = {
    en: {
      title: "Privacy Policy",
      subtitle: "Last updated: July 19, 2026",
      langLabel: "हिन्दी में पढ़ें",
      sections: [
        {
          h: "1. Overview",
          p: `Acu ("we", "our", "us") respects your privacy and is committed to protecting your personal data. This policy explains how we collect, use, disclose, and safeguard your information when you use our application and website.`,
        },
        {
          h: "2. Information We Collect",
          p: "We collect the following categories of personal information:",
          items: [
            "Identity Data: name, email address, and role (student/parent) provided during registration.",
            "Authentication Data: password (hashed and stored securely via Firebase Authentication).",
            "Content Data: textbook files you upload, chapter mappings, exam answers, AI-generated study materials (slides, notes, flashcards, MCQs, timelines, podcast scripts).",
            "Usage Data: features accessed, documents uploaded, exams taken, and study artifacts generated.",
            "Device Data: browser type, device type, and operating system (collected anonymously via Firebase Analytics).",
            "Payment Data: we do not store payment card details. Payments are processed by Razorpay, which collects and handles payment data under its own privacy policy.",
          ],
        },
        {
          h: "3. Legal Basis for Processing (IT Act 2000 & DPDP Act 2023)",
          p: "We process your personal data in compliance with the Information Technology Act, 2000, the Digital Personal Data Protection Act, 2023, and the IT (Reasonable Security Practices and Procedures) Rules, 2011. We rely on the following legal bases:",
          items: [
            "Consent: you have provided explicit consent by accepting this policy during registration.",
            "Contract: processing is necessary to provide our AI study services to you.",
            "Legal obligation: we may process data to comply with applicable Indian laws.",
          ],
        },
        {
          h: "4. How We Use Your Information",
          items: [
            "To generate AI-powered study content (notes, slides, flashcards, exam papers) using Google Gemini and Groq AI models.",
            "To store your data in cloud infrastructure (Firebase Firestore) for cross-device sync.",
            "To back up your data to Google Drive (only if you explicitly connect your Google Drive account).",
            "To process premium subscription payments via Razorpay (UPI only).",
            "To improve our services through anonymous usage analytics.",
            "To communicate with you about service updates, policy changes, or support requests.",
          ],
        },
        {
          h: "5. Data Storage and Security",
          p: "We implement reasonable security practices as required under the IT (Reasonable Security Practices and Procedures) Rules, 2011:",
          items: [
            "Encryption: all data in transit is encrypted via TLS 1.3. Data at rest is encrypted using AES-256.",
            "Access control: Firebase Authentication manages access. Only authenticated users can access their own data.",
            "API key protection: AI provider API keys (Gemini, Groq) are stored server-side only — never exposed to the client browser.",
            "Firebase Security Rules: Firestore enforces per-UID access control. Users can only read/write their own profile, documents, and attempts.",
            "Rate limiting: API endpoints are rate-limited per IP to prevent abuse.",
            "Regular audits: we review our security practices periodically.",
          ],
        },
        {
          h: "6. Data Retention",
          p: "We retain your personal data for as long as your account is active. Upon account deletion, we delete or anonymize your data within 30 days, except where retention is required by Indian law (e.g., tax records for payment transactions — retained for 8 years).",
          items: [
            "Uploaded documents: deleted immediately on account deletion or user request.",
            "AI-generated content: deleted immediately on account deletion.",
            "Exam attempts and grades: deleted on account deletion.",
            "Payment records (via Razorpay): retained for 8 years as required by Indian tax law.",
          ],
        },
        {
          h: "7. Your Rights Under DPDP Act 2023",
          p: "Under the Digital Personal Data Protection Act, 2023, you have the following rights:",
          items: [
            "Right to Access: request a copy of your personal data we hold.",
            "Right to Correction: request correction of inaccurate or incomplete data.",
            "Right to Erasure: request deletion of your personal data (subject to legal retention requirements).",
            "Right to Grievance Redressal: file a complaint with our Grievance Officer (see Section 12).",
            "Right to Withdraw Consent: withdraw consent for data processing at any time by deleting your account.",
            "Right to Data Portability: request your data in a structured, machine-readable format.",
          ],
          note: "To exercise any of these rights, contact us at acudex.connect@gmail.com or through the Settings panel in the app.",
        },
        {
          h: "8. Data Sharing and Third-Party Services",
          p: "We share your data only with essential service providers:",
          items: [
            "Google Firebase (Firestore, Auth, Hosting): cloud infrastructure and authentication.",
            "Google Gemini AI: AI content generation (Gemini API). Prompts are sent server-side; API key is never exposed to client.",
            "Groq AI: fallback AI provider for content generation when Gemini is rate-limited.",
            "Razorpay: payment processing (UPI only). We do not store payment data.",
            "Google Drive (optional): backup storage only if you explicitly connect your account.",
          ],
          note: "We do not sell your personal data to third parties. We do not use your data for advertising or profiling.",
        },
        {
          h: "9. Cross-Border Data Transfer",
          p: "Your data is stored on Google Cloud Platform servers located in Mumbai, India (asia-south1). AI API calls to Gemini (Google) and Groq may involve data transfer to servers outside India. These providers comply with standard contractual clauses and security certifications (SOC 2, ISO 27001).",
        },
        {
          h: "10. Children's Privacy",
          p: "Acu is intended for students aged 13 and above. We do not knowingly collect personal data from children under 13. If you believe a child under 13 has provided us with personal data, please contact our Grievance Officer immediately.",
        },
        {
          h: "11. Changes to This Policy",
          p: "We may update this privacy policy from time to time. We will notify users of material changes via email or through the app. Continued use of the app after changes constitutes acceptance of the updated policy.",
        },
        {
          h: "12. Grievance Officer",
          p: "As required under the IT Act, 2000 and DPDP Act, 2023, we have appointed a Grievance Officer:",
          items: [
            "Email: acudex.connect@gmail.com",
            "Response time: We acknowledge complaints within 24 hours and resolve them within 30 days as per DPDP Act guidelines.",
          ],
        },
      ],
    },
    hi: {
      title: "गोपनीयता नीति",
      subtitle: "अंतिम अद्यतन: 19 जुलाई, 2026",
      langLabel: "Read in English",
      sections: [
        {
          h: "1. परिचय",
          p: `Acu ("हम", "हमारा") आपकी गोपनीयता का सम्मान करता है और आपके व्यक्तिगत डेटा की सुरक्षा के लिए प्रतिबद्ध है। यह नीति बताती है कि हम आपके एप्लिकेशन और वेबसाइट का उपयोग करते समय आपकी जानकारी कैसे एकत्र, उपयोग, प्रकट और संरक्षित करते हैं।`,
        },
        {
          h: "2. हम कौन सी जानकारी एकत्र करते हैं",
          p: "हम निम्नलिखित श्रेणियों की व्यक्तिगत जानकारी एकत्र करते हैं:",
          items: [
            "पहचान डेटा: नाम, ईमेल पता, और भूमिका (छात्र/अभिभावक) जो पंजीकरण के दौरान प्रदान की जाती है।",
            "प्रमाणीकरण डेटा: पासवर्ड (Firebase Authentication के माध्यम से हैश और सुरक्षित रूप से संग्रहीत)।",
            "सामग्री डेटा: आपके द्वारा अपलोड की गई पाठ्यपुस्तक फ़ाइलें, अध्याय मैपिंग, परीक्षा उत्तर, AI-जनित अध्ययन सामग्री।",
            "उपयोग डेटा: एक्सेस की गई सुविधाएँ, अपलोड किए गए दस्तावेज़, ली गई परीक्षाएँ।",
            "डिवाइस डेटा: ब्राउज़र प्रकार, डिवाइस प्रकार, और ऑपरेटिंग सिस्टम।",
            "भुगतान डेटा: हम भुगतान कार्ड विवरण संग्रहीत नहीं करते हैं। भुगतान Razorpay द्वारा संसाधित किए जाते हैं।",
          ],
        },
        {
          h: "3. प्रसंस्करण का कानूनी आधार (IT अधिनियम 2000 और DPDP अधिनियम 2023)",
          p: "हम सूचना प्रौद्योगिकी अधिनियम, 2000, डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023, और IT (उचित सुरक्षा अभ्यास और प्रक्रियाएँ) नियम, 2011 के अनुपालन में आपके व्यक्तिगत डेटा को संसाधित करते हैं:",
          items: [
            "सहमति: आपने इस नीति को स्वीकार करके स्पष्ट सहमति प्रदान की है।",
            "अनुबंध: आपको हमारी AI अध्ययन सेवाएँ प्रदान करने के लिए प्रसंस्करण आवश्यक है।",
            "कानूनी दायित्व: हम लागू भारतीय कानूनों का अनुपालन करने के लिए डेटा संसाधित कर सकते हैं।",
          ],
        },
        {
          h: "4. हम आपकी जानकारी का उपयोग कैसे करते हैं",
          items: [
            "Google Gemini और Groq AI मॉडल का उपयोग करके AI-संचालित अध्ययन सामग्री उत्पन्न करना।",
            "क्रॉस-डिवाइस सिंक के लिए क्लाउड इंफ्रास्ट्रक्चर (Firebase Firestore) में डेटा संग्रहीत करना।",
            "Google Drive पर डेटा का बैकअप लेना (केवल यदि आप स्पष्ट रूप से अपना Google Drive खाता कनेक्ट करते हैं)।",
            "Razorpay के माध्यम से प्रीमियम सब्सक्रिप्शन भुगतान संसाधित करना।",
            "गुमनाम उपयोग analytics के माध्यम से सेवाओं में सुधार करना।",
          ],
        },
        {
          h: "5. डेटा भंडारण और सुरक्षा",
          p: "हम IT (उचित सुरक्षा अभ्यास और प्रक्रियाएँ) नियम, 2011 के तहत आवश्यक उचित सुरक्षा प्रथाओं को लागू करते हैं:",
          items: [
            "एन्क्रिप्शन: ट्रांज़िट में सभी डेटा TLS 1.3 के माध्यम से एन्क्रिप्ट किया जाता है। आराम पर डेटा AES-256 का उपयोग करके एन्क्रिप्ट किया जाता है।",
            "पहुँच नियंत्रण: Firebase Authentication पहुँच का प्रबंधन करता है। केवल प्रमाणित उपयोगकर्ता ही अपने डेटा तक पहुँच सकते हैं।",
            "API कुंजी सुरक्षा: AI प्रदाता API कुंजियाँ केवल सर्वर-साइड संग्रहीत की जाती हैं।",
            "Firebase सुरक्षा नियम: Firestore प्रति-UID पहुँच नियंत्रण लागू करता है।",
            "दर सीमित: API एंडपॉइंट प्रति IP दर-सीमित हैं।",
          ],
        },
        {
          h: "6. डेटा प्रतिधारण",
          p: "हम आपके व्यक्तिगत डेटा को तब तक बनाए रखते हैं जब तक आपका खाता सक्रिय है। खाता हटाने पर, हम 30 दिनों के भीतर आपके डेटा को हटा या गुमनाम कर देते हैं, सिवाय जहां भारतीय कानून द्वारा प्रतिधारण आवश्यक है।",
        },
        {
          h: "7. DPDP अधिनियम 2023 के तहत आपके अधिकार",
          p: "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के तहत, आपके पास निम्नलिखित अधिकार हैं:",
          items: [
            "पहुँच का अधिकार: अपने व्यक्तिगत डेटा की प्रतिलिपि का अनुरोध करें।",
            "सुधार का अधिकार: गलत या अपूर्ण डेटा के सुधार का अनुरोध करें।",
            "मिटाने का अधिकार: अपने व्यक्तिगत डेटा को हटाने का अनुरोध करें।",
            "शिकायत निवारण का अधिकार: हमारे शिकायत अधिकारी से शिकायत दर्ज करें।",
            "सहमति वापस लेने का अधिकार: किसी भी समय अपना खाता हटाकर सहमति वापस लें।",
          ],
        },
        {
          h: "8. डेटा साझाकरण और तृतीय-पक्ष सेवाएँ",
          p: "हम आपका डेटा केवल आवश्यक सेवा प्रदाताओं के साथ साझा करते हैं:",
          items: [
            "Google Firebase: क्लाउड इंफ्रास्ट्रक्चर और प्रमाणीकरण।",
            "Google Gemini AI: AI सामग्री निर्माण।",
            "Groq AI: वैकल्पिक AI प्रदाता।",
            "Razorpay: भुगतान प्रसंस्करण (केवल UPI)।",
            "Google Drive: वैकल्पिक बैकअप स्टोरेज।",
          ],
          note: "हम तीसरे पक्ष को आपका व्यक्तिगत डेटा नहीं बेचते हैं।",
        },
        {
          h: "9. सीमा पार डेटा स्थानांतरण",
          p: "आपका डेटा मुंबई, भारत (asia-south1) में स्थित Google Cloud Platform सर्वरों पर संग्रहीत है। Gemini और Groq को AI API कॉल में भारत के बाहर सर्वरों पर डेटा स्थानांतरण शामिल हो सकता है।",
        },
        {
          h: "10. बच्चों की गोपनीयता",
          p: "Acu 13 वर्ष और उससे अधिक आयु के छात्रों के लिए है। हम जानबूझकर 13 वर्ष से कम उम्र के बच्चों से व्यक्तिगत डेटा एकत्र नहीं करते हैं।",
        },
        {
          h: "11. इस नीति में परिवर्तन",
          p: "हम समय-समय पर इस गोपनीयता नीति को अपडेट कर सकते हैं। हम ईमेल या ऐप के माध्यम से महत्वपूर्ण परिवर्तनों के बारे में उपयोगकर्ताओं को सूचित करेंगे।",
        },
        {
          h: "12. शिकायत अधिकारी",
          p: "IT अधिनियम, 2000 और DPDP अधिनियम, 2023 के तहत आवश्यकतानुसार, हमने एक शिकायत अधिकारी नियुक्त किया है:",
          items: [
            "ईमेल: acudex.connect@gmail.com",
            "प्रतिक्रिया समय: हम 24 घंटे के भीतर शिकायतें स्वीकार करते हैं और DPDP अधिनियम दिशानिर्देशों के अनुसार 30 दिनों के भीतर उनका समाधान करते हैं।",
          ],
        },
      ],
    },
  };

  const current = content[lang];

  return (
    <div className="min-h-screen bg-[#0b0c10] relative overflow-hidden py-12 px-4">
      <div className="max-w-3xl w-full mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-slate-950 hover:bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors bg-slate-950 hover:bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl cursor-pointer"
          >
            {current.langLabel}
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white">
            {current.title}
          </h1>
          <p className="text-slate-500 text-sm">{current.subtitle}</p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {current.sections.map((section, i) => (
            <div
              key={i}
              className="glass-panel p-6 rounded-2xl space-y-3"
            >
              <h2 className="text-lg font-display font-bold text-white">
                {section.h}
              </h2>
              {section.p && (
                <p className="text-slate-300 text-sm leading-relaxed">
                  {section.p}
                </p>
              )}
              {section.items && (
                <ul className="space-y-2 text-sm text-slate-400 leading-relaxed list-disc list-inside marker:text-violet-500">
                  {section.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
              {section.note && (
                <p className="text-slate-500 text-xs italic mt-2 border-l-2 border-violet-500/30 pl-3">
                  {section.note}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pt-4 pb-8">
          <p>Acu — Privacy-First AI Study Companion</p>
          <p className="mt-1">
            Contact:{" "}
            <a href="mailto:acudex.connect@gmail.com" className="text-violet-400 hover:text-violet-300">
              acudex.connect@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
